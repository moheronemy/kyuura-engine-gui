// 0.186.0（開発用の規約集合 CS-KYUURA-PLAY-TR3@1）の、規約による除外の選べるもの（eligible: false・convention・processability なし）の実行時検証と入力の画面（components/DecisionPanel.tsx）。
// 出典: 「実応答」は test/tr3.ts（導入した 0.186.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は実応答を写して項目を変えたもの（出典を分けた。エンジンが出す値ではない）。エンジンの条件（ベンチ・ダメージ）を GUI で判定しないことは、表示が応答の項目だけで決まることで確かめる。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputsResponse } from "../api/types";
import * as V from "../api/validate";
import { cand, inputs } from "../test/fixtures";
import * as T from "../test/tr3";
import { DecisionPanel } from "./DecisionPanel";

const clone = <X,>(v: X): X => JSON.parse(JSON.stringify(v)) as X;
type Board = { candidates: unknown; inputs: unknown; checks: Record<string, unknown> };
const BOARDS: Record<string, Board> = {
  tr3_gust: T.TR3_GUST,
  cur_gust: T.CUR_GUST,
  tr3_gust_target: T.TR3_GUST_TARGET,
  tr3_switch: T.TR3_SWITCH,
  cur_switch: T.CUR_SWITCH,
  tr3_switch_target: T.TR3_SWITCH_TARGET,
  tr3_potion: T.TR3_POTION,
  cur_potion: T.CUR_POTION,
  tr3_potion_target: T.TR3_POTION_TARGET,
  tr3_mixed: T.TR3_MIXED,
  cur_mixed: T.CUR_MIXED,
  tr3_all_excluded: T.TR3_ALL_EXCLUDED,
} as unknown as Record<string, Board>;
const NAMES: Record<string, string> = { "PMCG1-072": "突風", "PMCG1-073": "ポケモンいれかえ", "PMCG1-071": "きずぐすり" };
const CONVENTION = { gust: "PC-GUST-WITHOUT-OPPONENT-BENCH@1", switch: "PC-SWITCH-WITHOUT-BENCH@1", potion: "PC-POTION-WITHOUT-DAMAGE@1" } as const;

type Raw = { response: { stages: { options: Record<string, unknown>[] }[]; kind: string } };
const rawInputs = (b: string) => clone(BOARDS[b]!.inputs) as Raw;
const trainerCandidate = (b: string): Candidate => {
  const parsed = V.candidatesResponse(clone(BOARDS[b]!.candidates));
  return parsed.response.candidates.find((c) => c.kind === "play_trainer")!;
};

function setup(candidate: Candidate, parsed: InputsResponse) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  render(
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check: null }}
      observation={null}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />,
  );
  return { onSubmit, onCheck, user: userEvent.setup() };
}
const renderBoard = (b: string) => setup(trainerCandidate(b), V.inputsResponse(rawInputs(b)));
const panel = () => screen.getByRole("region", { name: /^入力/ });
const optionItem = (name: string) => within(panel()).getAllByRole("listitem").find((li) => li.querySelector("label.option")?.textContent?.includes(name))!;

describe("実行時検証（実応答 12 盤面）", () => {
  it("候補と入力はすべて通り、規約による除外は eligible: false・convention・processability なしの形だけ", () => {
    for (const [b, board] of Object.entries(BOARDS)) {
      const candidate = trainerCandidate(b);
      expect(candidate.kind, b).toBe("play_trainer");
      const parsed = V.inputsResponse(clone(board.inputs));
      const options = ("stages" in parsed.response ? parsed.response.stages : []).flatMap((s) => (s.input === "choose_option" ? (s.options ?? []) : []));
      for (const o of options) {
        if ("convention" in o) expect([o.eligible, "processability" in o, "reasons" in o], b).toEqual([false, false, false]);
        else expect(typeof o.processability, b).toBe("string");
      }
      expect(options.some((o) => "convention" in o), b).toBe(b.startsWith("tr3_") && !b.endsWith("_target"));
    }
  });
});

