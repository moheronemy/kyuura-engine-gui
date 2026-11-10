// 0.178.0（UP-5t-C1。特殊能力の候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず unverified にする補強）の表示・送る前の check（実応答。形は test/up5t.ts）。
// 新しい語彙はなく、GUI は既存の扱い（処理可能性の表示・理由の表示・check の門）を使う。保証文は説明として表示するだけで、送れるかの判定に使わない。
// 画面全体（閲覧者の切り替え・遅れた答え・本人だけの診断）は AppUP5tC1.test.tsx、実エンジンとの確認は server/tests/test_up5t_c1.py と e2e/up5t-c1.spec.ts。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate } from "../api/types";
import * as V from "../api/validate";
import { REASON_LABELS } from "../labels";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { UP5T_CANDIDATES_FACE_DOWN, UP5T_CANDIDATES_FACE_UP, UP5T_CHECK_FACE_DOWN, UP5T_FACE_DOWN_POWER, UP5T_FACE_UP_POWER, UP5T_INPUTS_FACE_DOWN, UP5T_REALS, UP5T_VIEWS_FACE_DOWN } from "../test/up5t";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

const NAMES: Record<string, string> = { "PMCG4-006": "わるいクサイハナ", "PMCG1-058": "エビワラー", ...UP5T_REALS };
const REASON = "face_down_reveal_not_evaluated";
const REALS = new RegExp(Object.entries(UP5T_REALS).flat().join("|"));

function setup(candidate: Candidate) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse({ ...UP5T_INPUTS_FACE_DOWN, response: { ...UP5T_INPUTS_FACE_DOWN.response, candidate: candidate.id } });
  const obs = V.viewResponse(UP5T_VIEWS_FACE_DOWN[1]).observation;
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={1}
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
const VALID = { valid: true, refusal: null };
/** 候補の項目のうち、GUI の表示（区分・理由・特殊能力の行）。エンジンの保証文（guarantees の details。エンジンの説明のまま表示する）を除く。 */
function guiText(li: HTMLElement): string {
  const copy = li.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

describe("UP-5t-C1 の実応答の検証（新しい語彙はない）", () => {
  it("うら・おもての候補・inputs（段なし）・check・view を、今の検証のまま受け付ける", () => {
    expect(() => V.candidatesResponse(UP5T_CANDIDATES_FACE_DOWN)).not.toThrow();
    expect(() => V.candidatesResponse(UP5T_CANDIDATES_FACE_UP)).not.toThrow();
    expect(() => V.inputsResponse(UP5T_INPUTS_FACE_DOWN)).not.toThrow();
    expect(() => V.checkResponse(UP5T_CHECK_FACE_DOWN)).not.toThrow();
    for (const v of Object.values(UP5T_VIEWS_FACE_DOWN)) expect(() => V.viewResponse(v)).not.toThrow();
    expect([UP5T_FACE_DOWN_POWER.processability, UP5T_FACE_DOWN_POWER.reasons, UP5T_FACE_DOWN_POWER.input_disclosure, UP5T_FACE_DOWN_POWER.input_stages]).toEqual(["unverified", [REASON], "no_input", []]);
    expect([UP5T_FACE_UP_POWER.processability, UP5T_FACE_UP_POWER.reasons]).toEqual(["may_stop_later", ["continuation_not_evaluated"]]);
  });
});

describe("UP-5t-C1 の表示（実応答）", () => {
  it("うら: 候補の一覧で「未確認」と理由を示し、使える・受理・完走・おもてになることを予告しない。ゲーム上の禁止とも書かない", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(UP5T_CANDIDATES_FACE_DOWN).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("くさいかふん"))!;
    expect(item).toHaveTextContent("未確認");
    expect(item).toHaveTextContent(REASON_LABELS[REASON]!);
    expect(guiText(item)).not.toMatch(/ゲーム上の禁止|使えません|受理されます|完走します|おもてになります|おもてにしてから/);
    expect(item.querySelector("details")).toHaveTextContent("v0.178:"); // 保証文は説明としてエンジンの文のまま示す（判定に使わない）
    expect(document.body.textContent).not.toMatch(REALS); // 本当のカードを補わない
  });

  it("おもての対照: may_stop_later（送れる・後で止まりうる）で、うらの理由を出さない。これも受理・完走の保証として書かない", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(UP5T_CANDIDATES_FACE_UP).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("くさいかふん"))!;
    expect(item).toHaveTextContent("送れる（後で止まりうる）");
    expect(guiText(item)).not.toMatch(/未確認|face_down_reveal_not_evaluated/);
    expect(guiText(item)).not.toMatch(/受理されます|完走します/);
  });

  it("入力なしでも check の前は送れない。今の入力（[]）への check が通ったときだけ送れ、その表示は受理・完走の保証ではない", async () => {
    const { user, onCheck, onSubmit, rerenderWithCheck } = setup(UP5T_FACE_DOWN_POWER);
    expect(screen.getByText("この操作に入力はありません。")).toBeInTheDocument();
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith([]);
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID }); // 別の入力への答えは使わない
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey([]), response: { valid: false, refusal: { code: "CANDIDATE_STALE", message: "古い" } } });
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey([]), response: VALID });
    expect(send()).toBeEnabled();
    expect(screen.getByText(/エンジンの検査を通りました/)).toHaveTextContent("受理・完走の保証ではありません");
    expect(screen.getByRole("region", { name: /^入力/ }).textContent).not.toMatch(/受理されます|完走します|使えます|おもてになります/);
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("保証文だけを変えても、送れるか（check の前・あと）は変わらない（文字列で判定しない）", () => {
    const changed = { ...UP5T_FACE_DOWN_POWER, guarantees: { ...UP5T_FACE_DOWN_POWER.guarantees, preconditions: "別の文" } } as Candidate;
    const states = [UP5T_FACE_DOWN_POWER, changed].map((candidate) => {
      const { rerenderWithCheck } = setup(candidate);
      const before = send().hasAttribute("disabled");
      rerenderWithCheck({ choices: choicesKey([]), response: VALID });
      const after = send().hasAttribute("disabled");
      document.body.innerHTML = "";
      return [before, after];
    });
    expect(states).toEqual([[true, false], [true, false]]);
  });

  it("使う人の入力の画面に、相手のうらのカードの本当のカード（名前・カード ID）を補わない（カード定義を知っていても）", () => {
    setup(UP5T_FACE_DOWN_POWER);
    expect(document.body.textContent).not.toMatch(REALS);
    expect(document.body.textContent).toMatch(/くさいかふん/);
  });
});
