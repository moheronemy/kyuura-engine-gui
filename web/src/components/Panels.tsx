import type { Candidate, LegalActions, StatusInfo, ViewResponse } from "../api/types";
import { TURN_KINDS_NOT_COVERED } from "../api/contract";
import {
  COMPLETENESS_TEXT,
  EMPTY_REASON_LABELS,
  HALT_CATEGORY_LABELS,
  KIND_LABELS,
  NEXT_LABELS,
  PHASE_LABELS,
  SITUATION_LABELS,
  STATUS_LABELS,
  labelOf,
  playerLabel,
  waitingByLabel,
} from "../labels";
import type { LogEntry } from "../state/logSummary";
import type { Notice } from "../state/useEndpointSession";
import { DisclosureBadge, ProcessabilityBadge } from "./Badges";

export function StatusPanel({ view }: { view: ViewResponse }) {
  const s: StatusInfo = view.status;
  const o = view.observation;
  return (
    <section className="panel status" aria-label="対戦の状態">
      <h2>状態</h2>
      <dl className="status-grid">
        <div>
          <dt>状態</dt>
          <dd>
            <strong>{labelOf(STATUS_LABELS, s.status)}</strong> <code className="muted small">{s.status}</code>
          </dd>
        </div>
        <div>
          <dt>段階</dt>
          <dd>
            {labelOf(PHASE_LABELS, s.phase ?? o.phase)} <code className="muted small">{s.phase ?? o.phase}</code>
          </dd>
        </div>
        <div>
          <dt>番</dt>
          <dd>
            {o.turn}
            {o.current_player != null ? `（${playerLabel(o.current_player)}の番）` : ""}
          </dd>
        </div>
        <div>
          <dt>区間</dt>
          <dd>{s.segment ? `延長戦 ${s.segment}` : "最初の対戦"}</dd>
        </div>
        <div className="wide">
          <dt>入力待ち</dt>
          <dd>
            {s.waiting.length ? (
              <ul className="inline-list">
                {s.waiting.map((w, i) => (
                  <li key={i}>
                    {waitingByLabel(w.by)}: {labelOf(NEXT_LABELS, w.kind)}
                  </li>
                ))}
              </ul>
            ) : (
              "なし"
            )}
          </dd>
        </div>
        {s.convention_set ? (
          <div className="wide">
            <dt>規約集合</dt>
            <dd>
              <code>
                {s.convention_set.id}@{s.convention_set.version}
              </code>
            </dd>
          </div>
        ) : null}
      </dl>
      {s.halt ? (
        <div className="callout error" role="alert">
          <strong>停止</strong>（{labelOf(HALT_CATEGORY_LABELS, s.halt.category)}）: {s.halt.message ?? ""}
          <br />
          <code>{s.halt.diagnostic_id ?? "—"}</code>
          {s.halt.case_status ? <span className="small muted"> case_status: {s.halt.case_status}</span> : null}
          {s.halt.interrupted ? <span className="small"> （途中停止）</span> : null}
          <p className="small">未裁定・未対応による停止は、ゲーム上の禁止ではありません。</p>
        </div>
      ) : null}
      {o.result ? (
        <div className={`callout ${o.result.outcome === "sudden_death" ? "info" : "ok"}`} role="status">
          <strong>{o.result.outcome === "sudden_death" ? "サドン・デス" : "終局"}</strong>: <code>{o.result.outcome}</code>
          {o.result.winner != null ? `（${playerLabel(o.result.winner)}の勝ち）` : ""}
          {s.status === "game_over" ? <p className="small">終局の理由が山札切れでも、番を終えるだけの確認であり、通常の対戦機能の完成ではありません。</p> : null}
        </div>
      ) : null}
      {s.status === "sudden_death_pending" ? (
        <p className="callout info">サドン・デスに移りました。ローカルホストの画面から延長戦を始めます。</p>
      ) : null}
      {o.segment ? (
        <p className="small">
          延長戦 {o.segment.index}・サイド {o.segment.prize_count} 枚・終わった区間 {o.segment.previous.length}
        </p>
      ) : null}
    </section>
  );
}