describe("実行時検証の負の場合（人工: 実応答を写して変えた。知らない意味として止める）", () => {
  const broken: [string, (o: Record<string, unknown>) => void][] = [
    ["規約による除外に processability", (o) => (o.processability = "not_implemented")],
    ["規約による除外が eligible: true", (o) => (o.eligible = true)],
    ["規約による除外に eligible がない", (o) => delete o.eligible],
    ["規約による除外に reasons", (o) => (o.reasons = ["no_eligible_card"])],
    ["convention が数", (o) => (o.convention = 1)],
    ["convention が null", (o) => (o.convention = null)],
    ["convention に版がない", (o) => (o.convention = "PC-GUST-WITHOUT-OPPONENT-BENCH")],
    ["convention の版が 0", (o) => (o.convention = "PC-GUST-WITHOUT-OPPONENT-BENCH@0")],
    ["convention がない・processability もない", (o) => delete o.convention],
  ];
  it.each(broken)("%s は ProtocolError", (_name, mutate) => {
    const raw = rawInputs("tr3_mixed");
    mutate(raw.response.stages[0]!.options[0]!);
    expect(() => V.inputsResponse(raw)).toThrow(V.ProtocolError);
  });

  it("手札のトレーナーでない種類の選べるものに convention が来たら止める", () => {
    const stage = { stage: 1, input: "choose_option", meaning: "position", count: { min: 1, max: 1 }, order: "not_applicable",
      options: [{ id: "o1", value: 0, eligible: false, convention: "PC-GUST-WITHOUT-OPPONENT-BENCH@1" }] };
    expect(() => V.inputsResponse(inputs("take_prize", [stage as never]))).toThrow(/規約による除外/);
  });

  it("知らない項目は今までどおり止める（convention を足しても一括で許可しない）", () => {
    const raw = rawInputs("tr3_mixed");
    raw.response.stages[0]!.options[2]!.unknown_key = 1;
    expect(() => V.inputsResponse(raw)).toThrow(V.ProtocolError);
  });
});

