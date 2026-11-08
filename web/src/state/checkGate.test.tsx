// 送る前の check の門（GUI の方針）を、送信の入口（useEndpointSession の submit）で確かめる（模擬の接続層）。
// ボタンの可否は components/TurnBasics.test.tsx・U75fg.test.tsx、画面全体の遅れた答えは AppU75fg.test.tsx。
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { endpointClient } from "../api/transport";
import { cand, candidates, deferred, EMPTY_UPDATES, inputs, mockTransport, observation, player, pokemon, view, type Call } from "../test/fixtures";
import { ATTACH_STAGES } from "../test/u73";
import { submit as envelope } from "../test/u74";
import { BLAINE_ATTACH, BLAINE_STAGES } from "../test/u75fg";
import type { SubmitGate } from "./submitGate";
import { useEndpointSession } from "./useEndpointSession";

const VALID = { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
const INVALID = {
  contract: "kyuura-client-api",
  format: 1,
  type: "check",
  ok: true,
  response: { valid: false, refusal: { code: "CANDIDATE_INPUT_INVALID", message: "入力が合わない" } },
  refetch_required: false,
};
const PLAIN_ATTACH = cand("attach_energy", "may_stop_later", { id: "c2", input_stages: [1, 2].map((stage) => ({ stage, input: "choose_option" })) });
const gate: SubmitGate = { busy: false, run: async (fn) => fn() };

function setup(override: (c: Call) => unknown = () => undefined) {
  const transport = mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    if (c.method === "GET") return EMPTY_UPDATES;
    const type = c.body?.type;
    if (type === "view") return view(0, observation(0, [player(0, { handCards: [], active: pokemon(1, "カツラのガーディ", { card_id: "PMCG6-027" }) }), player(1, { handCards: null })]));
    if (type === "candidates") return candidates("r1", [PLAIN_ATTACH, BLAINE_ATTACH]);
    if (type === "inputs") return c.body?.candidate === "c3" ? inputs("attach_energy", BLAINE_STAGES, { candidate: "c3" }) : inputs("attach_energy", ATTACH_STAGES, { candidate: "c2" });
    if (type === "check") return VALID;
    if (type === "submit") return envelope("accepted", { next: [{ kind: "turn_action", player: 0 }] });
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
  const client = endpointClient(transport, { route: "seat", token: "tok0" });
  const hook = renderHook(() => useEndpointSession({ client, canAct: true, gate, operationPrefix: "t" }));
  const submits = () => transport.calls.filter((c) => c.body?.type === "submit");
  return { hook, submits, transport };
}

async function selectAttach(hook: ReturnType<typeof setup>["hook"], id: "c2" | "c3") {
  await waitFor(() => expect(hook.result.current.legal).not.toBeNull());
  const candidate = id === "c3" ? BLAINE_ATTACH : PLAIN_ATTACH;
  await act(() => hook.result.current.select(candidate));
  await waitFor(() => expect(hook.result.current.selection?.inputs).not.toBeNull());
}

describe("送信の入口の check の門（attach_energy。GUI の方針）", () => {
  it("2 段の 1 枚: check の前の submit は送信の要求を出さず、今の入力への check が通ったあとだけ送る", async () => {
    const { hook, submits } = setup();
    await selectAttach(hook, "c2");
    await act(() => hook.result.current.submit(["o1", "o3"]));
    expect(submits()).toHaveLength(0);
    expect(hook.result.current.notices[0]?.title).toBe("送信していません");
    await act(() => hook.result.current.check(["o1", "o3"]));
    await act(() => hook.result.current.submit(["o1", "o4"])); // check した入力と違う
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.submit(["o1", "o3"]));
    expect(submits().map((c) => c.body?.choices)).toEqual([["o1", "o3"]]);
  });

  it("energy2 の段がある候補: 2 枚目を省く・2 枚とも、check の前は送らない。通らなかった check でも送らない", async () => {
    let answer: unknown = INVALID;
    const { hook, submits } = setup((c) => (c.body?.type === "check" ? answer : undefined));
    await selectAttach(hook, "c3");
    await act(() => hook.result.current.submit(["o1", "o3"]));
    await act(() => hook.result.current.submit(["o1", "o3", "o6"]));
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.check(["o1", "o3", "o6"]));
    await act(() => hook.result.current.submit(["o1", "o3", "o6"])); // 通らなかった
    expect(submits()).toHaveLength(0);
    answer = VALID;
    await act(() => hook.result.current.check(["o1", "o3", "o6"]));
    await act(() => hook.result.current.submit(["o1", "o3"])); // 2 枚目を外した入力（check していない）
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.submit(["o1", "o3", "o6"]));
    expect(submits().map((c) => c.body?.choices)).toEqual([["o1", "o3", "o6"]]);
  });

  it("入力を変えて元に戻しても、変える前に始めた check の遅れた答えでは送らない", async () => {
    const late = deferred<unknown>();
    let checks = 0;
    const { hook, submits } = setup((c) => {
      if (c.body?.type !== "check") return undefined;
      checks += 1;
      return checks === 1 ? late.promise : undefined;
    });
    await selectAttach(hook, "c3");
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.result.current.check(["o1", "o3", "o6"]); // 遅れる
    });
    act(() => hook.result.current.inputChanged()); // 1 段目を変えた
    act(() => hook.result.current.inputChanged()); // 元の入力 [o1, o3, o6] に戻した
    late.resolve(VALID);
    await act(() => pending);
    expect(hook.result.current.selection?.check).toBeNull(); // 遅れた答えは置かない
    await act(() => hook.result.current.submit(["o1", "o3", "o6"]));
    expect(submits()).toHaveLength(0);
    await act(() => hook.result.current.check(["o1", "o3", "o6"])); // 改めて check
    await act(() => hook.result.current.submit(["o1", "o3", "o6"]));
    expect(submits()).toHaveLength(1);
  });

  it("候補を選び直すと、前の候補の check の答えでは送らない", async () => {
    const { hook, submits } = setup();
    await selectAttach(hook, "c2");
    await act(() => hook.result.current.check(["o1", "o3"]));
    await selectAttach(hook, "c3");
    await act(() => hook.result.current.submit(["o1", "o3"]));
    expect(submits()).toHaveLength(0);
  });
});
