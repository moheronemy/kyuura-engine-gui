// 場のポケモンについているエネルギーの選べるものに、付属先（どのポケモンについているか）を示す表示（DecisionPanel の attachedTo・optionLabel）。表示だけで、送る値は選べるものの id のまま。
// 対応づけは公開の参照だけ: 選べるものの `card` と、今の観測の両プレイヤーのバトル場・ベンチの `energy` の `card`（ちょうど 1 か所・card_id が同じ・持ち主が決まるときだけ）。
// うらのポケモンは「裏向きのポケモン」と書き、real・カード定義を読まない。カード名・ID で個体を対応づけない。
// 出典: 「実応答」は 0.181.0（a2b29e9）の接続層の応答そのまま（test/keep.ts。keep_er_c の本人の決定）。「人工」は実応答にない境界のために、その形を写して値を変えたもの
// （エンジンの情報境界の正しさは人工の応答では確かめていない。実エンジンの観測は server/tests/test_keep.py・test_p6.py）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, FieldSlot, InputOption, InputStage, Observation, OptionStage } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { KEEP_CANDIDATES, KEEP_FACE_DOWN_OPTION, KEEP_FACE_UP_OPTION, KEEP_INPUTS, KEEP_REAL, KEEP_VIEWS } from "../test/keep";
import { OWN_FACE_DOWN_ACTIVE } from "../test/p6";
import { attachedTo, DecisionPanel, optionLabel } from "./DecisionPanel";

const NAMES: Record<string, string> = { "PMCG1-102": "基本闘エネルギー", "PMCG1-058": "エビワラー" };
const names = (id: string) => NAMES[id];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---- 実応答（0.181.0。keep_er_c の本人＝プレイヤー 0 の決定と観測）
const OBS = KEEP_VIEWS[0].observation as unknown as Observation;
const STAGE = KEEP_INPUTS.response.stages[0] as unknown as OptionStage;
const OPTIONS = STAGE.options as InputOption[];
const opt = (id: string) => OPTIONS.find((o) => o.id === id)!;
const ANSWER = KEEP_CANDIDATES.response.candidates.find((c) => c.kind === "answer_decision") as unknown as Candidate;
const SECRETS = new RegExp(Object.entries(KEEP_REAL).flat().join("|"));

function setup(observation: Observation | null, stages: InputStage[] = KEEP_INPUTS.response.stages as unknown as InputStage[], check: CheckResult | null = null) {
  const onSubmit = vi.fn();
  const parsed = V.inputsResponse({ ...KEEP_INPUTS, response: { ...KEEP_INPUTS.response, stages } });
  const ui = (obs: Observation | null, chk: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate: ANSWER, handle: { game: "g", revision: "r", candidate: ANSWER.id }, inputs: parsed, check: chk }}
      actor={0}
      observation={obs}
      names={names}
      busy={false}
      blocked={false}
      onCheck={() => undefined}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
  const view = render(ui(observation, check));
  return { onSubmit, user: userEvent.setup(), rerender: (obs: Observation | null, chk: CheckResult | null = check) => view.rerender(ui(obs, chk)) };
}

