// 0.179.0（PT-5t-C1。トレーナーの候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず、その選べるものを unverified にする補強）の表示・送る前の check
// （実応答。形は test/pt5t.ts）。新しい語彙はなく、GUI は既存の扱い（候補と選べるものごとの処理可能性・理由の表示・check の門）を使う。候補全体（may_stop_later）と
// 選べるものごとの区分（unverified・may_stop_later）を混同しない。保証文は説明として表示するだけで、送れるかの判定に使わない。
// 画面全体（選び直し・元の入力への戻り・遅れた check・閲覧者の切り替え・本人だけの診断）は AppPT5tC1.test.tsx、実エンジンとの確認は server/tests/test_pt5t_c1.py と e2e/pt5t-c1.spec.ts。
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { endpointClient } from "../api/transport";
import type { Candidate } from "../api/types";
import * as V from "../api/validate";
import { REASON_LABELS } from "../labels";
import type { SubmitGate } from "../state/submitGate";
import { choicesKey, useEndpointSession, type CheckResult } from "../state/useEndpointSession";
import { EMPTY_UPDATES, mockTransport } from "../test/fixtures";
import { PT5T_CANDIDATES, PT5T_CHECK, PT5T_INPUTS, PT5T_REALS, PT5T_TRAINER, PT5T_VIEWS } from "../test/pt5t";
import { submit as envelope } from "../test/u74";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

const NAMES: Record<string, string> = { "PMCG4-054": "ねむれ!ねむれ!", "PMCG1-074": "マサキ", "PMCG1-058": "エビワラー", ...PT5T_REALS };
const REASON = "face_down_reveal_not_evaluated";
const REALS = new RegExp(Object.entries(PT5T_REALS).flat().join("|"));
const VALID = { valid: true, refusal: null };

function setup(candidate: Candidate) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const onInputChange = vi.fn();
  const parsed = V.inputsResponse({ ...PT5T_INPUTS, response: { ...PT5T_INPUTS.response, candidate: candidate.id } });
  const obs = V.viewResponse(PT5T_VIEWS[1]).observation;
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
      onInputChange={onInputChange}
    />
  );
  const view = render(ui(null));
  return { onSubmit, onCheck, onInputChange, user: userEvent.setup(), rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)) };
}

const send = () => screen.getByRole("button", { name: "送信" });
const row = (cardId: string) => screen.getAllByRole("listitem").find((li) => li.querySelector('input[type="radio"]') && li.textContent?.includes(cardId))!;
/** GUI の表示（エンジンの保証文の details を除く）。 */
function guiText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

describe("PT-5t-C1 の実応答の検証（新しい語彙はない）", () => {
  it("候補・inputs・check・view を今の検証のまま受け付ける。候補全体は may_stop_later、選べるものは unverified と may_stop_later が混ざる", () => {
    expect(() => V.candidatesResponse(PT5T_CANDIDATES)).not.toThrow();
    expect(() => V.inputsResponse(PT5T_INPUTS)).not.toThrow();
    expect(() => V.checkResponse(PT5T_CHECK)).not.toThrow();
    for (const v of Object.values(PT5T_VIEWS)) expect(() => V.viewResponse(v)).not.toThrow();
    expect([PT5T_TRAINER.processability, PT5T_TRAINER.reasons, PT5T_TRAINER.input_disclosure]).toEqual(["may_stop_later", ["continuation_not_evaluated", "preflight_not_evaluated"], "confirmed"]);
    const body = V.inputsResponse(PT5T_INPUTS).response;
    if (!("stages" in body)) throw new Error("inputs が段を返さない");
    const first = body.stages[0]!;
    if (!("options" in first) || !first.options) throw new Error("1 段目が選べるものの段でない");
    const options = first.options;
    expect(options.map((o) => [o.card_id, o.processability, o.eligible, o.reasons])).toEqual([
      ["PMCG4-054", "unverified", true, ["continuation_not_evaluated", REASON, "preflight_not_evaluated"]],
      ["PMCG1-074", "may_stop_later", true, ["continuation_not_evaluated", "preflight_not_evaluated"]],
    ]);
  });
});

