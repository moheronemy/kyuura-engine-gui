// 0.189.0（R-2）: エンジンの公開のログ（読み取りの要求 log。0.183.0 から閲覧者ごとに取得済み）のうち、コインの出来事 coin_flip だけの表示（docs/engine-contract.md 31 章）。
//
// - 全体の履歴の画面ではない。表示するのは coin_flip の出来事だけ（クチバシティジムのコイン・ワザのコインなど、ほかの出来事・ダメージ・公開は出さない）
// - 使うのは出来事の公開の項目だけ: player・source・effect（場のスタジアムのコインではスタジアムのカード ID）・number・count・result。uid（card・pokemon_id）・
//   観測・後の盤面・本人の入力から補わない。ワザのコインのワザ・カードの名前は出さない（効果の識別子 effect を読み解かない）
// - 位置の順。baseline_end より前の出来事には「接続元の状態から取得した履歴」の注記（見せたカードの欄と同じ）
// - コインの結果を予告しない（入力の画面のコインの選択とは結び付けない。選んでもコインが出ないことがある）。送信・check・候補には使わない
import type { LogItem } from "../api/types";
import { playerLabel } from "../labels";
import { beforeBaseline, type VisibleLog } from "../state/visibleLog";

const SIDES: Record<string, string> = { heads: "おもて", tails: "うら" };

export function coinEntries(entries: LogItem[]): LogItem[] {
  return entries.filter((e) => e.event.kind === "coin_flip");
}

/** コインの出どころの表示。場のスタジアムのコインは、出来事の effect（スタジアムのカード ID）とカード名表だけから引く。 */
export function coinSourceLabel(event: LogItem["event"], names: (id: string) => string | undefined): string {
  if (event.source === "stadium") {
    const id = typeof event.effect === "string" ? event.effect : null;
    if (id === null) return "場のスタジアム";
    const name = names(id);
    return name ? `場のスタジアム: ${name} ${id}` : `場のスタジアム: カード定義にないカード（${id}）`;
  }
  if (event.source === "attack") return "ワザ";
  return typeof event.source === "string" ? `出どころ ${event.source}` : "出どころの情報なし";
}

/** 結果の表示。知らない値は値のまま示す（おもて・うらに読み替えない）。 */
export function coinSideLabel(event: LogItem["event"]): string {
  const result = event.result;
  if (typeof result === "string" && result in SIDES) return SIDES[result]!;
  return `表示できない値（${JSON.stringify(result ?? null)}）`;
}

export function CoinFlipsPanel({ log, names }: { log: VisibleLog; names: (id: string) => string | undefined }) {
  const rows = coinEntries(log.entries);
  return (
    <section className="panel coin-flips" aria-label="コインの結果（公開のログ）">
      <h2>コインの結果（エンジンの公開のログ）</h2>
      <p className="small muted">
        この閲覧者に届いたエンジンの公開のログのうち、コインの出来事だけをログの順に表示します。入力の画面でコインを選んでも、コインが投げられるとは限りません（結果は送信のあとのエンジンの処理で決まります）。
      </p>
      {log.status === "error" ? (
        <p className="small warn">ログを読めませんでした（{log.error}）。表示は取得できた範囲だけで、コインが投げられなかったという意味ではありません。</p>
      ) : null}
      {rows.length === 0 ? (
        log.status === "ready" ? (
          <p className="small muted">取得したログ（{log.entries.length} 件）に、コインの出来事はまだありません。</p>
        ) : log.status === "loading" ? (
          <p className="small muted">ログを取得しています…</p>
        ) : null
      ) : (
        <ol className="coin-list">
          {rows.map((e) => {
            const player = e.event.player === 0 || e.event.player === 1 ? e.event.player : null;
            const count = typeof e.event.count === "number" && typeof e.event.number === "number" && e.event.count > 1 ? `（${e.event.number}/${e.event.count} 枚目）` : "";
            return (
              <li key={`${e.segment}:${e.log_index}`}>
                <span>
                  {playerLabel(player)}のコイン（{coinSourceLabel(e.event, names)}）: <strong>{coinSideLabel(e.event)}</strong>
                  {count}
                </span>{" "}
                <span className="small muted">（ログの位置 {e.segment}:{e.log_index}）</span>
                {beforeBaseline(e, log.baselineEnd) ? (
                  <span className="small note"> 接続元の状態から取得した履歴です（この対戦をこの画面の接続層につないだ時点の投影で、元の時点の記録とは限りません）。</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
