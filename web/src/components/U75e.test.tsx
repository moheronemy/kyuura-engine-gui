// U7-5e の特殊能力の候補・0〜3 段の宣言の入力・依存する段（模擬の応答。形は test/u75e.ts。実エンジンとの確認は e2e/u75e.spec.ts と server/tests/test_u7_5e.py）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { candidates, inputs, observation, player, pokemon } from "../test/fixtures";
import { RETREAT_STAGES } from "../test/u73";
import {
  CURSE,
  CURSE_STAGES,
  DISCARD_DECISION_STAGES,
  KADABRA,
  ROCKET,
  ROCKET_STAGES,
  TRANS,
  TRANS_STAGES,
  TRANS_TWO_SOURCES_STAGES,
  WITHHELD_POWER,
  power,
} from "../test/u75e";
import { DecisionPanel, downstreamOf } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

const NAMES: Record<string, string> = {
  "PMCG4-012": "ヒトカゲ",
  "PMCG1-016": "ポニータ",
  "PMCG1-060": "コラッタ",
  "PMCG1-098": "炎エネルギー",
  "PMCG1-011": "フシギバナ",
  "PMCG1-001": "フシギダネ",
  "PMCG1-097": "草エネルギー",
  "PMCG4-034": "ダークユンゲラー",
  "PMCG3-005": "ゲンガー",
  "PMCG1-050": "ゴース",
};

// プレイヤー0の場: 1 番（バトル場）・3 番（ベンチ）。相手の場: 20 番（バトル場）・21 番（ベンチのうらのカード）
const OBS = (() => {
  const p0 = player(0, { handCards: [], active: pokemon(1, "フシギバナ", { card_id: "PMCG1-011" }) });
  p0.bench = [pokemon(3, "フシギダネ", { card_id: "PMCG1-001" }) as never];
  const p1 = player(1, { handCards: null, active: pokemon(20, "ゴース", { card_id: "PMCG1-050" }) });
  p1.bench = [{ pokemon_id: 21, face_down: true, damage: 0, energy: [] } as never];
  return observation(0, [p0, p1]);
})();

function setup(candidate: Candidate, stages: InputStage[], opts: { check?: CheckResult | null; extra?: Record<string, unknown> } = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs(candidate.kind, stages, opts.extra));
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={0}
      observation={OBS}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
  const view = render(ui(opts.check ?? null));
  return { onSubmit, onCheck, user: userEvent.setup(), container: view.container, rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)) };
}

const stage = (n: number) => screen.getAllByRole("group")[n - 1]!;
const send = () => screen.getByRole("button", { name: "送信" });
const valid = (choices: string[]): CheckResult => ({ choices: choicesKey(choices), response: { valid: true, refusal: null } });
const clone = (stages: InputStage[]) => JSON.parse(JSON.stringify(stages)) as Record<string, unknown>[];
const opts = (s: Record<string, unknown>[], n: number) => s[n]!.options as Record<string, unknown>[];
const ok = (stages: unknown, kind = "use_power") => V.inputsResponse(inputs(kind, stages as InputStage[]));
const radios = (n: number) => within(stage(n)).queryAllByRole("radio");

