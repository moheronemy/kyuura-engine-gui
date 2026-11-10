import type { Candidate, LegalActions, StatusInfo, ViewResponse } from "../api/types";
import { DISPLAY_ONLY_KINDS, GUI_OPERABLE_KINDS, TURN_BASIC_KINDS } from "../api/contract";
import {
  COMPLETENESS_TEXT,
  EMPTY_REASON_LABELS,
  RESIDUAL_STATUS_TEXT,
  RESIDUAL_TEXT,
  HALT_CATEGORY_LABELS,
  KIND_LABELS,
  NEXT_LABELS,
  PHASE_LABELS,
  SITUATION_LABELS,
  STATUS_LABELS,
  labelOf,
  playerLabel,
  reasonsText,
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
              {c.reasons.length ? <p className="small muted">理由: {reasonsText(c.reasons)}</p> : null}
              {c.power && c.pokemon ? (
                // U7-5e: 同じ種類の候補がいくつも並ぶので、エンジンが返した特殊能力の名前と使うポケモンを見出しの下に出す（候補は id で区別する）
                // v0.172: 本人のうらのカードは、場所と「裏向き」だけを盤面の情報として、本当のカードを本人の知識として分けて書く
                <p className="small power-head">
                  ［{c.power.name_ja}］ —{" "}
                  {c.pokemon.face_down ? (
                    <>
                      裏向きのポケモン（{c.pokemon.zone === "active" ? "バトル場" : `ベンチ${(c.pokemon.bench_index ?? 0) + 1}`}）・あなただけが知るカード <code>{c.power.card_id}</code>
                    </>
                  ) : (
                    <>
                      <code>{c.pokemon.card_id}</code>（{c.pokemon.zone === "active" ? "バトル場" : `ベンチ${(c.pokemon.bench_index ?? 0) + 1}`}）
                    </>
                  )}
                </p>
              ) : null}
              {c.stadium ? (
                // U7-5d: 場のスタジアム（公開）。持ち主は出したプレイヤーで、使うのは番のプレイヤー
                <p className="small">
                  場のスタジアム: <code>{c.stadium.card_id}</code>（持ち主: {playerLabel(c.stadium.owner)}）
                </p>
              ) : null}
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
              {GUI_OPERABLE_KINDS.has(c.kind) ? (
                <button type="button" onClick={() => onSelect(c)} disabled={disabled} aria-pressed={selectedId === c.id}>
                  {selectedId === c.id ? "入力中" : "この操作を選ぶ"}
                </button>
              ) : DISPLAY_ONLY_KINDS.has(c.kind) && legal.coverage.display_only_kinds.includes(c.kind) ? (
                // U7-5f: 表示だけの候補。位置を見る（inputs だけ）。check・submit は呼ばない
                <>
                  <p className="small warn">表示だけ（送れません）: 未裁定のため、エンジンは送ってもゲームに渡す前に断ります。ゲーム上の禁止ではありません。</p>
                  {c.input_disclosure === "confirmed" ? (
                    <button type="button" onClick={() => onSelect(c)} disabled={disabled} aria-pressed={selectedId === c.id}>
                      {selectedId === c.id ? "表示中" : "位置を表示する（表示だけ）"}
                    </button>
                  ) : null}
                </>
              ) : (
                // 知らない種類: 入力の形を確かめていないので、古い入力の画面へ通さない（操作しない）
                <p className="small warn">この GUI はこの種類の入力の画面を持っていません（表示だけ）。</p>
              )}
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
  // U7-3〜U7-5: scope_kinds は「評価した種類」と未対応の種類。評価して候補に出さなかった種類は、この状態ではゲーム上できない（または入力がない）もの
  const notOffered = cov.scope_kinds.filter((k) => !cov.offered_kinds.includes(k) && !cov.not_covered_kinds.includes(k));
  const evaluated = cov.scope_kinds.filter((k) => !cov.not_covered_kinds.includes(k));
  // v0.172（U7-5g-3）: この応答に当てはまる残り。public は公開の状態から、actor は本人の候補から（この閲覧者の応答に届いたものだけ。ほかの主体の残りは混ぜない）
  const present = cov.residual.present;
  const classOf = (id: string) => cov.residual.classes.find((c) => c.id === id);
  const partialBy = cov.partial_residual.map(classOf).filter((c) => c !== undefined);
  return (
    <details className="coverage" open={cov.not_covered_kinds.length > 0 || cov.partial_residual.length > 0}>
      <summary>
        対応範囲（coverage）: <code>{cov.completeness}</code>
      </summary>
      <p className="small">{COMPLETENESS_TEXT[cov.completeness] ?? cov.completeness}</p>
      <p className="small muted">{cov.completeness_scope}</p>
      <p className="small muted" aria-label="complete の意味">
        {cov.completeness_basis}
      </p>
      <p className="small">
        未対応の種類がなくても（not_covered_kinds が空でも）、全部の操作に対応した・必ず完走するという意味ではありません。受理・完走は送るまで分かりません（処理可能性・未確認の経路は別の軸です）。この表示から、ほかの主体が操作できるかどうかは決めません。
      </p>
      <dl className="coverage-grid">
        <div>
          <dt>候補の種類として評価した種類</dt>
          <dd aria-label="評価した種類">{evaluated.length ? evaluated.map((k) => labelOf(KIND_LABELS, k)).join("・") : "なし"}</dd>
        </div>
        <div>
          <dt>表示だけで送れない種類（display_only_kinds）</dt>
          <dd aria-label="表示だけの種類">
            {cov.display_only_kinds.length ? `${cov.display_only_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・")}（未裁定。ゲーム上の禁止ではない）` : "なし"}
          </dd>
        </div>
        <div>
          <dt>種類の中に、示していない経路が残る（partial_residual）</dt>
          <dd aria-label="示していない経路">
            {partialBy.length ? (
              <ul className="inline-list">
                {partialBy.map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code> {labelOf(KIND_LABELS, c.kind ?? "")}: {RESIDUAL_TEXT[c.id] ?? c.note}
                  </li>
                ))}
              </ul>
            ) : (
              "なし"
            )}
          </dd>
        </div>
        <div>
          <dt>この応答に当てはまる残り（residual.present）</dt>
          <dd aria-label="当てはまる残り">
            {present.length ? (
              <ul>
                {present.map((p) => {
                  const c = classOf(p.id);
                  return (
                    <li key={`${p.id}/${p.candidate ?? ""}`} className="small">
                      <code>{p.id}</code>（{labelOf(RESIDUAL_STATUS_TEXT, c?.status ?? "")}・{p.scope === "actor" ? `あなたの候補 ${p.candidate}` : "公開の状態から"}）: {RESIDUAL_TEXT[p.id] ?? c?.note}
                    </li>
                  );
                })}
              </ul>
            ) : (
              "なし"
            )}
          </dd>
        </div>
        <div>
          <dt>入力を返していない候補（withheld_input_candidates）</dt>
          <dd aria-label="入力を返していない候補">{cov.withheld_input_candidates.length ? `${cov.withheld_input_candidates.join("・")}（入力非公開。送れません）` : "なし"}</dd>
        </div>
        <div>
          <dt>送るまで受理が分からない経路（unverified_paths）</dt>
          <dd aria-label="未確認の経路">
            {cov.unverified_paths.length
              ? cov.unverified_paths.map((p) => `${reasonsText([p.reason])}: ${p.candidates.join("・")}`).join(" ／ ")
              : "なし"}
          </dd>
        </div>
        <div>
          <dt>この応答の範囲（scope_kinds。評価した種類と未対応の種類）</dt>
          <dd>{cov.scope_kinds.length ? cov.scope_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・") : "なし"}</dd>
        </div>
        <div>
          <dt>候補に出した種類（offered_kinds）</dt>
          <dd>{cov.offered_kinds.length ? cov.offered_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・") : "なし"}</dd>
        </div>
        <div>
          <dt>評価して候補に出さなかった種類</dt>
          <dd aria-label="評価して候補に出さなかった種類">
            {notOffered.length ? `${notOffered.map((k) => labelOf(KIND_LABELS, k)).join("・")}（エンジンの確かめで、今はできない）` : "なし"}
          </dd>
        </div>
        <div>
          <dt>API が実装した種類（implemented_kinds）</dt>
          <dd>{cov.implemented_kinds.map((k) => labelOf(KIND_LABELS, k)).join("・")}</dd>
        </div>
      </dl>
      {cov.not_covered_kinds.length ? (
        <div className="unsupported" aria-label="未対応の操作">
          <h3>この応答で API の対象範囲外の種類（not_covered_kinds）</h3>
          <p className="small">
            この応答の状況では、API（U7-1〜U7-5g）が評価も候補の作成もしない種類です（たとえば、番のプレイヤーの MAIN のほかでの、相手の山札のおもてのカードの確かめ: R-4）。ゲーム上の禁止ではありません。「操作がない」という意味でもありません。この GUI では操作として作っていません。
          </p>
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
        できる操作: 最初のポケモンを置く・切り直しの補償・ジャンケンの結果の入力（ホスト）・番を終える・{TURN_BASIC_KINDS.map((k) => labelOf(KIND_LABELS, k)).join("・")}・ワザの宣言（ワザ → 宣言といっしょに選ぶもの）・手札のトレーナーを使う（どうぐ・手札から出すスタジアム・化石・人形を含む）・場のスタジアムを使う・「ばける」でのせたカードを外す・化石・人形を場からすてる・うらのカードをおもてにする・決定への回答（サイドを取る・バトル場に出す・ワザやトレーナーの対象・相手が答える決定などの決定）・サドン・デスの開始（ホスト）。番の操作は、エンジンが候補に出したものだけを選べます。
      </p>
      <p>
        表示だけ（送れない）: 表向きの山札のカードを確かめる（未裁定）。残る未対応の経路: R-2（うらのバトル場のポケモンのワザといっしょに選ぶもの）・R-3（うらのカードの特殊能力のうち入力を作れない型）・R-4（番のプレイヤーの MAIN のほかの、おもての山札のカードの確かめ）・R-5（入力を返さない候補）。
      </p>
      <p className="small">
        ワザ・トレーナー・場のスタジアム・特殊能力で終局・停止まで進められますが、上の残りがあり、通常の対戦機能が完成した・必ず完走するという意味ではありません。
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
