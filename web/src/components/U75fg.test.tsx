// U7-5f・g（v0.172）の検証と画面（模擬の応答。形は test/u75fg.ts。実エンジンとの確認は e2e/u75fg.spec.ts と server/tests/test_u7_5fg.py）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage, LegalActions } from "../api/types";
import * as V from "../api/validate";
import { cand, candidates, inputs, observation, player, pokemon, RESIDUAL_CLASSES_V172 } from "../test/fixtures";
import { RETREAT_STAGES } from "../test/u73";
import {
  BLAINE_ATTACH,
  BLAINE_STAGES,
  COVERAGE_MAIN,
  COVERAGE_SPY,
  COVERAGE_WAITING_R4,
  COVERAGE_WITHHELD,
  FACE_UP,
  FACE_UP_STAGES,
  SPY,
  WITHHELD_FACE_DOWN,
} from "../test/u75fg";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { DecisionPanel, downstreamOf } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

const NAMES: Record<string, string> = { "PMCG1-098": "炎エネルギー", "PMCG6-027": "カツラのガーディ", "PMCG1-014": "ヒトカゲ", "PMCG2-028": "マンキー", "PMCG4-012": "ヒトカゲ" };
const OBS = (() => {
  const p0 = player(0, { handCards: [], active: pokemon(1, "カツラのガーディ", { card_id: "PMCG6-027" }) });
  p0.bench = [{ pokemon_id: 3, face_down: true, damage: 0, energy: [], real: { card: 0, card_id: "PMCG2-028" } } as never];
  return observation(0, [p0, player(1, { handCards: null })]);
})();

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const parseInputs = (kind: string, stages: unknown) => V.inputsResponse(inputs(kind, stages as InputStage[]));
const parseCandidates = (list: Candidate[], coverage: unknown) => V.candidatesResponse(candidates("r1", list, { coverage })).response;

function setup(candidate: Candidate, stages: InputStage[], extra: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const onInputChange = vi.fn();
  const parsed = V.inputsResponse(inputs(candidate.kind, stages, extra));
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
      onInputChange={onInputChange}
    />
  );
  const view = render(ui(null));
  /** session が今の入力への check の答え（通った）を置いたときの描画。 */
  const passed = (choices: string[]) => view.rerender(ui({ choices: choicesKey(choices), response: { valid: true, refusal: null } }));
  return { onSubmit, onCheck, onInputChange, passed, user: userEvent.setup() };
}

const send = () => screen.getByRole("button", { name: "送信" });

const stage = (n: number) => screen.getAllByRole("group")[n - 1]!;

describe("経路で引く段（options_by_path）の検証", () => {
  it("実応答の形は通り、3 段目は path_stages と組で持つ", () => {
    expect(() => parseInputs("attach_energy", BLAINE_STAGES)).not.toThrow();
    expect(downstreamOf(BLAINE_STAGES, 1)).toEqual(new Set([2, 3]));
    expect(downstreamOf(BLAINE_STAGES, 2)).toEqual(new Set([3]));
  });

  const broken: [string, (s: Record<string, any>[]) => void][] = [
    ["知らない鍵（1 段目にない番号）", (s) => (s[2]!.options_by_path["o9/o3"] = [{ option: "o5", eligible: true, processability: "may_stop_later" }])],
    ["鍵の段の数が違う", (s) => (s[2]!.options_by_path["o1"] = [{ option: "o5", eligible: true, processability: "may_stop_later" }])],
    ["2 段目の組にない前の段の組", (s) => { s[1]!.options_by_choice.o1 = [{ option: "o4", eligible: true, processability: "may_stop_later" }]; }],
    ["存在しない参照", (s) => (s[2]!.options_by_path["o1/o3"] = [{ option: "o7", eligible: true, processability: "may_stop_later" }])],
    ["参照の重なり", (s) => s[2]!.options_by_path["o1/o3"].push({ option: "o6", eligible: true, processability: "may_stop_later" })],
    ["逆の並び", (s) => (s[2]!.path_stages = [2, 1])],
    ["自分を指す（循環）", (s) => (s[2]!.path_stages = [1, 3])],
    ["空の path_stages", (s) => (s[2]!.path_stages = [])],
    ["options_by_choice との併用", (s) => (s[2]!.options_by_choice = { o1: [] })],
    ["depends_on_stage との併用", (s) => (s[2]!.depends_on_stage = 2)],
    ["upstream_stages との併用", (s) => (s[2]!.upstream_stages = [1, 2])],
    ["options_by_path がない", (s) => delete s[2]!.options_by_path],
    ["count が 0〜1 でない", (s) => (s[2]!.count = { min: 1, max: 1 })],
    ["decline がない", (s) => delete s[2]!.decline],
    ["role の並びが違う", (s) => (s[2]!.role = "energy")],
    ["知らない energy2 の項目", (s) => (s[2]!.options[0].pokemon = 1)],
  ];
  for (const [name, mutate] of broken) {
    it(`不明な応答として止める: ${name}`, () => {
      const s = clone(BLAINE_STAGES) as unknown as Record<string, any>[];
      mutate(s);
      expect(() => parseInputs("attach_energy", s)).toThrow(V.ProtocolError);
    });
  }

  it("経路で引く段は attach_energy の 3 段目だけ（ほかの種類・ほかの段に来たら止める）", () => {
    const retreat = clone(RETREAT_STAGES) as unknown as Record<string, any>[];
    retreat.push({ ...clone(BLAINE_STAGES[2]), stage: retreat.length + 1 });
    expect(() => parseInputs("retreat", retreat)).toThrow(V.ProtocolError);
  });
});

