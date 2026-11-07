// 1 つの入口（プレイヤー・観戦者・ホスト）の画面の状態。
//
// - この hook を使う部品は (対戦, 入口) ごとに key を変えて作り直す。閲覧者を切り替えると前の閲覧者の手札・候補・診断・ログは
//   部品ごと捨てられ、フロントエンドの状態に残らない（キャッシュで主体を混ぜない）
// - 遅れて届いた応答: 部品が外れたあと・新しい取得が始まったあとの応答は反映しない（世代の番号で比べる）
// - 受理のあとは古い候補・入力を捨てて取り直す。refetch_required の拒否でも取り直す
// - submit は自動で再送しない。結果の分からない通信失敗は「結果不明」と表示し、今の観測を取り直す
// - 更新の番号はエンジンの number（受理でだけ進む）を使う。状態のハッシュは使わない
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientApiError, GuiServerError, NetworkError, type EndpointClient, type Handle } from "../api/transport";
import { ProtocolError } from "../api/validate";
import type { Candidate, CheckResponse, Choice, InputsResponse, LegalActions, Observation, SubmitResponse, ViewResponse } from "../api/types";
import { OUTCOME_LABELS, labelOf } from "../labels";
import type { SubmitGate } from "./submitGate";
import { summarizeUpdate, type LogEntry } from "./logSummary";

export interface Notice {
  id: number;
  tone: "ok" | "info" | "warn" | "error";
  title: string;
  lines: string[];
}

export interface Selection {
  candidate: Candidate;
  handle: Handle;
  inputs: InputsResponse | null;
  check: CheckResponse["response"] | null;
}

export interface SessionState {
  view: ViewResponse | null;
  legal: LegalActions | null;
  selection: Selection | null;
  notices: Notice[];
  log: LogEntry[];
  loading: boolean;
  protocolError: string | null;
  /** 接続層の誤りで使えない（対戦の置き換えなど）。 */
  unavailable: string | null;
}

export interface EndpointSession extends SessionState {
  refresh(): Promise<void>;
  select(candidate: Candidate): Promise<void>;
  clearSelection(): void;
  check(choices: Choice[]): Promise<void>;
  submit(choices: Choice[]): Promise<void>;
  dismissNotice(id: number): void;
}

const MAX_LOG = 200;
const MAX_NOTICES = 6;

const initialState: SessionState = {
  view: null,
  legal: null,
  selection: null,
  notices: [],
  log: [],
  loading: true,
  protocolError: null,
  unavailable: null,
};

interface Options {
  client: EndpointClient;
  /** 候補・送信を持つ入口か（観戦者は持たない）。 */
  canAct: boolean;
  gate: SubmitGate;
  /** 送信が終わったとき（結果によらない）。ほかの画面の取り直しに使う。 */
  onMutated?: () => void;
  /** 値が変わると取り直す（ほかの画面の送信のあと）。 */
  refreshSignal?: number;
  operationPrefix: string;
}

