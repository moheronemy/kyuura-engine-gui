// 0.182.0・0.183.0: エンジンの公開のログ（読み取りの要求 log）のうち、見せたカードの出来事だけの表示（docs/engine-contract.md 25 章）。0.185.0 から束も（27 章）。
//
// - 表示するのは return_to_deck（手札から見せて山札へ戻した）と reveal_from_deck（山札から見せて手札に加えた）と、0.185.0 から reveal_deck_top（山札の上から見せた束。
//   スロットゲーム）だけ。ほかの出来事は表示しない（全体の履歴の画面ではない）。本人だけが見る束（look_at_deck_top など）は対象にしない
// - 束は cards の長さの枚数を、cards・card_ids の添字の順に 1 枚ずつ（同じ ID もまとめない）。card_ids がない（0.184.0 以前）: 束全体を「見せたカード（識別の情報なし）」。
//   表にない ID はそのカードだけ「カード定義にないカード（ID）」。並びに、その後の山札の順の意味を持たせない
// - カード名は出来事の card_id とカード名表（/api/cards）だけから引く。表にない: 「カード定義にないカード（ID）」。card_id がない（0.181.0 以前の記録・ほかの呼ぶ箇所）:
//   「見せたカード（識別の情報なし）」。観測・ほかの出来事・uid・後の盤面から補わない
// - 位置の順。baseline_end より前の出来事には「接続元の状態から取得した履歴」の注記（hub を作った時点の投影で、元の公開の時点の記録とは限らない）
// - 拒否の診断・通知とは別の欄。送信できるか・check・候補・相手の手札や山札の今の中身の判断には使わない
import { LOG } from "../api/contract";
import type { LogItem } from "../api/types";
import { CardFace } from "../cards/CardImages";
import { playerLabel } from "../labels";
import { beforeBaseline, type VisibleLog } from "../state/visibleLog";

const VERBS: Record<string, string> = {
  return_to_deck: "手札から見せて山札へ戻した",
  reveal_from_deck: "山札から見せて手札に加えた",
  reveal_deck_top: "山札の上から見せた",
};

export function revealedCardLabel(event: LogItem["event"], names: (id: string) => string | undefined): string {
  const cardId = typeof event.card_id === "string" ? event.card_id : null;
  if (cardId === null) return "見せたカード（識別の情報なし）";
  const name = names(cardId);
  return name ? `${name} ${cardId}` : `カード定義にないカード（${cardId}）`;
}

/** 束（reveal_deck_top）の各カードの表示（cards・card_ids の添字の順）。card_ids がない旧形式は null。 */
export function bundleCardLabels(event: LogItem["event"], names: (id: string) => string | undefined): string[] | null {
  if (!Array.isArray(event.card_ids)) return null;
  return event.card_ids.map((id) => revealedCardLabel({ kind: event.kind, card_id: id }, names));
}

/** 束の枚数（出来事の cards の長さ。エンジンの処理を複製しない）。 */
export function bundleSize(event: LogItem["event"]): number {
  return Array.isArray(event.cards) ? event.cards.length : 0;
}

export function revealedEntries(entries: LogItem[]): LogItem[] {
  return entries.filter((e) => LOG.identified_events.includes(e.event.kind) && e.event.kind in VERBS);
}

export function RevealedCardsPanel({ log, names }: { log: VisibleLog; names: (id: string) => string | undefined }) {
  const rows = revealedEntries(log.entries);
  return (
    <section className="panel revealed-cards" aria-label="見せたカード（公開のログ）">
      <h2>見せたカード（エンジンの公開のログ）</h2>
      <p className="small muted">
        この閲覧者に届いたエンジンの公開のログのうち、手札から見せて山札へ戻したカード、山札から見せて手札に加えたカード、山札の上から見せた束（スロットゲーム）の出来事だけを、ログの順に表示します（ポケモン交換おじさんなど）。今の手札・山札の中身や、その後の山札の順を表すものではありません。
      </p>
      {log.status === "error" ? (
        <div className="callout error" role="alert">
          ログを読めませんでした（{log.error}）。表示は取得できた範囲だけで、カードが見せられなかったという意味ではありません。
          <button type="button" onClick={log.retry}>
            ログを先頭から取り直す
          </button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        log.status === "ready" ? (
          <p className="small muted">取得したログ（{log.entries.length} 件）に、見せたカードの出来事はまだありません。</p>
        ) : log.status === "loading" ? (
          <p className="small muted">ログを取得しています…</p>
        ) : null
      ) : (
        <ol className="revealed-list">
          {rows.map((e) => {
            if (e.event.kind === "reveal_deck_top") return <BundleRow key={`${e.segment}:${e.log_index}`} item={e} names={names} baselineEnd={log.baselineEnd} />;
            const label = revealedCardLabel(e.event, names);
            const cardId = typeof e.event.card_id === "string" ? e.event.card_id : null;
            const player = e.event.player === 0 || e.event.player === 1 ? e.event.player : null;
            return (
              <li key={`${e.segment}:${e.log_index}`}>
                {cardId && names(cardId) ? <CardFace cardId={cardId} name={names(cardId)!} size="s" decorative /> : null}
                <span>
                  {playerLabel(player)}が{VERBS[e.event.kind]}: <strong>{label}</strong>
                </span>{" "}
                <span className="small muted">（ログの位置 {e.segment}:{e.log_index}）</span>
                <BaselineNote item={e} baselineEnd={log.baselineEnd} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function BaselineNote({ item, baselineEnd }: { item: LogItem; baselineEnd: VisibleLog["baselineEnd"] }) {
  return beforeBaseline(item, baselineEnd) ? (
    <span className="small note">
      {" "}
      接続元の状態から取得した履歴です（この対戦をこの画面の接続層につないだ時点の投影で、元の公開の時点の記録とは限りません）。
    </span>
  ) : null;
}

/** 束の 1 行: 「（プレイヤー）が山札の上から N 枚を見せた: 名前 ID・…」。N は cards の長さ、並びは添字の順（同じ ID も枚数分）。 */
function BundleRow({ item, names, baselineEnd }: { item: LogItem; names: (id: string) => string | undefined; baselineEnd: VisibleLog["baselineEnd"] }) {
  const e = item.event;
  const labels = bundleCardLabels(e, names);
  const ids = Array.isArray(e.card_ids) ? (e.card_ids as string[]) : [];
  const player = e.player === 0 || e.player === 1 ? e.player : null;
  return (
    <li>
      {ids.map((id, i) => (names(id) ? <CardFace key={i} cardId={id} name={names(id)!} size="s" decorative /> : null))}
      <span>
        {playerLabel(player)}が山札の上から{bundleSize(e)}枚を見せた:{" "}
        {labels === null ? (
          <strong>{revealedCardLabel({ kind: e.kind }, names)}</strong>
        ) : (
          labels.map((label, i) => (
            <span key={i}>
              {i > 0 ? "・" : null}
              <strong className="bundle-card">{label}</strong>
            </span>
          ))
        )}
      </span>{" "}
      <span className="small muted">（ログの位置 {item.segment}:{item.log_index}）</span>
      <BaselineNote item={item} baselineEnd={baselineEnd} />
    </li>
  );
}
