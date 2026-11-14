// 0.183.0 の読み取りの要求 log の取得状態（docs/engine-contract.md 25 章）。
//
// - 状態は 1 つの入口の画面（EndpointConsole）ごと。画面は (対戦, 入口) ごとに key を変えて作り直すので、ゲーム・閲覧者の取得状態は混ざらない
// - 持つのは取得済みの出来事（位置の順）・次の位置 next・baseline_end・complete と、取得の状態だけ
// - 初回は from なし（先頭）。complete まで next で続ける。view を取り直すたび（初回・更新・再取得・送信のあと）に、保持した next から追記を取る。
//   更新の保持（接続層の 100 件・gap）とは独立（gap でもログの位置はそのまま使える）
// - 同じ位置の出来事は重ねない（前に読んだ範囲のページでも位置を戻さない）。同じ位置で中身が違う・baseline_end が変わった・取得済みの範囲の中に欠けた位置が来た応答は、
//   契約の不整合として止める（黙って上書きしない）
// - 取得は 1 本だけ。取得中に来た取得の求めは 1 回分にまとめ、終わったあとにもう一度回す（追記の取りこぼしなし）
// - 部品が外れた・取り直しを始めたあとに届いた応答は捨てる（世代の番号）
// - CLIENT_LOG_POSITION_UNKNOWN: 取得状態を消して先頭から 1 回だけ取り直す。取り直しも失敗したら誤りを表示して止める（自動では繰り返さない）
// - 読み取りの失敗は誤りとして表示する（空・「公開されなかった」と扱わない）。送信・check・候補には関わらない
import { useCallback, useEffect, useRef, useState } from "react";
import { LOG } from "../api/contract";
import { ClientApiError, GuiServerError, NetworkError, type EndpointClient } from "../api/transport";
import type { LogItem, LogPosition, LogResponse } from "../api/types";
import { ProtocolError } from "../api/validate";

export interface VisibleLogState {
  entries: LogItem[];
  next: LogPosition | null;
  baselineEnd: LogPosition | null;
  complete: boolean;
  status: "loading" | "ready" | "error";
  error: string | null;
  /** 位置の不明で先頭から取り直したあと、まだ complete まで読めていない（もう一度の位置の不明は止める）。 */
  restarted: boolean;
}

export const initialVisibleLog: VisibleLogState = { entries: [], next: null, baselineEnd: null, complete: false, status: "loading", error: null, restarted: false };

/** JSON の値を名前の順で文字列にする（同じ位置の中身の比べに使う。名前の並びの違いを差にしない）。 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const key = (segment: number, index: number) => `${segment}:${index}`;
const before = (a: LogPosition, b: LogPosition) => a.segment < b.segment || (a.segment === b.segment && a.index < b.index);
export const positionOf = (item: LogItem): LogPosition => ({ segment: item.segment, index: item.log_index });
/** 出来事が baseline_end より前（hub を作った時点の投影）か。 */
export const beforeBaseline = (item: LogItem, baselineEnd: LogPosition | null) => baselineEnd !== null && before(positionOf(item), baselineEnd);

/** 取得した 1 ページを足す。不整合なら { conflict }。同じ位置の同じ中身は重ねない。 */
export function mergeLogPage(state: VisibleLogState, page: LogResponse): VisibleLogState | { conflict: string } {
  if (state.baselineEnd && canonical(state.baselineEnd) !== canonical(page.baseline_end)) return { conflict: "baseline_end が前の応答と違う" };
  const known = new Map(state.entries.map((e) => [key(e.segment, e.log_index), e]));
  const entries = [...state.entries];
  for (const item of page.entries) {
    const existing = known.get(key(item.segment, item.log_index));
    if (existing) {
      if (canonical(existing) !== canonical(item)) return { conflict: `同じ位置（${item.segment}:${item.log_index}）の出来事の中身が前の応答と違う` };
      continue;
    }
    const last = entries[entries.length - 1];
    if (last && !before(positionOf(last), positionOf(item))) return { conflict: `位置（${item.segment}:${item.log_index}）が取得済みの範囲の中で欠けていた` };
    entries.push(item);
    known.set(key(item.segment, item.log_index), item);
  }
  // 前に読んだ範囲のページ（中身はすべて既知で同じ）なら、位置を戻さない
  const regress = state.next !== null && before(page.next, state.next);
  const next = regress ? state.next! : page.next;
  const complete = regress ? state.complete : page.complete;
  return { ...state, entries, next, baselineEnd: page.baseline_end, complete, restarted: complete ? false : state.restarted };
}

