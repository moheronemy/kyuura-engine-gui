// 0.180.0（F-1。本人のうらのバトル場のポケモンのワザの候補だけに、実装に合う保証の文 GUARANTEE_FACE_DOWN_ATTACK が付く）の表示・送る前の check
// （実応答。形は test/f1.ts）。新しい語彙・項目の名前はなく、GUI は保証文を説明として表示するだけで、送れるかの判定に使わない。
// エンジン由来の保証文（候補の details の中）と、GUI が独自に書く説明（選べるものの説明・check の結果の文）を分けて確かめる。エンジンの文に「受理」「エネルギー」などの語が
// あることは GUI の誤表示ではない。うらのワザの check は形だけ（エンジンの確かめを呼ばない）なので、GUI の文もエネルギー・受理・完走の保証として書かない（判定は選べるものの face_down）。
// 画面全体（閲覧者・情報境界・遅れた check・本人だけの診断）は AppF1.test.tsx、実エンジンとの確かめは server/tests/test_f1.py と e2e/f1.spec.ts。
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { endpointClient } from "../api/transport";
import type { Candidate } from "../api/types";
import * as V from "../api/validate";
import { REASON_LABELS } from "../labels";
import type { SubmitGate } from "../state/submitGate";
import { choicesKey, useEndpointSession, type CheckResult } from "../state/useEndpointSession";
import {
  F1_ATTACK,
  F1_CANDIDATES,
  F1_CHECK,
  F1_ENERGY_ATTACK,
  F1_ENERGY_CANDIDATES,
  F1_ENERGY_INPUTS,
  F1_FACE_UP_ATTACK,
  F1_FACE_UP_CANDIDATES,
  F1_FACE_UP_CHECK,
  F1_FACE_UP_INPUTS,
  F1_FACE_UP_VIEW,
  F1_INPUTS,
  F1_VIEWS,
} from "../test/f1";
import { EMPTY_UPDATES, mockTransport } from "../test/fixtures";
import { submit as envelope } from "../test/u74";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

const REASON = "face_down_reveal_not_evaluated";
const VALID = { valid: true, refusal: null };
// GUI が独自に書く文に出てはいけない語（受理・エネルギー・完走の保証、おもてになることや受理のあとの予告）
const GUI_PROMISE = /受理されます|完走します|使えます|エネルギーが足ります|足りています|おもてになります|おもてにしてから|場に残ります|トラッシュされます|ゲーム上の禁止/;
const FORM_ONLY = "エンジンの形の検査を通りました（ワザの番号が 1 つで、ほかを選ばないことだけ。必要なエネルギーが足りるか・ワザを使えるか・受理・完走の保証ではありません";

/** GUI の表示（エンジンの保証文の details を除く）。 */
function guiText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

function setup(candidate: Candidate, inputsBody: unknown, view: unknown) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const onInputChange = vi.fn();
  const raw = inputsBody as { response: Record<string, unknown> };
  const parsed = V.inputsResponse({ ...raw, response: { ...raw.response, candidate: candidate.id } });
  const obs = V.viewResponse(view).observation;
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={0}
      observation={obs}
      names={() => undefined}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
      onInputChange={onInputChange}
    />
  );
  const rendered = render(ui(null));
  return { onSubmit, onCheck, onInputChange, user: userEvent.setup(), rerenderWithCheck: (check: CheckResult | null) => rendered.rerender(ui(check)) };
}

const send = () => screen.getByRole("button", { name: "送信" });
const checkText = () => document.querySelector(".check-result")?.textContent ?? "";

describe("F-1 の実応答の検証（新しい語彙・項目の名前はない）", () => {
  it("候補・inputs・check・view を今の検証のまま受け付ける。保証文は 4 項目の文字列で、うらとおもてで文が違い、ほかの値はエンジンのテストの値", () => {
    for (const r of [F1_CANDIDATES, F1_ENERGY_CANDIDATES, F1_FACE_UP_CANDIDATES]) expect(() => V.candidatesResponse(r)).not.toThrow();
    for (const r of [F1_INPUTS, F1_ENERGY_INPUTS, F1_FACE_UP_INPUTS]) expect(() => V.inputsResponse(r)).not.toThrow();
    for (const r of [F1_CHECK, F1_FACE_UP_CHECK]) expect(() => V.checkResponse(r)).not.toThrow();
    for (const v of [...Object.values(F1_VIEWS), F1_FACE_UP_VIEW]) expect(() => V.viewResponse(v)).not.toThrow();
    for (const c of [F1_ATTACK, F1_ENERGY_ATTACK, F1_FACE_UP_ATTACK]) expect(Object.keys(c.guarantees).sort()).toEqual(["acceptance", "after_acceptance", "preconditions", "supported_scope"]);
    expect(F1_ATTACK.guarantees).toEqual(F1_ENERGY_ATTACK.guarantees); // ワザの有無によらず同じ文
    expect(F1_ATTACK.guarantees.preconditions).not.toEqual(F1_FACE_UP_ATTACK.guarantees.preconditions);
    expect([F1_ATTACK.processability, F1_ATTACK.reasons, F1_ATTACK.input_disclosure]).toEqual(["unverified", [REASON], "confirmed"]);
    expect([F1_ENERGY_ATTACK.processability, F1_ENERGY_ATTACK.reasons]).toEqual(["not_implemented", [REASON, "no_printed_attack"]]);
    expect([F1_FACE_UP_ATTACK.processability, F1_FACE_UP_ATTACK.reasons]).toEqual(["may_stop_later", ["continuation_not_evaluated", "preflight_not_evaluated"]]);
    expect(F1_ENERGY_INPUTS.response.stages).toEqual([]);
  });
});