describe("付属先の表示（実応答: 0.181.0 の keep_er_c）", () => {
  it("同名のエネルギー 2 枚を別々の付属先として示す（相手のバトル場のおもて・相手のベンチのうら）。既存のカード名・ID は残す", () => {
    expect(optionLabel(opt(KEEP_FACE_UP_OPTION), STAGE, OBS, names)).toBe("基本闘エネルギー PMCG1-102 — 相手のバトル場：エビワラー");
    expect(optionLabel(opt(KEEP_FACE_DOWN_OPTION), STAGE, OBS, names)).toBe("基本闘エネルギー PMCG1-102 — 相手のベンチ1：裏向きのポケモン");
  });

  it("修正の前の表示（付属先なし）は観測がないときのまま", () => {
    expect(optionLabel(opt(KEEP_FACE_UP_OPTION), STAGE, null, names)).toBe("基本闘エネルギー PMCG1-102");
    expect(optionLabel(opt(KEEP_FACE_DOWN_OPTION), STAGE, null, names)).toBe("基本闘エネルギー PMCG1-102");
  });

  it("accessible name でも区別でき、選んだ選べるものの id がそのまま送る値になる（表示で入力を変えない）", async () => {
    const valid = (choices: string[]): CheckResult => ({ choices: choicesKey(choices), response: { valid: true, refusal: null } });
    const { user, onSubmit, rerender } = setup(OBS);
    const down = screen.getByRole("radio", { name: /相手のベンチ1：裏向きのポケモン/ });
    const up = screen.getByRole("radio", { name: /相手のバトル場：エビワラー/ });
    expect(down).not.toBe(up);
    await user.click(down);
    expect(screen.getByText(/送る値:/)).toHaveTextContent(`送る値: ["${KEEP_FACE_DOWN_OPTION}"]`);
    rerender(OBS, valid([KEEP_FACE_DOWN_OPTION]));
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith([KEEP_FACE_DOWN_OPTION]);
    await user.click(screen.getByRole("radio", { name: /相手のバトル場：エビワラー/ }));
    expect(screen.getByText(/送る値:/)).toHaveTextContent(`送る値: ["${KEEP_FACE_UP_OPTION}"]`);
  });

  it("相手のうらの本当のカード（名前・ID）を補わない。観測にない real を加えても（人工）付属先の表示は同じ", () => {
    const { rerender } = setup(OBS);
    const before = document.body.textContent ?? "";
    expect(before).not.toMatch(SECRETS);
    // 人工: 相手のうらに real を加えた観測（実際の本人の観測にはない。GUI が real を読まないことの確かめ）
    const leaked = clone(OBS);
    (leaked.players[1].bench[0] as FieldSlot as Record<string, unknown>).real = { card: 24, card_id: "neo3-030", name_ja: "アンノーンK" };
    expect(optionLabel(opt(KEEP_FACE_DOWN_OPTION), STAGE, leaked, names)).toBe(optionLabel(opt(KEEP_FACE_DOWN_OPTION), STAGE, OBS, names));
    rerender(leaked);
    expect(document.body.textContent).not.toMatch(SECRETS);
  });
});

// ---- 人工の応答（実応答の形を写して値を変えた。境界の確かめ）
function slot(pokemonId: number, name: string | null, energy: { card: number; card_id: string }[], extra: Record<string, unknown> = {}): FieldSlot {
  if (name === null) return { pokemon_id: pokemonId, face_down: true, damage: 0, energy, trainers: [], special_conditions: [], ...extra } as unknown as FieldSlot;
  return { pokemon_id: pokemonId, card: pokemonId * 100, card_id: "PMCG1-058", name_ja: name, hp: 70, damage: 0, energy, trainers: [], special_conditions: [], ...extra } as FieldSlot;
}
function obs(viewer: 0 | 1 | null, mine: { active: FieldSlot | null; bench: FieldSlot[] }, theirs: { active: FieldSlot | null; bench: FieldSlot[] }): Observation {
  const o = clone(OBS);
  o.viewer = viewer;
  Object.assign(o.players[0], mine);
  Object.assign(o.players[1], theirs);
  return o;
}
const E = (card: number) => ({ card, card_id: "PMCG1-102" });
const option = (id: string, card: number, extra: Record<string, unknown> = {}): InputOption => ({ id, card, card_id: "PMCG1-102", processability: "may_stop_later", ...extra });