function describe(error: unknown): string {
  if (error instanceof ClientApiError) return `${error.code}: ${error.message}`;
  if (error instanceof GuiServerError) return `${error.code}: ${error.message}`;
  if (error instanceof ProtocolError) return error.message;
  if (error instanceof NetworkError) return error.message;
  return "表示できない誤り";
}

export interface VisibleLog extends VisibleLogState {
  /** 誤りで止まったあと、取得状態を消して先頭から取り直す（画面のボタン。自動では呼ばない）。 */
  retry(): void;
}

/**
 * 1 つの入口の可視ログを取る。trigger が変わるたび（view の取り直し）に、保持した next から complete まで読む。enabled が偽なら取らない（ホストの画面）。
 */
export function useVisibleLog(client: EndpointClient, trigger: unknown, enabled: boolean): VisibleLog {
  const [state, setState] = useState<VisibleLogState>(initialVisibleLog);
  const ref = useRef<VisibleLogState>(initialVisibleLog);
  const generation = useRef(0);
  const running = useRef(false);
  const pending = useRef(false);

  const put = (next: VisibleLogState) => {
    ref.current = next;
    setState(next);
  };

  const drain = useCallback(
    async (gen: number) => {
      for (;;) {
        const from = ref.current.next;
        let page: LogResponse;
        try {
          page = await client.log(from);
        } catch (error) {
          if (gen !== generation.current) return;
          if (error instanceof ClientApiError && error.code === LOG.position_unknown && !ref.current.restarted) {
            put({ ...initialVisibleLog, restarted: true }); // そのゲーム・閲覧者の取得状態を消して、先頭から 1 回だけ取り直す
            continue;
          }
          const again = error instanceof ClientApiError && error.code === LOG.position_unknown ? "（先頭から取り直しても位置が範囲にありませんでした）" : "";
          put({ ...ref.current, status: "error", error: `${describe(error)}${again}` });
          return;
        }
        if (gen !== generation.current) return; // 部品が外れた・取り直しを始めたあとの応答は捨てる
        const merged = mergeLogPage(ref.current, page);
        if ("conflict" in merged) {
          put({ ...ref.current, status: "error", error: `契約の不整合: ${merged.conflict}` });
          return;
        }
        put({ ...merged, status: merged.complete ? "ready" : "loading", error: null });
        if (merged.complete) return;
      }
    },
    [client],
  );

  const stopped = () => ref.current.status === "error";

  const run = useCallback(async () => {
    if (!enabled || stopped()) return;
    if (running.current) {
      pending.current = true; // 取得中の求めは 1 回分にまとめ、終わったあとにもう一度
      return;
    }
    running.current = true;
    const gen = generation.current;
    try {
      do {
        pending.current = false;
        await drain(gen);
      } while (pending.current && gen === generation.current && !stopped());
    } finally {
      if (gen === generation.current) running.current = false;
    }
  }, [drain, enabled]);

  useEffect(() => {
    void run();
  }, [run, trigger]);

  useEffect(
    () => () => {
      generation.current += 1; // 外れたあとの応答は置かない
      running.current = false;
      pending.current = false;
    },
    [],
  );

  const retry = useCallback(() => {
    generation.current += 1;
    running.current = false;
    pending.current = false;
    put(initialVisibleLog);
    void run();
  }, [run]);

  return { ...state, retry };
}
