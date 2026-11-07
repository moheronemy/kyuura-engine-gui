// 実行時の検証（模擬の応答）。
import { describe, expect, it } from "vitest";
import * as V from "./validate";
import { candidates, cand, inputs, observation, player, submitResult, view } from "../test/fixtures";

const obs = observation(0, [player(0, { handCards: [] }), player(1)]);

describe("validate", () => {
  it("契約の識別・形式の版・種類を確かめる", () => {
    expect(V.viewResponse(view(0, obs)).viewer).toBe(0);
    expect(() => V.viewResponse({ ...view(0, obs), contract: "other" })).toThrow(V.ProtocolError);
    expect(() => V.viewResponse({ ...view(0, obs), format: 2 })).toThrow(V.ProtocolError);
    expect(() => V.viewResponse({ ...view(0, obs), type: "candidates" })).toThrow(V.ProtocolError);
    expect(() => V.viewResponse("text")).toThrow(V.ProtocolError);
  });

  it("候補の版・知らない区分を拒む", () => {
    expect(V.candidatesResponse(candidates("r", [cand("end_turn")])).response.revision).toBe("r");
    const bad = candidates("r", [cand("end_turn")]);
    (bad.response as Record<string, unknown>).kyuura_legal_actions_format = 2;
    expect(() => V.candidatesResponse(bad)).toThrow(V.ProtocolError);
    expect(() => V.candidatesResponse(candidates("r", [cand("end_turn", "maybe")]))).toThrow(V.ProtocolError);
    expect(() => V.candidatesResponse(candidates("r", [cand("end_turn", "supported", { input_disclosure: "x" })]))).toThrow(V.ProtocolError);
  });

  it("入力の段・拒否・入力非公開", () => {
    expect(() => V.inputsResponse(inputs("k", [{ stage: 1, input: "choose_value", range: { min: 2, max: 1 }, count: { min: 1, max: 1 }, order: "x" }]))).toThrow(V.ProtocolError);
    expect(() => V.inputsResponse(inputs("k", [{ stage: 1, input: "choose_option", count: { min: 0, max: 1 }, order: "x" } as never]))).toThrow(V.ProtocolError);
    const refused = { contract: "kyuura-client-api", format: 1, type: "inputs", ok: false, response: { refusal: { code: "CANDIDATES_STALE", message: "m" } }, refetch_required: true };
    expect(V.inputsResponse(refused).refetch_required).toBe(true);
    expect(V.clientError(refused, "inputs")).toBeNull();
  });

  it("送信の結果と誤りの封筒", () => {
    expect(V.submitResponse(submitResult("accepted")).outcome).toBe("accepted");
    expect(() => V.submitResponse(submitResult("teleported"))).toThrow(V.ProtocolError);
    const err = { contract: "kyuura-client-api", format: 1, type: "view", ok: false, error: { code: "CLIENT_FIELD_UNKNOWN", message: "m" } };
    expect(V.clientError(err, "view")?.error.code).toBe("CLIENT_FIELD_UNKNOWN");
    expect(V.guiError({ gui_server: 1, ok: false, error: { code: "GUI_SEAT_UNKNOWN", message: "m" } })?.code).toBe("GUI_SEAT_UNKNOWN");
  });

  it("公開の更新（ok を持たない封筒）と gap", () => {
    const update = { contract: "kyuura-client-api", format: 1, type: "update", number: 3, status: { status: "in_progress", continuable: true, waiting: [] }, observation: obs };
    const r = V.updatesResponse({ gui_server: 1, ok: true, kind: "updates", latest: 3, oldest_retained: 1, gap: false, updates: [update] });
    expect(r.updates[0]?.number).toBe(3);
    expect(() => V.updatesResponse({ gui_server: 1, ok: true, kind: "updates", latest: 3, gap: false, updates: [{ ...update, format: 9 }] })).toThrow(V.ProtocolError);
    expect(() => V.updatesResponse({ gui_server: 2, ok: true, kind: "updates", latest: 0, gap: false, updates: [] })).toThrow(V.ProtocolError);
  });
});
