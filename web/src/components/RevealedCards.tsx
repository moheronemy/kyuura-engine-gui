// 0.182.0・0.183.0: エンジンの公開のログ（読み取りの要求 log）のうち、見せたカードの 2 つの出来事だけの表示（docs/engine-contract.md 25 章）。
//
// - 表示するのは return_to_deck（手札から見せて山札へ戻した）と reveal_from_deck（山札から見せて手札に加えた）だけ。ほかの出来事は表示しない（全体の履歴の画面ではない）
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
};

export function revealedCardLabel(event: LogItem["event"], names: (id: string) => string | undefined): string {
  const cardId = typeof event.card_id === "string" ? event.card_id : null;
  if (cardId === null) return "見せたカード（識別の情報なし）";
  const name = names(cardId);
  return name ? `${name} ${cardId}` : `カード定義にないカード（${cardId}）`;
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
        この閲覧者に届いたエンジンの公開のログのうち、手札から見せて山札へ戻したカードと、山札から見せて手札に加えたカードの出来事だけを、ログの順に表示します（ポケモン交換おじさんなど）。今の手札・山札の中身を表すものではありません。
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
                {beforeBaseline(e, log.baselineEnd) ? (
                  <span className="small note">
                    {" "}
                    接続元の状態から取得した履歴です（この対戦をこの画面の接続層につないだ時点の投影で、元の公開の時点の記録とは限りません）。
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