describe("付属先の表示（人工の応答: 実応答にない境界）", () => {
  it("自分のポケモン（本人のうらのバトル場は real を読まず「裏向きのポケモン」）", () => {
    const own = { ...clone(OWN_FACE_DOWN_ACTIVE), energy: [E(5)] } as unknown as FieldSlot; // test/p6.ts の本人の観測（real つき）
    const o = obs(0, { active: own, bench: [slot(11, "エビワラー", [E(6)])] }, { active: slot(2, "エビワラー", []), bench: [] });
    expect(attachedTo(option("o1", 5), o)).toBe("自分のバトル場：裏向きのポケモン");
    expect(attachedTo(option("o2", 6), o)).toBe("自分のベンチ1：エビワラー");
    expect(optionLabel(option("o1", 5), STAGE, o, names)).not.toMatch(/イワーク|PMCG1-054/);
  });

  it("同じ名前のポケモン・複数のうらの控えは位置で区別する", () => {
    const o = obs(0, { active: slot(1, "エビワラー", []), bench: [] }, {
      active: slot(2, "エビワラー", [E(20)]),
      bench: [slot(3, "エビワラー", [E(21)]), slot(4, null, [E(22)]), slot(5, null, [E(23)])],
    });
    const labels = [20, 21, 22, 23].map((card) => attachedTo(option(`o${card}`, card), o));
    expect(labels).toEqual(["相手のバトル場：エビワラー", "相手のベンチ1：エビワラー", "相手のベンチ2：裏向きのポケモン", "相手のベンチ3：裏向きのポケモン"]);
    expect(new Set(labels).size).toBe(4);
  });

  it("付属先のないエネルギー（手札・トラッシュ）・場所のある選べるもの・holder のあるものには付けない", () => {
    const o = obs(0, { active: slot(1, "エビワラー", [E(10)]), bench: [] }, { active: slot(2, "エビワラー", []), bench: [] });
    o.players[0].hand = { count: 1, cards: [E(30)], revealed_by: [] };
    o.players[0].discard = [E(31)];
    expect(attachedTo(option("h", 30), o)).toBeNull(); // 手札
    expect(attachedTo(option("t", 31), o)).toBeNull(); // トラッシュ
    expect(optionLabel(option("h", 30), STAGE, o, names)).toBe("基本闘エネルギー PMCG1-102");
    expect(attachedTo(option("z", 10, { zone: "active" }), o)).toBeNull();
    expect(attachedTo(option("p", 10, { pokemon: 1 }), o)).toBeNull();
    expect(attachedTo(option("w", 10, { holder: { pokemon: 1, card: 10, zone: "active", card_id: "PMCG1-058" } }), o)).toBeNull();
  });

  it("参照の欠落・不一致・重複では推測せず、今の表示のまま", () => {
    const base = () => obs(0, { active: slot(1, "エビワラー", [E(10)]), bench: [] }, { active: slot(2, "エビワラー", [E(11)]), bench: [] });
    expect(attachedTo({ id: "o", card_id: "PMCG1-102", processability: "x" }, base())).toBeNull(); // card がない
    expect(attachedTo(option("o", 12), base())).toBeNull(); // 観測にない
    expect(attachedTo(option("o", 10, { card_id: "PMCG1-101" }), base())).toBeNull(); // card_id が違う
    const dup = base();
    (dup.players[1].active as { energy: unknown[] }).energy.push(E(10)); // 同じ番号が 2 か所
    expect(attachedTo(option("o", 10), dup)).toBeNull();
    const noName = obs(0, { active: slot(1, "エビワラー", []), bench: [] }, { active: { ...slot(2, "x", [E(11)]), name_ja: undefined } as unknown as FieldSlot, bench: [] });
    expect(attachedTo(option("o", 11), noName)).toBeNull(); // おもてなのに名前がない
    expect(optionLabel(option("o", 10), STAGE, dup, names)).toBe("基本闘エネルギー PMCG1-102");
  });

  it("観測を切り替えると、古い付属先を出さない（表示は今の観測だけから作る）", () => {
    const { rerender } = setup(OBS);
    expect(screen.getByRole("radio", { name: /相手のベンチ1：裏向きのポケモン/ })).toBeInTheDocument();
    const moved = clone(OBS);
    const [fd] = moved.players[1].bench as [FieldSlot];
    moved.players[1].bench = [slot(9, "エビワラー", []), fd]; // 人工: うらがベンチ2へ（位置が変わった観測）
    rerender(moved);
    expect(screen.queryByText(/相手のベンチ1：裏向きのポケモン/)).toBeNull();
    expect(screen.getByRole("radio", { name: /相手のベンチ2：裏向きのポケモン/ })).toBeInTheDocument();
    rerender(null);
    expect(screen.queryByText(/：裏向きのポケモン|：エビワラー/)).toBeNull();
    expect(within(document.body).getAllByRole("radio", { name: /基本闘エネルギー PMCG1-102/ })).toHaveLength(2);
  });

  it("観戦者の観測（viewer なし）では、持ち主をプレイヤーの名前で書く", () => {
    const o = obs(null, { active: slot(1, "エビワラー", [E(10)]), bench: [] }, { active: slot(2, "エビワラー", []), bench: [] });
    expect(attachedTo(option("o", 10), o)).toBe("プレイヤー0のバトル場：エビワラー");
  });
});
