// 0.183.0 の log の取得状態（state/visibleLog.ts）。
// 出典: 「実応答」は test/traderLog.ts（導入した 0.183.0 の接続層の HTTP の口の応答そのまま）。「人工」は実応答を写して位置・中身を変えたもの、
// または誤り・遅い応答の模擬（エンジンの情報境界の正しさの確かめには使わない）。
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientApiError, NetworkError, type EndpointClient } from "../api/transport";
import type { LogPosition, LogResponse } from "../api/types";
import { logResponse } from "../api/validate";
import { deferred } from "../test/fixtures";
import { SUDDEN_DEATH_SPECTATOR_PAGES, TRADER_LOG_S2, TRADER_LOG_S3_FROM_PREV, TRADER_LOG_S3 } from "../test/traderLog";
import { initialVisibleLog, mergeLogPage, useVisibleLog, type VisibleLogState } from "./visibleLog";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const PAGES = SUDDEN_DEATH_SPECTATOR_PAGES.map((p, i) => logResponse(clone(p), i === 0 ? null : SUDDEN_DEATH_SPECTATOR_PAGES[i - 1]!.next));
const POSITION_UNKNOWN = () => new ClientApiError("CLIENT_LOG_POSITION_UNKNOWN", "ログの位置がこの対戦の範囲にない");

function client(log: (from: LogPosition | null) => Promise<LogResponse>): EndpointClient & { froms: (LogPosition | null)[] } {
  const froms: (LogPosition | null)[] = [];
  const no = () => Promise.reject(new Error("log 以外を呼んだ"));
  return {
    froms,
    view: no,
    candidates: no,
    inputs: no,
    check: no,
    submit: no,
    updates: no,
    log: (from) => {
      froms.push(from);
      return log(from);
    },
  };
}

function merged(pages: LogResponse[]): VisibleLogState {
  let state: VisibleLogState = initialVisibleLog;
  for (const p of pages) {
    const m = mergeLogPage(state, p);
    if ("conflict" in m) throw new Error(m.conflict);
    state = m;
  }
  return state;
}

describe("mergeLogPage（位置で重ねない・食い違いは止める）", () => {
  it("実応答: 256・256・169 のページを位置の順に足し、complete で終わる", () => {
    const s = merged(PAGES);
    expect(s.entries).toHaveLength(681);
    expect(s.entries.map((e) => e.log_index)).toEqual([...Array(681).keys()]);
    expect(s.complete).toBe(true);
    expect(s.next).toEqual({ segment: 0, index: 681 });
  });

  it("実応答: 同じページをもう一度足しても重ならない（同じ位置の同じ中身）", () => {
    const s = merged([...PAGES, PAGES[1]!, PAGES[2]!]);
    expect(s.entries).toHaveLength(681);
  });

  it("人工: 同じ位置で中身が違えば契約の不整合（黙って上書きしない）", () => {
    const changed = clone(PAGES[0]!);
    (changed.entries[3]!.event as Record<string, unknown>).player = 1 - ((changed.entries[3]!.event.player as number) ?? 0);
    expect(mergeLogPage(merged(PAGES), changed)).toEqual({ conflict: expect.stringContaining("0:3") });
  });

  it("人工: baseline_end が変わる・取得済みの範囲の中に欠けた位置が来るのは不整合。前の位置のページで next は戻らない", () => {
    const s = merged([PAGES[0]!, PAGES[1]!]);
    expect(mergeLogPage(s, { ...clone(PAGES[2]!), baseline_end: { segment: 0, index: 1 } })).toHaveProperty("conflict");
    expect(mergeLogPage(s, { ...clone(PAGES[0]!), entries: [], next: { segment: 0, index: 10 }, complete: false })).toMatchObject({ next: { segment: 0, index: 512 } });
    const missing = clone(PAGES[0]!);
    missing.entries = [{ ...missing.entries[0]!, log_index: 700 }];
    expect(mergeLogPage(merged([PAGES[0]!]), { ...missing, entries: [{ ...missing.entries[0]!, log_index: 10, event: { kind: "other" } }] })).toHaveProperty("conflict");
  });
});

