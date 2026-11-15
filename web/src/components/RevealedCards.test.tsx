// 0.182.0・0.183.0: 見せたカードの欄（components/RevealedCards.tsx）。
// 出典: 「実応答」は test/traderLog.ts（導入した 0.183.0 の接続層の応答そのまま）。「人工」は実応答を写して card_id・位置・状態を変えたもの（出典を分けた）。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogResponse } from "../api/types";
import { logResponse } from "../api/validate";
import { initialVisibleLog, mergeLogPage, type VisibleLog, type VisibleLogState } from "../state/visibleLog";
import {
  BASELINE_LOG,
  CS_LOG,
  KEEP_LOG_AFTER_REJECT,
  KEEP_REJECTED_0183,
  SEARCHED_UID,
  TRADER_LOG_S1,
  TRADER_LOG_S2,
  TRADER_LOG_S3,
  TRADER_RETURNED_ID,
  TRADER_REVEALED_ID,
} from "../test/traderLog";
import { RevealedCardsPanel, revealedCardLabel } from "./RevealedCards";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const CATALOG = new Map([
  [TRADER_RETURNED_ID, "ジュゴン"],
  [TRADER_REVEALED_ID, "フシギソウ"],
  ["PMCG1-074", "マサキ"],
]);
const names = (id: string) => CATALOG.get(id);

function logOf(pages: readonly unknown[], extra: Partial<VisibleLogState> = {}): VisibleLog {
  let state: VisibleLogState = initialVisibleLog;
  let from: LogResponse["next"] | null = null;
  for (const p of pages) {
    const page = logResponse(clone(p), from);
    const m = mergeLogPage(state, page);
    if ("conflict" in m) throw new Error(m.conflict);
    state = { ...m, status: m.complete ? "ready" : "loading" };
    from = page.next;
  }
  return { ...state, ...extra, retry: () => undefined };
}

const panel = () => screen.getByRole("region", { name: "見せたカード（公開のログ）" });
const rows = () => within(panel()).queryAllByRole("listitem").map((li) => li.textContent ?? "");

describe("見せたカードの欄（実応答: 交換おじさん）", () => {
  it.each([0, 1, "spectator"] as const)("閲覧者 %s: もどしたカード・探したカードを、操作した主体と区別してログの順に示す", (seat) => {
    render(<RevealedCardsPanel log={logOf(TRADER_LOG_S3[seat])} names={names} />);
    expect(rows()).toEqual([
      expect.stringMatching(/プレイヤー0が手札から見せて山札へ戻した: ジュゴン PMCG1-030 （ログの位置 0:1）$/),
      expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: フシギソウ PMCG1-008 （ログの位置 0:2）$/),
    ]);
    expect(panel().textContent).not.toMatch(/接続元の状態から取得した履歴/); // baseline_end (0, 0) のあと＝受理の時点の写し
  });

  it("使った直後（S1）には出さず、もどしたあと（S2）にもどしたカードだけ", () => {
    const { unmount } = render(<RevealedCardsPanel log={logOf(TRADER_LOG_S1[1])} names={names} />);
    expect(rows()).toEqual([]);
    expect(panel().textContent).toMatch(/取得したログ（1 件）に、見せたカードの出来事はまだありません/);
    unmount();
    render(<RevealedCardsPanel log={logOf(TRADER_LOG_S2[1])} names={names} />);
    expect(rows()).toEqual([expect.stringContaining("手札から見せて山札へ戻した: ジュゴン PMCG1-030")]);
  });

  it("ほかの出来事（play_trainer・shuffle・discard_trainer）は表示しない", () => {
    render(<RevealedCardsPanel log={logOf(TRADER_LOG_S3.spectator)} names={names} />);
    expect(panel().textContent).not.toMatch(/shuffle|discard_trainer|play_trainer|切った|トラッシュ/);
  });
});

