// 0.189.0（R-2）: コインの結果の欄（components/CoinFlips.tsx）の単体。
// 出典: すべて「人工」の出来事（実応答の coin_flip の形を写して値だけを変えたもの。知らない値・項目のない形・複数枚・ほかの出来事・baseline の前）。
// 実応答での表示は AppR2Coin.test.tsx（test/r2Coin.ts）。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogItem } from "../api/types";
import type { VisibleLog } from "../state/visibleLog";
import { CoinFlipsPanel } from "./CoinFlips";

const names = (id: string) => ({ "PMCG5-076": "クチバシティジム" })[id];
const flip = (index: number, event: Record<string, unknown>): LogItem => ({ segment: 0, log_index: index, event: { kind: "coin_flip", turn: 11, player: 0, ...event } });
const log = (entries: LogItem[], baselineEnd = { segment: 0, index: 0 }): VisibleLog =>
  ({ entries, next: null, baselineEnd, complete: true, status: "ready", error: null, restarted: false, retry: () => undefined }) as unknown as VisibleLog;
const rows = () => within(screen.getByRole("region", { name: "コインの結果（公開のログ）" })).queryAllByRole("listitem").map((li) => li.textContent ?? "");

describe("コインの結果の欄", () => {
  it("coin_flip だけを位置の順に、出どころと面で示す（ほかの出来事は出さない）", () => {
    render(
      <CoinFlipsPanel
        names={names}
        log={log([
          { segment: 0, log_index: 1, event: { kind: "secret_plan_revealed", player: 0, card_id: "PMCG5-037" } },
          flip(2, { source: "stadium", effect: "PMCG5-076", number: 1, count: 1, result: "heads", card: 9, pokemon_id: 3 }),
          flip(3, { source: "attack", effect: "PMCG5-057#1", number: 1, count: 1, result: "tails", card: 4 }),
          { segment: 0, log_index: 4, event: { kind: "damage", player: 1, amount: 30 } },
        ])}
      />,
    );
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toMatch(/^プレイヤー0のコイン（場のスタジアム: クチバシティジム PMCG5-076）: おもて ?（ログの位置 0:2）/);
    expect(rows()[1]).toMatch(/^プレイヤー0のコイン（ワザ）: うら/);
    expect(rows().join("")).not.toMatch(/PMCG5-057|PMCG5-037|#4|#9/); // ワザの効果の識別子・uid から名前・カードを補わない
  });

  it("知らない値・項目のない形はそのまま示し、おもて・うらに読み替えない。複数枚は何枚目か、baseline の前は注記", () => {
    render(
      <CoinFlipsPanel
        names={names}
        log={log(
          [
            flip(1, { source: "stadium", result: "edge" }),
            flip(2, { source: "stadium", effect: "XX-999", result: "heads" }),
            flip(3, { source: "trainer", number: 2, count: 3, result: "tails" }),
            flip(4, { player: null }),
          ],
          { segment: 0, index: 2 },
        )}
      />,
    );
    expect(rows()[0]).toMatch(/場のスタジアム）: 表示できない値（"edge"）/);
    expect(rows()[0]).toMatch(/接続元の状態から取得した履歴です/);
    expect(rows()[1]).toMatch(/場のスタジアム: カード定義にないカード（XX-999））: おもて/);
    expect(rows()[1]).not.toMatch(/接続元の状態から取得した履歴です/);
    expect(rows()[2]).toMatch(/コイン（出どころ trainer）: うら（2\/3 枚目）/);
    expect(rows()[3]).toMatch(/出どころの情報なし）: 表示できない値（null）/);
  });

  it("コインの出来事がなければ、そう示す（投げられなかったとは書かない）", () => {
    render(<CoinFlipsPanel names={names} log={log([])} />);
    expect(screen.getByText(/コインの出来事はまだありません/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "コインの結果（公開のログ）" })).toHaveTextContent("コインが投げられるとは限りません");
  });
});
