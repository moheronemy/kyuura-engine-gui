// 公開の更新（閲覧者に許された観測と状態）を、ログの 1 行にまとめる。
// 使うのは公開の値（段階・番・入力待ち・各領域の枚数・結果・停止）だけで、手札の中身は書かない。
// エンジンの対戦ログ（visible_log）は client_api 形式 1 の応答に含まれないため、ここでは更新の要約で代える（README「制限」）。
import { HALT_CATEGORY_LABELS, NEXT_LABELS, PHASE_LABELS, STATUS_LABELS, labelOf, playerLabel, waitingByLabel } from "../labels";
import type { Observation, UpdateItem } from "../api/types";

export interface LogEntry {
  key: string;
  number: number | null;
  text: string;
  detail: string[];
}

function counts(o: Observation): string[] {
  return o.players.map(
    (p) => `${playerLabel(p.player)}: 手札${p.hand.count}・山札${p.deck.count}・サイド${p.prizes.count}・トラッシュ${p.discard.length}・ベンチ${p.bench.length}`,
  );
}

export function summarizeUpdate(update: UpdateItem, previous: Observation | null): LogEntry {
  const s = update.status;
  const head = [`#${update.number}`, labelOf(STATUS_LABELS, s.status)];
  if (s.phase) head.push(labelOf(PHASE_LABELS, s.phase));
  const o = update.observation;
  if (o) {
    head.push(`番${o.turn}`);
    if (o.current_player != null) head.push(`${playerLabel(o.current_player)}の番`);
  }
  const detail: string[] = [];
  if (s.waiting.length) detail.push(`入力待ち: ${s.waiting.map((w) => `${waitingByLabel(w.by)}（${labelOf(NEXT_LABELS, w.kind)}）`).join("、")}`);
  if (s.halt) detail.push(`停止: ${labelOf(HALT_CATEGORY_LABELS, s.halt.category)} ${s.halt.diagnostic_id ?? ""} ${s.halt.message ?? ""}`.trim());
  if (o?.result) detail.push(`結果: ${o.result.outcome}${o.result.winner != null ? `（${playerLabel(o.result.winner)}）` : ""}`);
  if (o) {
    const now = counts(o);
    const before = previous ? counts(previous) : null;
    now.forEach((line, i) => {
      if (!before || before[i] !== line) detail.push(line);
    });
  } else {
    detail.push("観測なし（処理できない結果のあと）");
  }
  return { key: `u${update.number}`, number: update.number, text: head.join(" ・ "), detail };
}
