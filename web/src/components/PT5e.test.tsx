// 0.176.0（PT-5e。山札から引いて試すトレーナー 6 枚の使うための条件を候補の作成で呼ぶ）の表示・送る前の check（実応答。形は test/pt5e.ts）。
// 新しい語彙はなく、GUI は既存の扱い（処理可能性の表示・実行できない選べるもの・check の門）を使う。実エンジンとの確認は server/tests/test_pt5e.py と e2e/pt5e.spec.ts。
// unverified のトレーナー（不変条件の崩れた状態・effects.py の外の条件で残る）の既存の表示は U75.test.tsx（模擬の応答）で確かめる。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { candidates, inputs, observation, player } from "../test/fixtures";
import { PT5E_CANDIDATE_1, PT5E_CANDIDATE_2, PT5E_HAND_1, PT5E_HAND_2, PT5E_STAGES_1, PT5E_STAGES_2 } from "../test/pt5e";
import { DecisionPanel } from "./DecisionPanel";

const NAMES: Record<string, string> = {
  "GD5-017": "カツラのクイズ その2",
  "GD5-016": "カツラのクイズ その1",
  "neo4-105": "ポケモン性格判定",
  "ES1-033": "ポリゴン",
  "PMCG6-082": "カツラのクイズ その3",
  "PR1-027": "とりかえっこプリーズ",
  "PMCG1-074": "マサキ",
};
const VALID = { valid: true, refusal: null };

function setup(candidate: Candidate, stages: InputStage[], hand: { card: number; card_id: string }[]) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs("play_trainer", stages, { candidate: candidate.id }));
  const obs = observation(0, [player(0, { handCards: hand }), player(1, { handCards: null })]);
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={0}
      observation={obs}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
  const view = render(ui(null));
  return { onSubmit, onCheck, user: userEvent.setup(), rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)) };
}

const send = () => screen.getByRole("button", { name: "送信" });
const item = (name: RegExp) => screen.getByRole("radio", { name }).closest("li")!;

describe("PT-5e の実応答の検証（新しい語彙はない）", () => {
  it("候補（新しい保証文）と選べるものを、今の検証のまま受け付ける", () => {
    expect(() => V.candidatesResponse(candidates("r1", [PT5E_CANDIDATE_1, PT5E_CANDIDATE_2]))).not.toThrow();
    expect(() => V.inputsResponse(inputs("play_trainer", PT5E_STAGES_1))).not.toThrow();
    expect(() => V.inputsResponse(inputs("play_trainer", PT5E_STAGES_2))).not.toThrow();
  });

  it("保証文の中身は選べるか・送れるかに使わない（文を変えても同じ表示）", () => {
    const changed = { ...PT5E_CANDIDATE_1, guarantees: { preconditions: "別の文", acceptance: "別の文", after_acceptance: "別の文" } } as Candidate;
    setup(changed, PT5E_STAGES_1, PT5E_HAND_1);
    expect(screen.getByRole("radio", { name: /その2/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /その1/ })).toBeDisabled();
  });
});

describe("PT-5e の表示（盤面 1・2 の実応答）", () => {
  it("条件を通るカードは may_stop_later として選べる。受理・完走・使えることを予告しない", () => {
    setup(PT5E_CANDIDATE_1, PT5E_STAGES_1, PT5E_HAND_1);
    const quiz2 = item(/その2/);
    expect(screen.getByRole("radio", { name: /その2/ })).toBeEnabled();
    expect(quiz2).toHaveTextContent("送れる（後で止まりうる）");
    expect(quiz2).toHaveTextContent("続きの処理を評価していない"); // 理由（受理のあと・宣言の前の先読みを評価していない）
    expect(quiz2.textContent).not.toMatch(/未確認|use_condition|使うための条件をエンジンが前もって確かめていない/); // unverified の表示ではない
    expect(screen.getByRole("region", { name: /^入力/ }).textContent).not.toMatch(/受理されます|完走します|使えます/);
  });

  it("ゲーム上使えないカード（性格判定・とりかえっこプリーズ）は手札にあっても選べるものに出さず、手札・カード定義から補わない", () => {
    setup(PT5E_CANDIDATE_1, PT5E_STAGES_1, PT5E_HAND_1);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByRole("radio", { name: /性格判定|ポリゴン/ })).toBeNull();
  });

  it("未対応（その1）・未裁定（その3）は理由つきで示し、選べず送れない。ゲーム上の禁止とは書かない", () => {
    setup(PT5E_CANDIDATE_1, PT5E_STAGES_1, PT5E_HAND_1);
    expect(screen.getByRole("radio", { name: /その1/ })).toBeDisabled();
    const quiz1 = item(/その1/);
    expect(quiz1).toHaveTextContent("未実装");
    expect(quiz1).toHaveTextContent("エンジンが受け付ける前に止める");
    expect(quiz1).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(send()).toBeDisabled();
  });

  it("盤面 2: 未裁定のその3は送れず、とりかえっこプリーズは出ない。PT-5e の外のマサキは選べる", () => {
    setup(PT5E_CANDIDATE_2, PT5E_STAGES_2, PT5E_HAND_2);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByRole("radio", { name: /とりかえっこ/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /その3/ })).toBeDisabled();
    const quiz3 = item(/その3/);
    expect(quiz3).toHaveTextContent("未裁定");
    expect(quiz3).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(screen.getByRole("radio", { name: /マサキ/ })).toBeEnabled();
  });

  it("今の入力への check が通ったときだけ送れる。別の入力への check では送れない（入力の変更で捨てるのは U75・checkGate の既存のテスト）。表示は受理・完走の保証ではない", async () => {
    const { user, onCheck, onSubmit, rerenderWithCheck } = setup(PT5E_CANDIDATE_2, PT5E_STAGES_2, PT5E_HAND_2);
    await user.click(screen.getByRole("radio", { name: /マサキ/ }));
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o2"]);
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o2"]), response: VALID });
    expect(send()).toBeEnabled();
    expect(screen.getByText(/エンジンの検査を通りました/)).toHaveTextContent("受理・完走の保証ではありません");
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o2"]);
  });
});