describe("useVisibleLog（取得の流れ）", () => {
  it("実応答: 先頭から complete まで next で続ける。trigger が変わると保持した next から読む", async () => {
    let tail = false;
    const c = client(async (from) => {
      if (tail) return logResponse(clone(TRADER_LOG_S3_FROM_PREV[1][0]), from);
      if (from === null) return PAGES[0]!;
      return from.index === 256 ? PAGES[1]! : PAGES[2]!;
    });
    const { result, rerender } = renderHook(({ t }) => useVisibleLog(c, t, true), { initialProps: { t: 1 } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(c.froms).toEqual([null, { segment: 0, index: 256 }, { segment: 0, index: 512 }]);
    expect(result.current.entries).toHaveLength(681);
    rerender({ t: 2 });
    await waitFor(() => expect(c.froms).toHaveLength(4));
    expect(c.froms[3]).toEqual({ segment: 0, index: 681 }); // 保持した next から（先頭からではない）
  });

  it("実応答: 交換おじさんの追記（前の時点の next から）を足す", async () => {
    let phase = 2;
    const c = client(async (from) => {
      if (phase === 2) return logResponse(clone(TRADER_LOG_S2[1][0]), from);
      return logResponse(clone(TRADER_LOG_S3_FROM_PREV[1][0]), from);
    });
    const { result, rerender } = renderHook(({ t }) => useVisibleLog(c, t, true), { initialProps: { t: 1 } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    phase = 3;
    rerender({ t: 2 });
    await waitFor(() => expect(result.current.entries).toHaveLength(5));
    expect(result.current.entries).toEqual(logResponse(clone(TRADER_LOG_S3[1][0]), null).entries);
  });

  it("人工（遅い応答）: 取得中に来た求めは 1 回分にまとめ、終わったあとにもう一度読む（並行にしない・取りこぼさない）", async () => {
    const gates = [deferred<LogResponse>(), deferred<LogResponse>()];
    let n = 0;
    const c = client(() => gates[n++]!.promise);
    const { result, rerender } = renderHook(({ t }) => useVisibleLog(c, t, true), { initialProps: { t: 1 } });
    rerender({ t: 2 });
    rerender({ t: 3 });
    expect(c.froms).toEqual([null]); // 並行に重ねない
    await act(async () => gates[0]!.resolve(logResponse(clone(TRADER_LOG_S2[1][0]), null)));
    await waitFor(() => expect(c.froms).toHaveLength(2)); // まとめた 1 回分
    expect(c.froms[1]).toEqual({ segment: 0, index: 2 });
    await act(async () => gates[1]!.resolve(logResponse(clone(TRADER_LOG_S3_FROM_PREV[1][0]), { segment: 0, index: 2 })));
    await waitFor(() => expect(result.current.entries).toHaveLength(5));
    expect(c.froms).toHaveLength(2);
  });

  it("人工: CLIENT_LOG_POSITION_UNKNOWN では先頭から 1 回だけ取り直す", async () => {
    let first = true;
    const c = client(async (from) => {
      if (from !== null || first) {
        first = false;
        if (from !== null) throw POSITION_UNKNOWN();
      }
      return logResponse(clone(TRADER_LOG_S2[1][0]), from);
    });
    const { result, rerender } = renderHook(({ t }) => useVisibleLog(c, t, true), { initialProps: { t: 1 } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ t: 2 }); // 保持した next（0:2）から → 位置の不明 → 先頭から
    await waitFor(() => expect(c.froms).toHaveLength(3));
    expect(c.froms).toEqual([null, { segment: 0, index: 2 }, null]);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.entries).toHaveLength(2);
  });

  it("人工: 取り直しも位置の不明なら誤りを示して止める（無限に取り直さない。trigger が変わっても自動では読まない）", async () => {
    let calls = 0;
    const c = client(async () => {
      calls += 1;
      throw POSITION_UNKNOWN();
    });
    const { result, rerender } = renderHook(({ t }) => useVisibleLog(c, t, true), { initialProps: { t: 1 } });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(calls).toBe(2);
    expect(result.current.error).toMatch(/CLIENT_LOG_POSITION_UNKNOWN.*取り直しても/);
    rerender({ t: 2 });
    rerender({ t: 3 });
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(calls).toBe(2);
    act(() => result.current.retry()); // 画面のボタンだけが先頭から読み直す
    await waitFor(() => expect(calls).toBe(4));
  });

  it("人工: 通信の失敗は誤りの状態（空のログ・取得済みとして扱わない）", async () => {
    const c = client(async () => {
      throw new NetworkError();
    });
    const { result } = renderHook(() => useVisibleLog(c, 1, true));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.complete).toBe(false);
    expect(result.current.error).toMatch(/通信できなかった/);
  });

  it("人工（遅い応答）: 部品が外れたあと・取り直しを始めたあとに届いた応答は置かない", async () => {
    const late = deferred<LogResponse>();
    const c = client(() => late.promise);
    const { result, unmount } = renderHook(() => useVisibleLog(c, 1, true));
    const before = result.current;
    unmount();
    await act(async () => late.resolve(logResponse(clone(TRADER_LOG_S2[1][0]), null)));
    expect(result.current.entries).toEqual(before.entries);

    const gates = [deferred<LogResponse>(), deferred<LogResponse>()];
    let n = 0;
    const c2 = client(() => gates[n++]!.promise);
    const h = renderHook(() => useVisibleLog(c2, 1, true));
    act(() => h.result.current.retry());
    await act(async () => gates[0]!.resolve(logResponse(clone(TRADER_LOG_S3[1][0]), null))); // 古い世代
    expect(h.result.current.entries).toEqual([]);
    await act(async () => gates[1]!.resolve(logResponse(clone(TRADER_LOG_S2[1][0]), null)));
    await waitFor(() => expect(h.result.current.entries).toHaveLength(2));
  });

  it("enabled が偽（ホストの画面）なら読まない", async () => {
    const c = client(async () => PAGES[0]!);
    renderHook(() => useVisibleLog(c, 1, false));
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(c.froms).toEqual([]);
  });
});