describe("attach_energy の任意の 3 段目（カツラの 2 枚目）", () => {
  it("今の 1・2 段目の鍵の一覧だけを出し、上流を変えたら 3 段目と検査の結果を捨てる。送る順は段の順", async () => {
    const { user, onSubmit, onInputChange, passed } = setup(BLAINE_ATTACH, BLAINE_STAGES);
    expect(screen.getByText(/カツラの効果で、3 段目に 2 枚目のエネルギーカードを選べます/)).toBeInTheDocument();
    expect(within(stage(3)).getByText(/段 1・2 を選ぶと、その組でエンジンが示したものだけ/)).toBeInTheDocument();
    await user.click(within(stage(1)).getAllByRole("radio")[0]!); // o1
    await user.click(within(stage(2)).getByRole("radio", { name: /PMCG6-027/ })); // o3
    expect(within(stage(3)).getAllByRole("radio").map((r) => r.closest("li")?.textContent)).toEqual([expect.stringContaining("選ばない"), expect.stringContaining("o6")]);
    await user.click(within(stage(3)).getByRole("radio", { name: /PMCG1-098/ }));
    expect(send()).toBeDisabled(); // 2 枚: check の前は送れない（GUI の方針）
    passed(["o1", "o3", "o6"]);
    await user.click(send());
    expect(onSubmit).toHaveBeenLastCalledWith(["o1", "o3", "o6"]);
    const changes = onInputChange.mock.calls.length;
    await user.click(within(stage(1)).getAllByRole("radio")[1]!); // 1 段目を o2 に変える → 2・3 段目を捨てる
    expect(onInputChange.mock.calls.length).toBeGreaterThan(changes); // 前の検査の結果・届いていない答えを捨てる知らせ
    expect(within(stage(3)).getByText(/段 1・2 を選ぶと/)).toBeInTheDocument();
    await user.click(within(stage(2)).getByRole("radio", { name: /PMCG6-027/ }));
    const third = within(stage(3)).getAllByRole("radio");
    expect(third.map((r) => r.closest("li")?.textContent)).toEqual([expect.stringContaining("選ばない"), expect.stringContaining("o5")]);
    expect(third[0]).toBeChecked(); // 3 段目の前の選択（o6）は残らない
    expect(send()).toBeDisabled(); // [o1, o3, o6] への答えは今の入力 [o2, o3] に使わない
    passed(["o2", "o3"]);
    await user.click(send());
    expect(onSubmit).toHaveBeenLastCalledWith(["o2", "o3"]); // 3 段目を選ばない: 今までどおり 1 枚
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("鍵がない組（ベンチのつけ先）では 3 段目を選べず、1 枚で送れる（check の前は送れない）", async () => {
    const { user, onSubmit, passed } = setup(BLAINE_ATTACH, BLAINE_STAGES);
    await user.click(within(stage(1)).getAllByRole("radio")[0]!);
    await user.click(within(stage(2)).getByRole("radio", { name: /PMCG1-014/ }));
    expect(within(stage(3)).getByText(/この段に選べるものがありません/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled(); // 無効のボタンを押しても送らない
    passed(["o1", "o4"]);
    await user.click(send());
    expect(onSubmit).toHaveBeenLastCalledWith(["o1", "o4"]);
  });
});

describe("attach_energy の送る前の check（GUI の方針。1 枚・2 枚とも）", () => {
  // 3 段目の選べるものが 2 つある組（2 枚目を変えられる）
  const TWO_SECOND = (() => {
    const s = clone(BLAINE_STAGES) as unknown as Record<string, any>[];
    s[2]!.options.push({ id: "o7", card: 60, card_id: "PMCG1-098", special: false, eligible: true, processability: "may_stop_later" });
    s[2]!.options_by_path["o1/o3"].push({ option: "o7", eligible: true, processability: "may_stop_later" });
    return s as unknown as InputStage[];
  })();

  it("2 枚目を省く・選ぶ・変える・外すたびに、今の入力への check が通るまで送れない", async () => {
    const { user, onSubmit, onInputChange, passed } = setup(BLAINE_ATTACH, TWO_SECOND);
    await user.click(within(stage(1)).getAllByRole("radio")[0]!); // o1
    await user.click(within(stage(2)).getByRole("radio", { name: /PMCG6-027/ })); // o3
    expect(send()).toBeDisabled(); // energy2 の段がある候補で 2 枚目を省く: check の前は送れない
    passed(["o1", "o3"]);
    expect(send()).toBeEnabled(); // 今の入力 [o1, o3] への check が通った
    const before = onInputChange.mock.calls.length;
    const option = (id: string) => within(stage(3)).getAllByRole("radio").find((r) => r.closest("li")?.textContent?.includes(id))!;
    await user.click(option("o6")); // 2 枚目を選ぶ
    expect(send()).toBeDisabled();
    passed(["o1", "o3", "o6"]);
    expect(send()).toBeEnabled();
    await user.click(option("o7")); // 2 枚目を変える
    expect(send()).toBeDisabled();
    passed(["o1", "o3", "o7"]);
    expect(send()).toBeEnabled();
    await user.click(within(stage(3)).getByRole("radio", { name: "選ばない" })); // 2 枚目を外す
    expect(send()).toBeDisabled();
    expect(onInputChange.mock.calls.length).toBe(before + 3); // 選ぶ・変える・外すのたびに session へ知らせる（前の答えと届いていない答えを捨てる）
    passed(["o1", "o3", "o7"]);
    expect(send()).toBeDisabled(); // 前の入力への答えは使わない
    passed(["o1", "o3"]);
    await user.click(within(stage(2)).getByRole("radio", { name: /PMCG1-014/ })); // 2 段目（つけ先）を変える
    expect(send()).toBeDisabled();
    passed(["o1", "o4"]);
    await user.click(within(stage(1)).getAllByRole("radio")[1]!); // 1 段目を変える
    expect(send()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("check の前は、送る前に検査する旨を示し、押しても送らない", async () => {
    const { user, onSubmit } = setup(BLAINE_ATTACH, BLAINE_STAGES);
    await user.click(within(stage(1)).getAllByRole("radio")[0]!);
    await user.click(within(stage(2)).getByRole("radio", { name: /PMCG6-027/ }));
    expect(screen.getByText(/送る前に「入力を検査」で今の入力をエンジンに確かめます/)).toBeInTheDocument();
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("check_face_up_deck（表示だけ）", () => {
  it("検証: 表示だけの種類と coverage の整合・owner と position だけ・送れない区分", () => {
    expect(() => parseCandidates([FACE_UP], COVERAGE_MAIN)).not.toThrow();
    expect(() => parseCandidates([FACE_UP], { ...COVERAGE_MAIN, display_only_kinds: [] })).toThrow(V.ProtocolError);
    expect(() => parseCandidates([{ ...FACE_UP, processability: "may_stop_later" }], COVERAGE_MAIN)).toThrow(V.ProtocolError);
    expect(() => parseCandidates([], { ...COVERAGE_MAIN, display_only_kinds: ["future_display"] })).toThrow(V.ProtocolError);
    expect(() => parseInputs("check_face_up_deck", FACE_UP_STAGES)).not.toThrow();
    const withCard = clone(FACE_UP_STAGES) as unknown as Record<string, any>[];
    withCard[0]!.options[0].card_id = "PMCG1-098";
    expect(() => parseInputs("check_face_up_deck", withCard)).toThrow(V.ProtocolError);
    const top = clone(FACE_UP_STAGES) as unknown as Record<string, any>[];
    top[0]!.options[0].position = 0;
    expect(() => parseInputs("check_face_up_deck", top)).toThrow(V.ProtocolError);
    const eligible = clone(FACE_UP_STAGES) as unknown as Record<string, any>[];
    eligible[0]!.options[0].eligible = true;
    expect(() => parseInputs("check_face_up_deck", eligible)).toThrow(V.ProtocolError);
  });

  it("候補は「表示だけ」で、位置の表示には検査・送信のボタンがない。カード ID・名前・画像を出さない", async () => {
    const onSelect = vi.fn();
    render(<CandidatesPanel legal={parseCandidates([FACE_UP], COVERAGE_MAIN)} selectedId={null} disabled={false} onSelect={onSelect} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("表向きの山札のカードを確かめる"))!;
    expect(item).toHaveTextContent("表示だけ（送れません）");
    expect(item).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(within(item).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
    await userEvent.setup().click(within(item).getByRole("button", { name: "位置を表示する（表示だけ）" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c9" }));
  });

  it("位置は「相手の山札・上から n 枚目」と内部の 0 始まりの値を並べて出す", () => {
    const { onCheck, onSubmit } = setup(FACE_UP, FACE_UP_STAGES);
    const list = screen.getByLabelText("おもての山札の位置");
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("相手（プレイヤー1）の山札・上から 2 枚目");
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("owner: 1・position: 1（0 がいちばん上）");
    expect(screen.getByText(/未裁定・FU2/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "入力を検査" })).toBeNull();
    expect(screen.queryByRole("button", { name: "送信" })).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/PMCG|card-face|<img/);
    expect(onCheck).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("本人のうらのカードの特殊能力", () => {
  it("検証: うらの pokemon にカード ID があれば止め、pokemon と power の face_down が合わなければ止める", () => {
    expect(() => parseCandidates([SPY], COVERAGE_SPY)).not.toThrow();
    expect(() => parseCandidates([{ ...SPY, pokemon: { ...SPY.pokemon!, card_id: "PMCG2-028" } }], COVERAGE_SPY)).toThrow(V.ProtocolError);
    const { face_down: _fd, ...power } = SPY.power!;
    expect(() => parseCandidates([{ ...SPY, power }], COVERAGE_SPY)).toThrow(V.ProtocolError);
  });

  it("盤面の情報（裏向き・場所）と本人が知る本当のカードを分け、unverified を受理の保証にしない。入力なしは choices []", async () => {
    const { user, onCheck } = setup(SPY, []);
    const info = screen.getByLabelText("特殊能力");
    expect(info).toHaveTextContent("使うポケモン: 自分の裏向きのポケモン（ベンチ1。盤面ではうらのまま）");
    expect(info).toHaveTextContent("あなただけが知る本当のカード（印刷の情報）: マンキー PMCG2-028");
    expect(info).toHaveTextContent("「未確認」は使える・受理されるという意味ではありません");
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled(); // 送る前に check
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith([]);
  });

  it("入力を返さない候補（2 段の型）は入力非公開で、検査・送信できない", () => {
    setup(WITHHELD_FACE_DOWN, [], { withheld: { code: "INPUT_BOUNDARY_UNCONFIRMED", message: "未確認" } });
    expect(screen.getByRole("status")).toHaveTextContent("入力非公開");
    expect(screen.queryByRole("button", { name: "入力を検査" })).toBeNull();
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
  });

  it("候補の一覧: 裏向きの場所と、本人が知るカードを分けて書く", () => {
    render(<CandidatesPanel legal={parseCandidates([SPY], COVERAGE_SPY)} selectedId={null} disabled={false} onSelect={() => undefined} />);
    expect(screen.getByText(/［スパイ］/).closest("p")).toHaveTextContent("裏向きのポケモン（ベンチ1）・あなただけが知るカード PMCG2-028");
  });
});

describe("coverage の残り（residual）", () => {
  const legal = (list: Candidate[], coverage: unknown, extra: Partial<LegalActions> = {}) => ({ ...parseCandidates(list, coverage), ...extra });

  it("検証: 項目の表・分類・present の scope・complete の矛盾", () => {
    const broken: Record<string, unknown>[] = [
      { ...COVERAGE_MAIN, future_axis: [] },
      { ...COVERAGE_MAIN, residual: { classes: RESIDUAL_CLASSES_V172.map((c) => (c.id === "R-2" ? { ...c, status: "input_withheld" } : c)), present: [] } },
      { ...COVERAGE_MAIN, residual: { classes: [...RESIDUAL_CLASSES_V172, { ...RESIDUAL_CLASSES_V172[0], id: "R-9" }], present: [] } },
      { ...COVERAGE_MAIN, residual: { classes: RESIDUAL_CLASSES_V172, present: [{ id: "R-3", scope: "actor" }] } },
      { ...COVERAGE_MAIN, residual: { classes: RESIDUAL_CLASSES_V172, present: [{ id: "R-4", scope: "public", candidate: "c1" }] } },
      { ...COVERAGE_MAIN, residual: { classes: RESIDUAL_CLASSES_V172, present: [{ id: "R-3", scope: "actor", candidate: "c404" }] } },
      { ...COVERAGE_MAIN, residual: { classes: RESIDUAL_CLASSES_V172, present: [{ id: "R-7", scope: "public" }] } },
      { ...COVERAGE_MAIN, partial_residual: ["R-4"] },
      { ...COVERAGE_MAIN, completeness: "complete" },
      { ...COVERAGE_MAIN, unverified_paths: [{ reason: "face_down_reveal_not_evaluated", candidates: ["c404"] }] },
    ];
    for (const c of broken) expect(() => parseCandidates([], c)).toThrow(V.ProtocolError);
  });

  it("MAIN: not_covered_kinds が空でも全部に対応・完走と書かず、表示だけの種類と示さない経路（R-2）を分ける", () => {
    render(<CandidatesPanel legal={legal([cand("end_turn", "may_stop_later", { input_disclosure: "no_input", input_stages: [] })], COVERAGE_MAIN)} selectedId={null} disabled={false} onSelect={() => undefined} />);
    expect(screen.getByLabelText("表示だけの種類")).toHaveTextContent("表向きの山札のカードを確かめる（未裁定。ゲーム上の禁止ではない）");
    expect(screen.getByLabelText("示していない経路")).toHaveTextContent("R-2");
    expect(screen.getByLabelText("当てはまる残り")).toHaveTextContent("なし");
    expect(screen.queryByLabelText("未対応の操作")).toBeNull();
    expect(screen.getByText(/全部の操作に対応した・必ず完走するという意味ではありません/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/全操作に対応|必ず完走します/);
  });

  it("番でない主体の R-4: 候補がなくても「操作がない」と言わず、API の対象範囲外として出す", () => {
    render(
      <CandidatesPanel
        legal={legal([], COVERAGE_WAITING_R4, { situation: "waiting_for_player", empty_reason: "kinds_not_covered" })}
        selectedId={null}
        disabled={false}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/候補がなくても「操作がない」とは言えません/)).toBeInTheDocument();
    expect(screen.getByLabelText("当てはまる残り")).toHaveTextContent("R-4（API の対象範囲外・公開の状態から）");
    expect(screen.getByLabelText("未対応の操作")).toHaveTextContent("「操作がない」という意味でもありません");
  });

  it("本人の残り（R-3・actor）は候補の id とともに出し、入力を返さない候補と未確認の経路を分ける", () => {
    render(<CandidatesPanel legal={legal([WITHHELD_FACE_DOWN], COVERAGE_WITHHELD)} selectedId={null} disabled={false} onSelect={() => undefined} />);
    expect(screen.getByLabelText("当てはまる残り")).toHaveTextContent("R-3（入力を返していない・あなたの候補 c5）");
    expect(screen.getByLabelText("入力を返していない候補")).toHaveTextContent("c5（入力非公開。送れません）");
    expect(screen.getByLabelText("未確認の経路")).toHaveTextContent("なし");
  });
});