describe("規約による使用不可の表示と選べなさ（実応答）", () => {
  it.each(["gust", "switch", "potion"] as const)("TR3・対象なし（%s）: 選べるものに残し「規約により使用不可」と規約 ID。選べず、check・送信を呼ばない", async (kind) => {
    const { onCheck, onSubmit, user } = renderBoard(`tr3_${kind}`);
    const radio = within(panel()).getByRole("radio");
    expect(radio).toBeDisabled();
    const item = within(panel()).getAllByRole("listitem")[0]!;
    expect(item.textContent).toMatch(/規約により使用不可/);
    expect(item.textContent).toContain(`規約 ${CONVENTION[kind]}`);
    // 処理可能性のバッジ（未裁定・未実装など）と、その説明を出さない（表示の文の「未裁定・未実装ではありません」は除外の説明）
    expect(item.querySelector('[class*="proc-"]')).toBeNull();
    expect(item.textContent).not.toMatch(/記録で裁定が決まらない|エンジンが未対応です|undefined/);
    await user.click(radio);
    expect(radio).not.toBeChecked();
    expect(within(panel()).getByRole("button", { name: "送信" })).toBeDisabled();
    // 「入力を検査」は既存の設計で、選びかけの入力もエンジンに確かめられる（7d0f386）。押しても、使用不可の選べるものは入力に入らない
    await user.click(within(panel()).getByRole("button", { name: "入力を検査" }));
    expect(onCheck.mock.calls.every(([choices]) => !(choices as string[]).includes("o1"))).toBe(true);
    await user.click(within(panel()).getByRole("button", { name: "送信" }));
    expect(onSubmit).not.toHaveBeenCalled();
    // 候補: 選べるものがすべて規約による除外なので「規約により使用不可」（エンジンの区分 not_implemented・no_eligible_card はコードのまま添える）。未実装の案内にしない
    const badges = panel().querySelector(".badges")!;
    expect(badges.textContent).toMatch(/規約により使用不可/);
    expect(badges.textContent).toMatch(/not_implemented・no_eligible_card/);
    expect(badges.textContent).not.toMatch(/エンジンが未対応です/);
  });

  it.each(["gust", "switch", "potion"] as const)("同じ盤面の CURRENT（%s）: 未裁定の表示のまま（規約の文・ID を出さない）", (kind) => {
    renderBoard(`cur_${kind}`);
    expect(within(panel()).getByRole("radio")).toBeDisabled();
    const item = within(panel()).getAllByRole("listitem")[0]!;
    expect(item.textContent).toMatch(/未裁定/);
    expect(item.textContent).not.toMatch(/規約により使用不可|規約 PC-/);
    expect(panel().querySelector(".badges")!.textContent).toMatch(/未裁定/);
  });

  it.each(["gust", "switch", "potion"] as const)("TR3・対象あり（%s）: 今までどおり選べる（規約の表示なし）", async (kind) => {
    const { onCheck, user } = renderBoard(`tr3_${kind}_target`);
    const radio = within(panel()).getByRole("radio");
    expect(radio).toBeEnabled();
    expect(panel().textContent).not.toMatch(/規約により使用不可/);
    await user.click(radio);
    await user.click(within(panel()).getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith(["o1"]);
  });

  it("混在（TR3）: 突風・きずぐすりだけ使用不可で、ポケモンいれかえは選べて、その id だけで check。候補は送れる区分のまま", async () => {
    const { onCheck, user } = renderBoard("tr3_mixed");
    expect(within(optionItem("突風")).getByRole("radio")).toBeDisabled();
    expect(within(optionItem("きずぐすり")).getByRole("radio")).toBeDisabled();
    expect(optionItem("突風").textContent).toContain(`規約 ${CONVENTION.gust}`);
    expect(optionItem("きずぐすり").textContent).toContain(`規約 ${CONVENTION.potion}`);
    const sw = within(optionItem("ポケモンいれかえ")).getByRole("radio");
    expect(sw).toBeEnabled();
    expect(optionItem("ポケモンいれかえ").textContent).not.toMatch(/規約/);
    expect(panel().querySelector(".badges")!.textContent).not.toMatch(/規約により使用不可/);
    await user.click(within(optionItem("突風")).getByRole("radio"));
    await user.click(sw);
    await user.click(within(panel()).getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(["o3"]);
  });

  it("混在（CURRENT）: 突風・きずぐすりは未裁定、ポケモンいれかえは選べる", () => {
    renderBoard("cur_mixed");
    for (const n of ["突風", "きずぐすり"]) {
      expect(within(optionItem(n)).getByRole("radio")).toBeDisabled();
      expect(optionItem(n).textContent).toMatch(/未裁定/);
      expect(optionItem(n).textContent).not.toMatch(/規約/);
    }
    expect(within(optionItem("ポケモンいれかえ")).getByRole("radio")).toBeEnabled();
  });

  it("全除外（TR3）: 2 枚とも使用不可で、候補は「規約により使用不可」（未実装の案内にしない）", () => {
    renderBoard("tr3_all_excluded");
    expect(within(panel()).getAllByRole("radio").every((r) => (r as HTMLInputElement).disabled)).toBe(true);
    const badges = panel().querySelector(".badges")!;
    expect(badges.textContent).toMatch(/規約により使用不可/);
    expect(badges.textContent).not.toMatch(/エンジンが未対応です/);
  });
});

describe("not_implemented・no_eligible_card を一括で読み替えない（人工: 実応答を写して変えた）", () => {
  it("規約による除外と未裁定が混ざった全部送れない候補は、エンジンの区分（未実装）のまま", () => {
    const raw = rawInputs("tr3_all_excluded");
    const o = raw.response.stages[0]!.options[1]!;
    delete o.convention;
    Object.assign(o, { processability: "unresolved_ruling", reasons: ["stops_before_acceptance"] });
    setup(trainerCandidate("tr3_all_excluded"), V.inputsResponse(raw));
    const badges = panel().querySelector(".badges")!;
    expect(badges.textContent).not.toMatch(/規約により使用不可/);
    expect(badges.textContent).toMatch(/未実装/);
    expect(optionItem("突風").textContent).toMatch(/規約により使用不可/); // 選べるものごとの表示はそのまま
    expect(optionItem("きずぐすり").textContent).toMatch(/未裁定/);
  });

  it("選べるものが規約による除外でない not_implemented・no_eligible_card の候補は未実装のまま（候補の一覧の値だけでは読み替えない）", () => {
    const stage = { stage: 1, input: "choose_option", role: "trainer", meaning: "card", count: { min: 1, max: 1 }, order: "not_applicable",
      options: [{ id: "o1", card: 5, card_id: "PMCG1-072", eligible: false, processability: "not_implemented" }] };
    const candidate = { ...cand("play_trainer", "not_implemented"), reasons: ["no_eligible_card"] } as Candidate;
    setup(candidate, V.inputsResponse(inputs("play_trainer", [stage as never])));
    expect(panel().querySelector(".badges")!.textContent).toMatch(/未実装/);
    expect(panel().textContent).not.toMatch(/規約により使用不可/);
  });
});