describe("見せたカードの欄（実応答: baseline の前）", () => {
  it("hub を作る前の出来事には「接続元の状態から取得した履歴」の注記を付ける", () => {
    render(<RevealedCardsPanel log={logOf(BASELINE_LOG.spectator)} names={names} />);
    const items = within(panel()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const li of items) expect(li.textContent).toMatch(/接続元の状態から取得した履歴です（.*元の公開の時点の記録とは限りません）/);
  });
});

describe("見せたカードの欄（実応答: 非公開の検索・本人の拒否の対照）", () => {
  it.each([0, 1, "spectator"] as const)("パソコン通信の探したカードは、どの閲覧者の欄にも出ない（%s）", (seat) => {
    render(<RevealedCardsPanel log={logOf(CS_LOG[seat])} names={names} />);
    expect(rows()).toEqual([]);
    expect(panel().textContent).not.toMatch(new RegExp(`マサキ|PMCG1-074|#${SEARCHED_UID}\\b`));
  });

  it.each([0, 1, "spectator"] as const)("［KEEP］の拒否の診断は、どの閲覧者のログにも欄にも出ない（%s）", (seat) => {
    render(<RevealedCardsPanel log={logOf(KEEP_LOG_AFTER_REJECT[seat])} names={names} />);
    expect(KEEP_REJECTED_0183.result.diagnostic_id).toBe("UNRESOLVED_KEEP_PROTECTED_TARGET");
    expect(panel().textContent).not.toMatch(/UNRESOLVED_KEEP_PROTECTED_TARGET|未裁定|拒否/);
    expect(JSON.stringify(KEEP_LOG_AFTER_REJECT[seat])).not.toMatch(/UNRESOLVED_KEEP_PROTECTED_TARGET/);
  });
});

describe("見せたカードの欄（人工: 識別の情報・カード名表）", () => {
  it("card_id がない出来事（0.181.0 以前・ほかの呼ぶ箇所）は「識別の情報なし」。uid・後の盤面から補わない", () => {
    const page = clone(TRADER_LOG_S3[1][0]) as unknown as LogResponse;
    for (const e of page.entries) delete (e.event as Record<string, unknown>).card_id;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    expect(rows()).toEqual([expect.stringContaining("見せたカード（識別の情報なし）"), expect.stringContaining("見せたカード（識別の情報なし）")]);
    expect(panel().textContent).not.toMatch(/ジュゴン|フシギソウ|PMCG1-0(30|08)/);
  });

  it("カード名表にない card_id は「カード定義にないカード（ID）」", () => {
    expect(revealedCardLabel({ kind: "return_to_deck", card_id: "XX-999" }, names)).toBe("カード定義にないカード（XX-999）");
    expect(revealedCardLabel({ kind: "reveal_from_deck", card_id: TRADER_REVEALED_ID }, names)).toBe("フシギソウ PMCG1-008");
    expect(revealedCardLabel({ kind: "reveal_from_deck", card: 8 }, names)).toBe("見せたカード（識別の情報なし）");
  });

  it("読み取りの失敗は誤りとして示す（空・「見せられなかった」と扱わない）", () => {
    render(<RevealedCardsPanel log={{ ...initialVisibleLog, status: "error", error: "接続層と通信できなかった", retry: () => undefined }} names={names} />);
    expect(within(panel()).getByRole("alert").textContent).toMatch(/ログを読めませんでした（接続層と通信できなかった）。.*見せられなかったという意味ではありません/);
    expect(panel().textContent).not.toMatch(/まだありません/);
    expect(within(panel()).getByRole("button", { name: "ログを先頭から取り直す" })).toBeTruthy();
  });

  it("取得中は「取得しています」（まだない・見せられなかったとは言わない）", () => {
    render(<RevealedCardsPanel log={{ ...initialVisibleLog, retry: () => undefined }} names={names} />);
    expect(panel().textContent).toMatch(/ログを取得しています/);
    expect(panel().textContent).not.toMatch(/まだありません/);
  });
});
