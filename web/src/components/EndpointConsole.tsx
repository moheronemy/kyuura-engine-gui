// 1 つの入口の画面（閲覧者の画面とローカルホストの画面で共通）。
// 呼び出し側が (対戦, 入口) ごとに key を変えて作り直すので、切り替え前の閲覧者の状態はここに残らない。
import { useMemo } from "react";
import type { EndpointClient } from "../api/transport";
import type { PlayerIndex } from "../api/types";
import type { SubmitGate } from "../state/submitGate";
import { useEndpointSession } from "../state/useEndpointSession";
import { Board } from "./Board";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel, LogPanel, NoticesPanel, StatusPanel } from "./Panels";

interface Props {
  client: EndpointClient;
  kind: "player" | "spectator" | "host";
  viewer: PlayerIndex | null;
  gate: SubmitGate;
  names: (id: string) => string | undefined;
  refreshSignal: number;
  onMutated(): void;
  operationPrefix: string;
  showBoard: boolean;
}

export function EndpointConsole({ client, kind, viewer, gate, names, refreshSignal, onMutated, operationPrefix, showBoard }: Props) {
  const canAct = kind !== "spectator";
  const session = useEndpointSession({ client, canAct, gate, onMutated, refreshSignal, operationPrefix });
  const blocked = Boolean(session.protocolError || session.unavailable);
  const observation = session.view?.observation ?? null;
  const selectionKey = useMemo(
    () => (session.selection ? `${session.selection.handle.revision}:${session.selection.handle.candidate}:${session.selection.inputs ? "i" : "-"}` : ""),
    [session.selection],
  );

  return (
    <div className={`console console-${kind}`} aria-busy={session.loading}>
      {session.protocolError ? (
        <div className="callout error" role="alert">
          <strong>不明な応答</strong>: {session.protocolError}。安全のため操作を止めました。
          <button type="button" onClick={() => void session.refresh()}>
            取り直す
          </button>
        </div>
      ) : null}
      {session.unavailable ? (
        <div className="callout error" role="alert">
          <strong>接続層の誤り</strong>: {session.unavailable}
          <button type="button" onClick={() => void session.refresh()}>
            取り直す
          </button>
        </div>
      ) : null}
      <div className="console-grid">
        <div className="console-main">
          {session.view ? <StatusPanel view={session.view} /> : <p className="muted">観測を取得しています…</p>}
          {showBoard && session.view ? <Board observation={session.view.observation} viewer={viewer} names={names} /> : null}
        </div>
        <div className="console-side">
          <div className="toolbar">
            <button type="button" onClick={() => void session.refresh()} disabled={session.loading}>
              {session.loading ? "取得中…" : "再取得"}
            </button>
            {gate.busy ? <span className="small" role="status">送信中（ほかの送信はできません）</span> : null}
          </div>
          <NoticesPanel notices={session.notices} onDismiss={session.dismissNotice} />
          {canAct && session.legal && !blocked ? (
            <CandidatesPanel
              legal={session.legal}
              selectedId={session.selection?.candidate.id ?? null}
              disabled={gate.busy || blocked}
              onSelect={(c) => void session.select(c)}
            />
          ) : null}
          {canAct && session.selection && !blocked ? (
            <DecisionPanel
              key={selectionKey}
              selection={session.selection}
              observation={observation}
              names={names}
              busy={gate.busy}
              blocked={blocked}
              onCheck={(choices) => void session.check(choices)}
              onSubmit={(choices) => void session.submit(choices)}
              onCancel={session.clearSelection}
            />
          ) : null}
          {!canAct ? <p className="callout info small">観戦者は観測と公開の更新だけを受け取ります（候補・送信はありません）。</p> : null}
          <LogPanel log={session.log} />
        </div>
      </div>
    </div>
  );
}