describe("F-1 の候補の一覧（エンジンの保証文と GUI の説明を分ける）", () => {
  it("うら: 「未確認」と理由。エンジンの保証文は details の中にエンジンの文のまま。details の外の GUI の文に保証・予告を書かない", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(F1_CANDIDATES).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("ワザを使う"))!;
    expect(item).toHaveTextContent("未確認");
    expect(item).toHaveTextContent(REASON_LABELS[REASON]!);
    const details = item.querySelector("details")!;
    for (const value of Object.values(F1_ATTACK.guarantees)) expect(details.textContent).toContain(value); // エンジンの文をそのまま表示（GUI が書きかえない）
    expect(details.textContent).toContain("check が valid でも、エンジンの確かめを通したことを意味しない"); // エンジンの文の中の語は GUI の誤表示ではない
    expect(guiText(item)).not.toMatch(GUI_PROMISE);
    expect(within(item).getByRole("button", { name: "この操作を選ぶ" })).toBeEnabled();
  });

  it("おもての対照: 「送れる（後で止まりうる）」と従来の保証文（check_use_attack を使う文）のまま", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(F1_FACE_UP_CANDIDATES).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("ワザを使う"))!;
    expect(item).toHaveTextContent("送れる（後で止まりうる）");
    expect(item.querySelector("details")!.textContent).toContain(F1_FACE_UP_ATTACK.guarantees.preconditions);
    expect(item.querySelector("details")!.textContent).not.toContain(F1_ATTACK.guarantees.preconditions);
  });
});