describe("PT-5t-C1 の表示（実応答）", () => {
  it("候補の一覧: 候補全体は「送れる（後で止まりうる）」。受理・完走の保証として書かない。保証文はエンジンの文のまま説明に置く", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(PT5T_CANDIDATES).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("手札のトレーナーを使う"))!;
    expect(item).toHaveTextContent("送れる（後で止まりうる）");
    expect(guiText(item)).not.toMatch(/受理されます|完走します|使えます/);
    expect(item.querySelector("details")).toHaveTextContent("v0.179:");
    expect(document.body.textContent).not.toMatch(REALS);
  });

  it("選べるものごと: ねむれ!ねむれ! は「未確認」と理由、マサキは「送れる（後で止まりうる）」。どちらも選べ、ゲーム上の禁止・使える・おもてになるとは書かない", () => {
    setup(PT5T_TRAINER);
    const sleep = row("PMCG4-054");
    const bill = row("PMCG1-074");
    expect(sleep).toHaveTextContent("未確認");
    expect(sleep).toHaveTextContent(REASON_LABELS[REASON]!);
    expect(sleep.textContent).not.toMatch(/送れる（後で止まりうる）/);
    expect(bill).toHaveTextContent("送れる（後で止まりうる）");
    expect(bill.textContent).not.toMatch(/未確認|うらのカードの本当のカード/);
    for (const li of [sleep, bill]) {
      expect(within(li).getByRole("radio")).toBeEnabled();
      expect(li.textContent).not.toMatch(/ゲーム上の禁止|使えません|受理されます|完走します|使えます|おもてになります|場に残ります/);
    }
    expect(screen.getAllByRole("radio")).toHaveLength(2); // エンジンが返した選べるものだけ（手札・カード定義から補わない）
  });

  it("unverified の選べるものも、今の入力への構造の check が通ったあとだけ送れる。別の入力の答え・通らない答えでは送れない", async () => {
    const { user, onCheck, onSubmit, onInputChange, rerenderWithCheck } = setup(PT5T_TRAINER);
    await user.click(within(row("PMCG4-054")).getByRole("radio"));
    expect(onInputChange).toHaveBeenCalled(); // 入力を変えたら session が前の答えを捨てる
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o1"]);
    rerenderWithCheck({ choices: choicesKey(["o2"]), response: VALID });
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: { valid: false, refusal: { code: "CANDIDATE_STALE", message: "古い" } } });
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
    expect(send()).toBeEnabled();
    expect(screen.getByText(/エンジンの検査を通りました/)).toHaveTextContent("受理・完走の保証ではありません");
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1"]);
  });

  it("保証文だけを変えても、送れるか（check の前・あと）は変わらない（文字列で判定しない）", async () => {
    const changed = { ...PT5T_TRAINER, guarantees: { ...PT5T_TRAINER.guarantees, preconditions: "別の文" } } as Candidate;
    const states = [];
    for (const candidate of [PT5T_TRAINER, changed]) {
      const { user, rerenderWithCheck } = setup(candidate);
      await user.click(within(row("PMCG4-054")).getByRole("radio"));
      const before = send().hasAttribute("disabled");
      rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
      states.push([before, send().hasAttribute("disabled")]);
      document.body.innerHTML = "";
    }
    expect(states).toEqual([[true, false], [true, false]]);
  });

  it("使う人の入力の画面に、相手のうらのカードの本当のカード（名前・カード ID）を補わない", () => {
    setup(PT5T_TRAINER);
    expect(document.body.textContent).not.toMatch(REALS);
  });
});

describe("PT-5t-C1 の送信の入口（useEndpointSession の submit）", () => {
  const gate: SubmitGate = { busy: false, run: async (fn) => fn() };
  function session(submitAnswer: unknown) {
    const transport = mockTransport((c) => {
      if (c.method === "GET") return EMPTY_UPDATES;
      const type = c.body?.type;
      if (type === "view") return PT5T_VIEWS[1];
      if (type === "candidates") return PT5T_CANDIDATES;
      if (type === "inputs") return PT5T_INPUTS;
      if (type === "check") return PT5T_CHECK;
      if (type === "submit") return submitAnswer;
      throw new Error(`想定外 ${c.path} ${String(type)}`);
    });
    const client = endpointClient(transport, { route: "seat", token: "tok1" });
    const hook = renderHook(() => useEndpointSession({ client, canAct: true, gate, operationPrefix: "t" }));
    return { hook, submits: () => transport.calls.filter((c) => c.body?.type === "submit") };
  }

  it("check の不足（前・別の入力・入力を変えたあと）では要求を出さない。拒否は本人への知らせだけで、自動で再送しない", async () => {
    const rejected = envelope("rejected", { status: "in_progress", diagnostic_id: "d1", category: "invalid_input", message: "この操作は、今の対戦の状態ではルール上できません。" });
    const { hook, submits } = session(rejected);
    await waitFor(() => expect(hook.result.current.legal).not.toBeNull());
    await act(() => hook.result.current.select(PT5T_TRAINER));
    await waitFor(() => expect(hook.result.current.selection?.inputs).not.toBeNull());
    await act(() => hook.result.current.submit(["o1"]));
    expect(submits()).toHaveLength(0);
    expect(hook.result.current.notices[0]?.title).toBe("送信していません");
    await act(() => hook.result.current.check(["o2"]));
    await act(() => hook.result.current.submit(["o1"])); // check した入力と違う
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.check(["o1"]));
    act(() => hook.result.current.inputChanged()); // 入力を変えた（そのあと元の o1 に戻した）: 答えを捨てる
    await act(() => hook.result.current.submit(["o1"]));
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.check(["o1"]));
    await act(() => hook.result.current.submit(["o1"]));
    expect(submits().map((c) => c.body?.choices)).toEqual([["o1"]]);
    expect(hook.result.current.notices[0]?.lines).toContain("この結果は送ったあなたにだけ表示しています（相手・観戦者には知らせません）。");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(submits()).toHaveLength(1);
  });
});
