// 送信の結果（submit の応答）の表示。エンジンの語彙（outcome・result.status・result.next・halt）だけから決め、GUI で推測しない。
// - refused: ホスト（client_api）の段で止め、エンジンに渡していない（状態は変わらない）
// - rejected: エンジンが受け付けなかった（状態は変わらない）。未裁定・未対応による拒否はゲーム上の禁止ではない
// - accepted: 受理。そのあとの状態（対戦中・決定待ち・停止・終局）は result.status のまま示す
// - failed: 処理できない結果（内部エラーなど）
import type { PlayerIndex, SubmitResponse } from "../api/types";
import { HALT_CATEGORY_LABELS, KIND_LABELS, NEXT_LABELS, OUTCOME_LABELS, REFUSAL_TEXT, labelOf, playerLabel } from "../labels";

/** 拒否・断りは送った主体にだけ返る（エンジンは相手・観戦者へ知らせない。GUI も通知・更新・件数を加えない）。 */
const PRIVATE_LINE = "この結果は送ったあなたにだけ表示しています（相手・観戦者には知らせません）。";

export interface OutcomeSummary {
  tone: "ok" | "info" | "warn" | "error";
  title: string;
  lines: string[];
}

function whose(player: PlayerIndex | null | undefined, actor: PlayerIndex | "host" | null): string {
  if (player === null || player === undefined) return "";
  return player === actor ? `あなた（${playerLabel(player)}）の` : `${playerLabel(player)}の`;
}

function categoryLine(category: string | null | undefined): string | null {
  if (!category) return null;
  const label = labelOf(HALT_CATEGORY_LABELS, category);
  const notProhibition = ["unresolved_ruling", "unsupported", "technical_limit"].includes(category) ? "（ゲーム上の禁止ではありません）" : "";
  return `区分: ${label}${notProhibition}`;
}

/** 送信の結果の見出しと行。actor は送った主体（次の決定が本人か相手かを分けて書く）。 */
export function summarizeSubmit(result: SubmitResponse, kind: string, actor: PlayerIndex | "host" | null): OutcomeSummary {
  const kindLabel = labelOf(KIND_LABELS, kind);
  const diag = result.result;
  const lines: string[] = [];
  if (result.outcome === "refused") {
    lines.push("ホストの段で止めました。エンジンには渡していません（状態は変わりません）。");
    lines.push(PRIVATE_LINE);
    if (result.refusal) lines.push(`${result.refusal.code}: ${REFUSAL_TEXT[result.refusal.code] ?? result.refusal.message}`);
    return { tone: "warn", title: `${OUTCOME_LABELS.refused}: ${kindLabel}`, lines };
  }
  if (result.outcome === "rejected") {
    lines.push("エンジンが受け付けませんでした（状態は変わりません）。");
    lines.push(PRIVATE_LINE);
    const category = categoryLine(diag?.category);
    if (category) lines.push(category);
    if (diag?.diagnostic_id) lines.push(`診断: ${diag.diagnostic_id}`);
    if (diag?.message) lines.push(diag.message);
    return { tone: "warn", title: `${OUTCOME_LABELS.rejected}: ${kindLabel}`, lines };
  }
  if (result.outcome === "failed") {
    lines.push("処理できない結果です（内部エラーなど）。この対戦はこの画面から続けられないことがあります。");
    if (diag?.diagnostic_id) lines.push(`診断: ${diag.diagnostic_id}`);
    if (diag?.message) lines.push(diag.message);
    return { tone: "error", title: `${OUTCOME_LABELS.failed}: ${kindLabel}`, lines };
  }
  if (result.outcome !== "accepted") return { tone: "warn", title: `${labelOf(OUTCOME_LABELS, result.outcome)}: ${kindLabel}`, lines };
  const status = diag?.status ?? null;
  for (const next of diag?.next ?? []) {
    // 決める人が送った主体と違う（錯乱ジム・［ちえくらべ］など）: 相手が答えるまで待つ。入力は答える人の画面にだけ出る
    const other = next.kind === "answer_decision" && next.player != null && actor !== "host" && next.player !== actor;
    lines.push(`次: ${whose(next.player, actor)}${labelOf(NEXT_LABELS, next.kind)}${other ? "（相手が答えます。答えるまで待ちます）" : ""}`);
  }
  if (status === "halted") {
    lines.unshift("受理のあと、エンジンが対戦を止めました（停止）。宣言の拒否ではありません。");
    const category = categoryLine(diag?.halt?.category ?? diag?.category);
    if (category) lines.push(category);
    if (diag?.halt?.message) lines.push(`停止: ${diag.halt.message}`);
    return { tone: "warn", title: `${OUTCOME_LABELS.accepted}（そのあと停止）: ${kindLabel}`, lines };
  }
  if (status === "game_over") return { tone: "ok", title: `${OUTCOME_LABELS.accepted}（対戦が終わりました）: ${kindLabel}`, lines };
  if (status === "awaiting_decision") return { tone: "ok", title: `${OUTCOME_LABELS.accepted}（決定待ち）: ${kindLabel}`, lines };
  return { tone: "ok", title: `${OUTCOME_LABELS.accepted}: ${kindLabel}`, lines };
}