describe("実行時の検証（U7-5e の段と依存）", () => {
  it("実応答の形（入力なし・2 段・3 段）と文書の形（元が 2 匹の 3 段・相手の場のうらのカード）を受け付ける", () => {
    for (const s of [[], ROCKET_STAGES, TRANS_STAGES, TRANS_TWO_SOURCES_STAGES, CURSE_STAGES]) expect(() => ok(s)).not.toThrow();
  });

  it.each([
    ["選べるものの after が組と合わない", TRANS_STAGES, (s: Record<string, unknown>[]) => (opts(s, 2)[0]!.after = "o3")],
    ["2 段目以降の選べるものに after がない", TRANS_STAGES, (s: Record<string, unknown>[]) => delete opts(s, 1)[0]!.after],
    ["upstream_stages が前のすべての段でない", TRANS_STAGES, (s: Record<string, unknown>[]) => (s[2]!.upstream_stages = [2])],
    ["depends_on_stage が直前の段でない", TRANS_STAGES, (s: Record<string, unknown>[]) => (s[2]!.depends_on_stage = 1)],
    ["upstream_stages がない（2 段目）", ROCKET_STAGES, (s: Record<string, unknown>[]) => delete s[1]!.upstream_stages],
    ["組が別の上流の番号を指す", TRANS_STAGES, (s: Record<string, unknown>[]) => ((s[2]!.options_by_choice as Record<string, unknown[]>).o2 = [{ option: "o6", eligible: true, processability: "may_stop_later" }])],
    ["知らない role の並び", ROCKET_STAGES, (s: Record<string, unknown>[]) => (s[0]!.role = "target")],
    ["meaning が role と合わない", ROCKET_STAGES, (s: Record<string, unknown>[]) => (s[1]!.meaning = "pokemon")],
    ["任意の段（0〜1 を選ぶ）", ROCKET_STAGES, (s: Record<string, unknown>[]) => (s[1]!.count = { min: 0, max: 1 })],
    ["知らない項目", ROCKET_STAGES, (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.energy_count = 1)],
    ["相手のうらのポケモンにカード ID", CURSE_STAGES, (s: Record<string, unknown>[]) => (opts(s, 0)[1]!.card_id = "PMCG1-014")],
    ["カードの選べるものに場のポケモンの項目", ROCKET_STAGES, (s: Record<string, unknown>[]) => (opts(s, 1)[0]!.zone = "active")],
  ])("知らない・不正な依存の形は止める: %s", (_name, stages, mutate) => {
    const s = clone(stages);
    mutate(s);
    expect(() => ok(s)).toThrow(V.ProtocolError);
  });

  it("依存の形（upstream_stages・after）と role の source は、ほかの種類の段に来たら止める", () => {
    const s = clone(RETREAT_STAGES);
    s[1]!.upstream_stages = [1];
    expect(() => ok(s, "retreat")).toThrow(V.ProtocolError);
    const r = clone(RETREAT_STAGES);
    r[0]!.role = "source";
    expect(() => ok(r, "retreat")).toThrow(V.ProtocolError);
    expect(() => ok(RETREAT_STAGES, "retreat")).not.toThrow(); // 既存の 2 段はそのまま
  });

  it("候補の pokemon・power は use_power だけで、形を確かめる", () => {
    const parse = (c: unknown) => V.candidatesResponse(candidates("r", [c as Candidate]));
    expect(() => parse(TRANS)).not.toThrow();
    expect(() => parse({ ...TRANS, kind: "use_attack" })).toThrow(V.ProtocolError);
    expect(() => parse({ ...TRANS, power: { ...TRANS.power, text: "x" } })).toThrow(V.ProtocolError);
    expect(() => parse({ ...TRANS, pokemon: { pokemon: 1, card: 9, zone: "active", face_down: true } })).toThrow(V.ProtocolError);
  });
});