export function CandidatesPanel({
  legal,
  selectedId,
  disabled,
  onSelect,
}: {
  legal: LegalActions;
  selectedId: string | null;
  disabled: boolean;
  onSelect(c: Candidate): void;
}) {
  return (
    <section className="panel candidates" aria-label="操作候補">
      <h2>操作候補</h2>
      <p>
        {labelOf(SITUATION_LABELS, legal.situation)} <code className="muted small">{legal.situation}</code>
      </p>
      {legal.candidates.length === 0 ? (
        <p className="muted">候補はありません。{legal.empty_reason ? labelOf(EMPTY_REASON_LABELS, legal.empty_reason) : ""}</p>
      ) : (
        <ul className="candidate-list">
          {legal.candidates.map((c) => (
            <li key={c.id} className={selectedId === c.id ? "selected" : undefined}>
              <div className="candidate-head">
                <strong>{labelOf(KIND_LABELS, c.kind)}</strong> <code className="muted small">{c.kind}</code>
              </div>
              <div className="badges">
                <ProcessabilityBadge value={c.processability} />
                <DisclosureBadge value={c.input_disclosure} />
              </div>
              {c.reasons.length ? <p className="small muted">理由: {c.reasons.join("・")}</p> : null}
              <details>
                <summary>保証の範囲（guarantees）</summary>
                <dl className="guarantees">
                  {Object.entries(c.guarantees).map(([k, v]) => (
                    <div key={k}>
                      <dt>
                        <code>{k}</code>
                      </dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="small">supported・may_stop_later でも、ここに書かれた範囲を超えて対戦の完走は保証されません。</p>
              </details>
              <button type="button" onClick={() => onSelect(c)} disabled={disabled} aria-pressed={selectedId === c.id}>
                {selectedId === c.id ? "入力中" : "この操作を選ぶ"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <CoveragePanel legal={legal} />
    </section>
  );
}

export function CoveragePanel({ legal }: { legal: LegalActions }) {
  const cov = legal.coverage;
  return (
    <details className="coverage" open={cov.not_covered_kinds.length > 0}>
      <summary>
        対応範囲（coverage）: <code>{cov.completeness}</code>
      </summary>
      <p className="small">{COMPLETENESS_TEXT[cov.completeness] ?? cov.completeness}</p>
      <p className="small muted">{cov.completeness_scope}</p>
      <dl className="coverage-grid">
        <div>
          <dt>この応答の範囲（scope_kinds）</dt>
          <dd>{cov.scope_kinds.length ? cov.scope_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・") : "なし"}</dd>
        </div>
        <div>
          <dt>候補に出した種類（offered_kinds）</dt>
          <dd>{cov.offered_kinds.length ? cov.offered_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・") : "なし"}</dd>
        </div>
        <div>
          <dt>入力非公開の候補（withheld_input_candidates）</dt>
          <dd>{cov.withheld_input_candidates.length ? cov.withheld_input_candidates.join("・") : "なし"}</dd>
        </div>
        <div>
          <dt>API が実装した種類（implemented_kinds）</dt>
          <dd>{cov.implemented_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・")}</dd>
        </div>
      </dl>
      {cov.not_covered_kinds.length ? (
        <div className="unsupported" aria-label="未対応の操作">
          <h3>未対応の操作（not_covered_kinds）</h3>
          <p className="small">現行の API（U7-1・U7-2）では候補に出ない種類です。ゲーム上の禁止ではありません。この GUI では操作として作っていません。</p>
          <ul className="inline-list">
            {cov.not_covered_kinds.map((k) => (
              <li key={k}>
                <span className="unsupported-item" aria-disabled="true">
                  {labelOf(KIND_LABELS, k)} <code className="small">{k}</code>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}

/** 現在できる操作と未対応の操作の常設の説明。 */
export function ScopeNote() {
  return (
    <details className="panel scope-note">
      <summary>この GUI でできること・できないこと</summary>
      <p>
        できる操作: 最初のポケモンを置く・切り直しの補償・ジャンケンの結果の入力（ホスト）・番を終える・決定への回答（サイドを取る・バトル場に出す・その他の決定）・サドン・デスの開始（ホスト）。
      </p>
      <p>
        未対応（現行 API で操作できない）: {TURN_KINDS_NOT_COVERED.map((k) => labelOf(KIND_LABELS, k)).join("・")}。ワザ名などは表示だけです。
      </p>
      <p className="small">
        番を終えるだけで進めると山札がなくなって終局しますが、通常の対戦機能が完成したという意味ではありません。
      </p>
    </details>
  );
}

export function NoticesPanel({ notices, onDismiss }: { notices: Notice[]; onDismiss(id: number): void }) {
  if (!notices.length) return null;
  return (
    <section className="panel notices" aria-label="診断と結果" aria-live="polite">
      <h2>診断・結果</h2>
      <ul>
        {notices.map((n) => (
          <li key={n.id} className={`callout ${n.tone}`}>
            <div className="notice-head">
              <strong>{n.title}</strong>
              <button type="button" className="link" onClick={() => onDismiss(n.id)} aria-label="この知らせを閉じる">
                閉じる
              </button>
            </div>
            {n.lines.map((l, i) => (
              <p key={i} className="small">
                {l}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LogPanel({ log }: { log: LogEntry[] }) {
  return (
    <section className="panel log" aria-label="対戦ログ">
      <h2>ログ（この閲覧者に届いた公開の更新）</h2>
      <p className="small muted">
        接続層が閲覧者ごとに保持する最近の更新の要約です。エンジンの対戦ログ（visible_log）は現行の client_api の応答に含まれません。
      </p>
      {log.length === 0 ? (
        <p className="muted small">まだ更新はありません。</p>
      ) : (
        <ol className="log-list" reversed>
          {log.map((e) => (
            <li key={e.key}>
              <span>{e.text}</span>
              {e.detail.length ? (
                <ul>
                  {e.detail.map((d, i) => (
                    <li key={i} className="small">
                      {d}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
