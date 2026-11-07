// 決定の入力（模擬の応答。実エンジンとの確認は e2e/）。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InputStage } from "../api/types";
import * as V from "../api/validate";
import { DecisionPanel } from "./DecisionPanel";
import { cand, inputs } from "../test/fixtures";

function setup(kind: string, stages: InputStage[], opts: { processability?: string; extra?: Record<string, unknown> } = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs(kind, stages, opts.extra));
  render(
    <DecisionPanel
      selection={{ candidate: cand(kind, opts.processability), handle: { game: "g", revision: "r", candidate: "c1" }, inputs: parsed, check: null }}
      observation={null}
      names={(id) => (id === "PMCG1-058" ? "エビワラー" : undefined)}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />,
  );
  return { onSubmit, onCheck, user: userEvent.setup() };
}

const opt = (id: string, value: number, processability = "may_stop_later") => ({ id, value, processability });

describe("DecisionPanel", () => {
  it("単一選択: 選択肢 ID をそのまま送る", async () => {
    const { onSubmit, user } = setup("take_prize", [
      { stage: 1, input: "choose_option", meaning: "position", count: { min: 1, max: 1 }, order: "not_applicable", options: [opt("o1", 0), opt("o2", 1)] },
    ]);
    const send = screen.getByRole("button", { name: "送信" });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /位置 2/ }));
    await user.click(send);
    expect(onSubmit).toHaveBeenCalledWith(["o2"]);
  });

  it("複数選択・順序付き: 入力順を保ち、並べ替えない。最大数を超えて選べない", async () => {
    const options = [opt("o1", 10), opt("o2", 20), opt("o3", 30)];
    const { onSubmit, user } = setup("answer_decision", [
      { stage: 1, input: "choose_option", decision_kind: "arrange_deck_top", meaning: "number", count: { min: 2, max: 2 }, order: "significant", options },
    ]);
    expect(screen.getByText(/選んだ順に意味があります/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /値 30/ }));
    await user.click(screen.getByRole("checkbox", { name: /値 10/ }));
    expect(screen.getByRole("checkbox", { name: /値 20/ })).toBeDisabled(); // 最大 2
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenLastCalledWith(["o3", "o1"]);
    await user.click(screen.getByRole("button", { name: "o1 を前へ" }));
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenLastCalledWith(["o1", "o3"]);
  });

  it("順序が未確認でも入力順のまま送る", async () => {
    const { onSubmit, user } = setup("answer_decision", [
      { stage: 1, input: "choose_option", meaning: "number", count: { min: 0, max: 3 }, order: "unconfirmed", decline: true, options: [opt("o1", 1), opt("o2", 2), opt("o3", 3)] },
    ]);
    expect(screen.getByText(/未確認です。選んだ順のまま送ります/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /値 3/ }));
    await user.click(screen.getByRole("checkbox", { name: /値 1/ }));
    await user.click(screen.getByRole("checkbox", { name: /値 2/ }));
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith(["o3", "o1", "o2"]);
  });

  it("辞退・0 枚の回答を送れる（GUI が独自に飛ばさない）", async () => {
    const { onSubmit, user } = setup("answer_decision", [
      { stage: 1, input: "choose_option", meaning: "card", count: { min: 0, max: 2 }, order: "not_significant", decline: true, options: [{ id: "o1", card: 5, card_id: "PMCG1-058", processability: "may_stop_later" }] },
    ]);
    expect(screen.getByText(/辞退できます/)).toBeInTheDocument();
    expect(screen.getByText(/エビワラー PMCG1-058/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("空の決定: 選べるものがなければその旨を表示し、最小数を満たせなければ送れない", () => {
    setup("answer_decision", [{ stage: 1, input: "choose_option", meaning: "card", count: { min: 1, max: 1 }, order: "not_applicable", options: [] }]);
    expect(screen.getByText(/選べるものがありません/)).toBeInTheDocument();
    expect(screen.getByText(/最小数を満たせないため送れません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
  });

  it("空の決定で最小 0 なら 0 個のまま送れる", async () => {
    const { onSubmit, user } = setup("answer_decision", [{ stage: 1, input: "choose_option", meaning: "card", count: { min: 0, max: 1 }, order: "not_applicable", options: [] }]);
    expect(screen.getByText(/0 個のまま送れます/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("選ぶと停止する選択肢は理由を表示して選べない（ゲーム上の禁止と書かない）", () => {
    setup("answer_decision", [
      { stage: 1, input: "choose_option", meaning: "number", count: { min: 1, max: 1 }, order: "not_applicable", options: [opt("o1", 1, "unresolved_ruling"), opt("o2", 2, "not_implemented"), opt("o3", 3)] },
    ]);
    expect(screen.getByRole("radio", { name: /値 1/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /値 2/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /値 3/ })).toBeEnabled();
    expect(screen.getAllByText(/ゲーム上の禁止ではありません/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/ルール上禁止/)).toBeNull();
  });

  it("初期配置: 2 段（バトル場・ベンチ）を順に連結し、段をまたいで重ねない。化石は選べない", async () => {
    const options = [
      { id: "o1", card: 2, card_id: "PMCG1-058", placement: "eligible", eligible: true, processability: "supported" },
      { id: "o2", card: 5, card_id: "T-5", placement: "eligible", eligible: true, processability: "supported" },
      { id: "o3", card: 6, card_id: "T-6", placement: "eligible", eligible: true, processability: "supported" },
      { id: "o4", card: 7, card_id: "T-7", placement: "stops", eligible: false, processability: "unresolved_ruling" },
    ];
    const { onSubmit, user } = setup(
      "place_starting",
      [
        { stage: 1, input: "choose_option", role: "active", count: { min: 1, max: 1 }, options, order: "not_applicable" },
        { stage: 2, input: "choose_option", role: "bench", count: { min: 0, max: 5 }, options_from_stage: 1, distinct_across_stages: true, order: "significant", order_preserved: true },
      ],
      { processability: "supported" },
    );
    const [active, bench] = screen.getAllByRole("group");
    const radios = active!.querySelectorAll("input");
    await user.click(radios[1]!); // o2 をバトル場
    const benchBoxes = bench!.querySelectorAll("input");
    expect(benchBoxes[1]).toBeDisabled(); // o2 はほかの段で選択済み
    expect(benchBoxes[3]).toBeDisabled(); // 化石（stops）
    await user.click(benchBoxes[2]!); // o3
    await user.click(benchBoxes[0]!); // o1
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith(["o2", "o3", "o1"]);
  });

  it("値の入力（補償の枚数）: 範囲の値を整数で送る", async () => {
    const { onSubmit, user } = setup("mulligan_draw", [
      { stage: 1, input: "choose_value", meaning: "count", range: { min: 0, max: 2 }, count: { min: 1, max: 1 }, order: "not_applicable", remaining: 1, decline: true },
    ], { processability: "supported" });
    await user.selectOptions(screen.getByRole("combobox"), "2");
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith([2]);
  });

  it("入力非公開（input_disclosure: unconfirmed）は選べるものを出さず、送れない", () => {
    setup("answer_decision", [], { extra: { withheld: { code: "INPUT_BOUNDARY_UNCONFIRMED", message: "未確認" } } });
    expect(screen.getAllByText(/入力非公開/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "入力を検査" })).toBeNull();
  });
});