describe("特殊能力の候補（同じ種類がいくつも並ぶ）", () => {
  it("候補ごとに特殊能力の名前と使うポケモンを出し、id で選ぶ", async () => {
    const onSelect = vi.fn();
    const legal = V.candidatesResponse(candidates("r", [TRANS, power("c7", "エナジートランス", { pokemon: 3, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-011" }, 3)])).response;
    render(<CandidatesPanel legal={legal} selectedId={null} disabled={false} onSelect={onSelect} />);
    const items = screen.getAllByRole("listitem").filter((li) => li.closest(".candidate-list"));
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("［エナジートランス］ — PMCG1-011（バトル場）");
    expect(items[1]).toHaveTextContent("［エナジートランス］ — PMCG1-011（ベンチ1）");
    await userEvent.setup().click(within(items[1]!).getByRole("button", { name: "この操作を選ぶ" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c7", kind: "use_power" }));
  });
});

describe("宣言の入力（0〜3 段）", () => {
  it("入力なし: choices [] の check のあとに送る。決定は受理のあと", async () => {
    const { user, onCheck, onSubmit, rerenderWithCheck } = setup(KADABRA, []);
    expect(screen.getByLabelText("特殊能力")).toHaveTextContent("特殊能力: ［ぶっしつこうかん］");
    expect(screen.getByText(/この特殊能力に宣言といっしょに選ぶものはありません/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith([]);
    rerenderWithCheck(valid([]));
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("2 段: 元を選ぶまで後の段は選べず、元に続くエネルギーだけを出す。元を変えると後の段の選択を捨てる", async () => {
    const { user, onCheck } = setup(ROCKET, ROCKET_STAGES);
    expect(radios(2)).toHaveLength(0);
    expect(within(stage(2)).getByText(/段 1 を選ぶと/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /ポニータ PMCG1-016（自分のバトル場）/ }));
    expect(radios(2).map((r) => r.closest("li")!.querySelector("code")!.textContent)).toEqual(["o3"]);
    await user.click(radios(2)[0]!);
    await user.click(screen.getByRole("radio", { name: /コラッタ PMCG1-060/ }));
    expect(radios(2).map((r) => r.closest("li")!.querySelector("code")!.textContent)).toEqual(["o4"]);
    expect(radios(2)[0]).not.toBeChecked(); // 前の元の選択（o3）は捨てた
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o2"]); // 別の上流の番号（o3）を混ぜない
  });

  it("3 段: 1 段目を変えると 2 段目と 3 段目を捨て、2 段目を変えると 3 段目だけを捨てる。前の check は使わない", async () => {
    const { user, onCheck, rerenderWithCheck } = setup(TRANS, TRANS_TWO_SOURCES_STAGES);
    const code = (n: number) => radios(n).map((r) => r.closest("li")!.querySelector("code")!.textContent);
    await user.click(screen.getByRole("radio", { name: /フシギバナ PMCG1-011（自分のバトル場）/ }));
    expect(code(2)).toEqual(["o3", "o4"]);
    expect(radios(3)).toHaveLength(0);
    await user.click(radios(2)[0]!); // o3
    expect(code(3)).toEqual(["o6"]);
    await user.click(radios(3)[0]!);
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o1", "o3", "o6"]);
    rerenderWithCheck(valid(["o1", "o3", "o6"]));
    expect(send()).toBeEnabled();
    await user.click(radios(2)[1]!); // 2 段目を o4 に変える → 3 段目は o7 だけ、選択なし
    expect(code(3)).toEqual(["o7"]);
    expect(radios(3)[0]).not.toBeChecked();
    expect(send()).toBeDisabled();
    expect(screen.getByText("入力を変えたので、前の検査の結果は使いません。")).toBeInTheDocument();
    await user.click(radios(3)[0]!);
    await user.click(screen.getAllByRole("radio")[1]!); // 1 段目をベンチのフシギダネ（o2）に変える
    expect(code(2)).toEqual(["o5"]);
    expect(radios(2)[0]).not.toBeChecked();
    expect(radios(3)).toHaveLength(0); // 3 段目は 2 段目を選ぶまで出ない（前の o7 を残さない）
    expect(downstreamOf(TRANS_TWO_SOURCES_STAGES, 1)).toEqual(new Set([2, 3]));
    expect(downstreamOf(TRANS_TWO_SOURCES_STAGES, 2)).toEqual(new Set([3]));
    expect(downstreamOf(TRANS_TWO_SOURCES_STAGES, 3)).toEqual(new Set());
  });

  it("相手のうらのカードは位置と裏面だけ（カード ID・名前・表の画像を補わない）。unverified でも送れる", () => {
    const { container } = setup(CURSE, CURSE_STAGES);
    const back = screen.getByRole("radio", { name: /相手の裏向きのポケモン（ベンチ1）/ });
    const row = back.closest("li")!;
    expect(within(row).getByLabelText("裏向きのポケモン")).toBeInTheDocument();
    expect(back).toBeEnabled();
    expect(row).toHaveTextContent("未確認");
    expect(screen.getByRole("radio", { name: /ゴース PMCG1-050（相手のバトル場）/ })).toBeInTheDocument();
    expect(container.querySelectorAll("canvas").length).toBe(0);
  });

  it("宣言のない型（入力非公開）は選べるものを出さず、送れない", () => {
    setup(WITHHELD_POWER, [], { extra: { withheld: { code: "INPUT_BOUNDARY_UNCONFIRMED", message: "入力の情報境界が未確認" } } });
    expect(screen.getByRole("status")).toHaveTextContent("入力非公開（input_disclosure）: エンジンが入力の情報境界を確かめていないため");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(send()).toBeDisabled();
  });

  it("受理のあとの決定（手札のカードを選ぶ）は既存の決定の入力で答える", async () => {
    const answer = { ...KADABRA, kind: "answer_decision", id: "c1", input_disclosure: "confirmed", input_stages: [{ stage: 1, input: "choose_option" }] } as Candidate;
    const { user, onSubmit } = setup(answer, DISCARD_DECISION_STAGES);
    expect(screen.queryByRole("radio", { name: "選ばない" })).toBeNull(); // 辞退できない決定
    await user.click(screen.getAllByRole("radio")[0]!);
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1"]);
  });
});