export function useEndpointSession({ client, canAct, gate, onMutated, refreshSignal = 0, operationPrefix }: Options): EndpointSession {
  const [state, setState] = useState<SessionState>(initialState);
  const generation = useRef(0); // 新しい取得・部品の外れで進める。古い世代の応答は捨てる
  const alive = useRef(true);
  const lastUpdate = useRef(0);
  const lastObservation = useRef<Observation | null>(null);
  const noticeId = useRef(0);
  const opCounter = useRef(0);

  const current = (gen: number) => alive.current && generation.current === gen;

  const notify = useCallback((tone: Notice["tone"], title: string, lines: string[] = []) => {
    noticeId.current += 1;
    const notice = { id: noticeId.current, tone, title, lines };
    setState((s) => ({ ...s, notices: [notice, ...s.notices].slice(0, MAX_NOTICES) }));
  }, []);

  const handleError = useCallback(
    (error: unknown, gen: number) => {
      if (!current(gen)) return;
      if (error instanceof ProtocolError) {
        setState((s) => ({ ...s, protocolError: error.message, loading: false, selection: null, legal: null }));
      } else if (error instanceof GuiServerError) {
        setState((s) => ({ ...s, unavailable: `${error.code}: ${error.message}`, loading: false, selection: null, legal: null }));
      } else if (error instanceof ClientApiError) {
        notify("error", `要求の誤り ${error.code}`, [error.message]);
        setState((s) => ({ ...s, loading: false }));
      } else if (error instanceof NetworkError) {
        notify("error", "通信できませんでした", [error.message]);
        setState((s) => ({ ...s, loading: false }));
      } else {
        notify("error", "表示できない誤り", []);
        setState((s) => ({ ...s, loading: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify],
  );

  const refresh = useCallback(async () => {
    generation.current += 1;
    const gen = generation.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const view = await client.view();
      if (!current(gen)) return;
      const legal = canAct ? (await client.candidates()).response : null;
      if (!current(gen)) return;
      const ups = await client.updates(lastUpdate.current);
      if (!current(gen)) return;
      const entries: LogEntry[] = [];
      if (ups.gap) {
        entries.push({
          key: `gap${ups.latest}-${Date.now()}`,
          number: null,
          text: "古い更新は接続層の保持範囲の外です。現在の観測（view）を基準に表示しています。",
          detail: [],
        });
      } else {
        for (const u of ups.updates) {
          entries.push(summarizeUpdate(u, lastObservation.current));
          if (u.observation) lastObservation.current = u.observation;
        }
      }
      lastUpdate.current = ups.latest;
      setState((s) => {
        // 候補が新しい取っ手になったら、前の取っ手の入力は捨てる
        const keep = s.selection && legal && s.selection.handle.revision === legal.revision ? s.selection : null;
        return {
          ...s,
          view,
          legal,
          selection: keep,
          log: [...entries.reverse(), ...s.log].slice(0, MAX_LOG),
          loading: false,
          protocolError: null,
          unavailable: null,
        };
      });
    } catch (error) {
      handleError(error, gen);
    }
  }, [client, canAct, handleError]);

  const refetchCandidates = useCallback(async () => {
    if (!canAct) return;
    generation.current += 1;
    const gen = generation.current;
    try {
      const legal = (await client.candidates()).response;
      if (!current(gen)) return;
      setState((s) => ({ ...s, legal, selection: null }));
    } catch (error) {
      handleError(error, gen);
    }
  }, [client, canAct, handleError]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, [refresh, refreshSignal]);

  const select = useCallback(
    async (candidate: Candidate) => {
      const legal = state.legal;
      if (!legal) return;
      const handle = { game: legal.game, revision: legal.revision, candidate: candidate.id };
      const gen = generation.current;
      setState((s) => ({ ...s, selection: { candidate, handle, inputs: null, check: null } }));
      try {
        const inputs = await client.inputs(handle);
        if (!current(gen)) return;
        if (inputs.refetch_required) {
          notify("warn", "候補が古くなりました。取り直します。");
          await refetchCandidates();
          return;
        }
        setState((s) => (s.selection?.handle === handle ? { ...s, selection: { ...s.selection, inputs } } : s));
      } catch (error) {
        handleError(error, gen);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, state.legal, notify, refetchCandidates, handleError],
  );

  const check = useCallback(
    async (choices: Choice[]) => {
      const sel = state.selection;
      if (!sel) return;
      const gen = generation.current;
      try {
        const answer = await client.check(sel.handle, choices);
        if (!current(gen)) return;
        if (answer.refetch_required) {
          notify("warn", "候補が古くなりました。取り直します。");
          await refetchCandidates();
          return;
        }
        setState((s) => (s.selection?.handle === sel.handle ? { ...s, selection: { ...s.selection, check: answer.response } } : s));
      } catch (error) {
        handleError(error, gen);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, state.selection, notify, refetchCandidates, handleError],
  );

  const submit = useCallback(
    async (choices: Choice[]) => {
      const sel = state.selection;
      if (!sel) return;
      const gen = generation.current;
      opCounter.current += 1;
      const operationId = `${operationPrefix}-${opCounter.current}`;
      const ran = await gate.run(async () => {
        let result: SubmitResponse;
        try {
          result = await client.submit(sel.handle, choices, operationId);
        } catch (error) {
          if (error instanceof NetworkError) {
            // 結果不明: 自動で再送しない。古い候補を捨て、今の観測を取り直す
            if (current(gen)) {
              notify("error", "送信の結果が分かりません", [
                `${error.message}。受理されたかどうか分からないため、自動では送り直しません。`,
                "現在の観測を取り直しました。必要なら画面を確かめてから操作してください。",
              ]);
              setState((s) => ({ ...s, selection: null, legal: null }));
            }
            return "unknown" as const;
          }
          handleError(error, gen);
          return "error" as const;
        }
        if (!current(gen)) return result.outcome; // 閲覧者が切り替わった: この画面には反映しない
        const diag = result.result;
        const lines = [
          ...(result.refusal ? [`${result.refusal.code}: ${result.refusal.message}`] : []),
          ...(diag?.diagnostic_id ? [`${diag.diagnostic_id}（${diag.category ?? "—"}）`] : []),
          ...(diag?.message ? [diag.message] : []),
          ...(diag?.halt?.message ? [`停止: ${diag.halt.message}`] : []),
          `operation_id: ${operationId}（対応付け用。重複の排除はありません）`,
        ];
        const tone = result.outcome === "accepted" ? "ok" : result.outcome === "failed" ? "error" : "warn";
        notify(tone, `${labelOf(OUTCOME_LABELS, result.outcome)}: ${sel.candidate.kind}`, lines);
        if (result.outcome === "accepted" || result.outcome === "failed" || result.refetch_required) {
          setState((s) => ({ ...s, selection: null, legal: result.outcome === "accepted" ? null : s.legal }));
        }
        return result.outcome;
      });
      if (ran === null) return; // 門が使用中（ほかの送信の途中）
      // 送信のあと（結果によらない）: 今の観測から取り直す。onMutated があれば、ほかの画面とまとめて取り直す
      if (onMutated) onMutated();
      else if (alive.current) await refresh();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, state.selection, gate, notify, refresh, onMutated, operationPrefix, handleError],
  );

  const clearSelection = useCallback(() => setState((s) => ({ ...s, selection: null })), []);
  const dismissNotice = useCallback((id: number) => setState((s) => ({ ...s, notices: s.notices.filter((n) => n.id !== id) })), []);

  return { ...state, refresh, select, clearSelection, check, submit, dismissNotice };
}