describe("F-1 の入力の画面（実応答）", () => {
  it("うらのワザ: 選べるものは「未確認」。GUI の説明はエネルギー・受理を確かめていないと書き、おもてになることを予告しない", () => {
    setup(F1_ATTACK, F1_INPUTS, F1_VIEWS[0]);
    expect(screen.getAllByRole("radio")).toHaveLength(2); // エンジンが返した選べるものだけ
    for (const name of ["いわおとし", "かたくなる"]) {
      const li = screen.getByRole("radio", { name: new RegExp(name) }).closest("li")!;
      expect(li).toHaveTextContent("未確認");
      expect(li).toHaveTextContent("必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます（候補と入力の検査では確かめていません）");
      expect(within(li).getByRole("radio")).toBeEnabled();
    }
    expect(guiText(document.body)).not.toMatch(GUI_PROMISE);
  });

  it("うらのワザ: 今の入力への check が valid のあとだけ送れる。check の文は形の検査だけで、エネルギー・受理・完走の保証として書かない", async () => {
    const { user, onCheck, onSubmit, onInputChange, rerenderWithCheck } = setup(F1_ATTACK, F1_INPUTS, F1_VIEWS[0]);
    await user.click(screen.getByRole("radio", { name: /かたくなる/ }));
    expect(onInputChange).toHaveBeenCalled();
    expect(send()).toBeDisabled(); // check の前
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o2"]);
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID }); // 別の入力の答え
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o2"]), response: { valid: false, refusal: { code: "CANDIDATE_INPUT_INVALID", message: "x" } } });
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o2"]), response: VALID });
    expect(send()).toBeEnabled();
    expect(checkText()).toContain(FORM_ONLY);
    expect(checkText()).not.toMatch(/^入力の検査（今の入力）: エンジンの検査を通りました/);
    expect(guiText(document.body)).not.toMatch(GUI_PROMISE);
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o2"]);
  });

  it("おもての対照: check の文は従来の「エンジンの検査を通りました」（形だけの文にしない）", async () => {
    const { user, rerenderWithCheck } = setup(F1_FACE_UP_ATTACK, F1_FACE_UP_INPUTS, F1_FACE_UP_VIEW);
    await user.click(screen.getByRole("radio", { name: /ジャブ/ }));
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
    expect(send()).toBeEnabled();
    expect(checkText()).toContain("エンジンの検査を通りました（受理・完走の保証ではありません");
    expect(checkText()).not.toContain("形の検査");
    expect(document.body.textContent).not.toContain("候補と入力の検査では確かめていません");
  });

  it("保証文だけを入れかえても、送れるか（check の前・あと）と GUI の文は変わらない（保証文の文字列で決めない）", async () => {
    const states = [];
    for (const candidate of [F1_ATTACK, { ...F1_ATTACK, guarantees: F1_FACE_UP_ATTACK.guarantees }, { ...F1_ATTACK, guarantees: { preconditions: "別の文" } }] as Candidate[]) {
      const { user, rerenderWithCheck } = setup(candidate, F1_INPUTS, F1_VIEWS[0]);
      await user.click(screen.getByRole("radio", { name: /いわおとし/ }));
      const before = send().hasAttribute("disabled");
      rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
      states.push([before, send().hasAttribute("disabled"), checkText()]);
      document.body.innerHTML = "";
    }
    expect(states.map(([b, a]) => [b, a])).toEqual([[true, false], [true, false], [true, false]]);
    expect(new Set(states.map((s) => s[2])).size).toBe(1);
    // おもての候補に、うらの保証文を付けても、check の文は従来のまま（文字列で分けない）
    const { user, rerenderWithCheck } = setup({ ...F1_FACE_UP_ATTACK, guarantees: F1_ATTACK.guarantees } as Candidate, F1_FACE_UP_INPUTS, F1_FACE_UP_VIEW);
    await user.click(screen.getByRole("radio", { name: /ジャブ/ }));
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
    expect(send()).toBeEnabled();
    expect(checkText()).not.toContain("形の検査");
  });

  it("印刷のワザがないうら: 入力なし・処理可能性の区分で送れない（ゲーム上の禁止とは書かない）。check の答えがあっても送れない", () => {
    const { rerenderWithCheck } = setup(F1_ENERGY_ATTACK, F1_ENERGY_INPUTS, F1_VIEWS[0]);
    expect(screen.getByText("この操作に入力はありません。")).toBeInTheDocument();
    expect(screen.getByText(/この候補は処理可能性の区分により送れません（ゲーム上の禁止ではありません）/)).toBeInTheDocument();
    rerenderWithCheck({ choices: choicesKey([]), response: VALID });
    expect(send()).toBeDisabled();
  });
});

describe("F-1 の送信の入口（useEndpointSession の submit）", () => {
  const gate: SubmitGate = { busy: false, run: async (fn) => fn() };
  it("check の不足（前・別の入力・入力を変えたあと）では要求を出さない。拒否は本人への知らせだけで、自動で再送しない", async () => {
    const rejected = envelope("rejected", { status: "in_progress", diagnostic_id: "INSUFFICIENT_ENERGY", category: "invalid_input", message: "この操作は、今の対戦の状態ではルール上できません。" });
    const transport = mockTransport((c) => {
      if (c.method === "GET") return EMPTY_UPDATES;
      const type = c.body?.type;
      if (type === "view") return F1_VIEWS[0];
      if (type === "candidates") return F1_CANDIDATES;
      if (type === "inputs") return F1_INPUTS;
      if (type === "check") return F1_CHECK;
      if (type === "submit") return rejected;
      throw new Error(`想定外 ${c.path} ${String(type)}`);
    });
    const client = endpointClient(transport, { route: "seat", token: "tok0" });
    const hook = renderHook(() => useEndpointSession({ client, canAct: true, gate, operationPrefix: "t" }));
    const submits = () => transport.calls.filter((c) => c.body?.type === "submit");
    await waitFor(() => expect(hook.result.current.legal).not.toBeNull());
    await act(() => hook.result.current.select(F1_ATTACK));
    await waitFor(() => expect(hook.result.current.selection?.inputs).not.toBeNull());
    await act(() => hook.result.current.submit(["o2"]));
    expect(submits()).toHaveLength(0);
    expect(hook.result.current.notices[0]?.title).toBe("送信していません");
    await act(() => hook.result.current.check(["o1"]));
    await act(() => hook.result.current.submit(["o2"])); // check した入力と違う
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.check(["o2"]));
    act(() => hook.result.current.inputChanged()); // 入力を変えた（元に戻した）: 答えを捨てる
    await act(() => hook.result.current.submit(["o2"]));
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.check(["o2"]));
    await act(() => hook.result.current.submit(["o2"]));
    expect(submits().map((c) => c.body?.choices)).toEqual([["o2"]]);
    expect(hook.result.current.notices[0]?.lines).toContain("この結果は送ったあなたにだけ表示しています（相手・観戦者には知らせません）。");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(submits()).toHaveLength(1);
  });
});
