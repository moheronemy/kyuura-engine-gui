// 0.184.0（見せる 17 の呼ぶ箇所の card_id）の代表 3 経路を、既存の見せたカードの欄（components/RevealedCards.tsx。0.183.0 から変えていない）が扱えること。
// 出典: 「実応答」は test/revealLog.ts（導入した 0.184.0 の接続層の応答そのまま）。「人工」は実応答を写して card_id・baseline_end を変えたもの（出典を分けた）。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogResponse } from "../api/types";
import { logResponse } from "../api/validate";
import { initialVisibleLog, mergeLogPage, type VisibleLog, type VisibleLogState } from "../state/visibleLog";
import { CS, GIFT, JELLYFISH, MASTER_BALL } from "../test/revealLog";
import { RevealedCardsPanel } from "./RevealedCards";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const CATALOG = new Map([
  ["PMCG1-060", "コラッタ"],
  ["neo1-073", "きのみ"],
  ["PMCG3-011", "メノクラゲ"],
  ["PMCG1-074", "マサキ"],
]);
const names = (id: string) => CATALOG.get(id);
type Seat = 0 | 1 | "spectator";

function logOf(pages: readonly unknown[], extra: Partial<VisibleLogState> = {}): VisibleLog {
  let state: VisibleLogState = initialVisibleLog;
  let from: LogResponse["next"] | null = null;
  for (const p of pages) {
    const page = logResponse(clone(p), from); // 実行時検証（既存）をそのまま通す
    const m = mergeLogPage(state, page);
    if ("conflict" in m) throw new Error(m.conflict);
    state = { ...m, status: m.complete ? "ready" : "loading" };
    from = page.next;
  }
  return { ...state, ...extra, retry: () => undefined };
}
const panel = () => screen.getByRole("region", { name: "見せたカード（公開のログ）" });
const rows = () => within(panel()).queryAllByRole("listitem").map((li) => li.textContent ?? "");
const last = <T,>(a: readonly T[]) => a[a.length - 1]!;
const SEATS: Seat[] = [0, 1, "spectator"];

describe("代表 3 経路（実応答）: 見せた時点から、使用者・相手・観戦者の欄に同じ名前で出る", () => {
  it.each(SEATS)("A トレーナー（マスターボール）: 選ぶ前は出ず、加えたあとにコラッタ（閲覧者 %s）", (seat) => {
    const { unmount } = render(<RevealedCardsPanel log={logOf(MASTER_BALL.points[1]!.log[seat])} names={names} />);
    expect(rows()).toEqual([]);
    unmount();
    render(<RevealedCardsPanel log={logOf(last(MASTER_BALL.points).log[seat])} names={names} />);
    expect(rows()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: コラッタ PMCG1-060 （ログの位置 0:2）$/)]);
  });

  it.each(SEATS)("B 特殊能力（おくりもの）: 使った人と相手の 2 つの出来事を、操作した主体を分けてログの順に（閲覧者 %s）", (seat) => {
    const before = GIFT.points[3]!.log[seat]; // 使った人が山札から選ぶ前
    const { unmount } = render(<RevealedCardsPanel log={logOf(before)} names={names} />);
    expect(rows()).toEqual([]);
    unmount();
    const { unmount: u2 } = render(<RevealedCardsPanel log={logOf(GIFT.points[4]!.log[seat])} names={names} />); // 使った人が加えたあと・相手が選ぶ前
    expect(rows()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: きのみ neo1-073 （ログの位置 0:2）$/)]);
    u2();
    render(<RevealedCardsPanel log={logOf(last(GIFT.points).log[seat])} names={names} />);
    expect(rows()).toEqual([
      expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: きのみ neo1-073 （ログの位置 0:2）$/),
      expect.stringMatching(/プレイヤー1が山札から見せて手札に加えた: きのみ neo1-073 （ログの位置 0:4）$/),
    ]);
    expect(panel().textContent).not.toMatch(/@power0|neo4-095|トレーナー/); // 付加項目（power）から名前・種類を作らない。トレーナーの使用とは書かない
  });

  it.each(SEATS)("C ワザの要素（くらげのむれ）: effect の付加項目があっても同じ文（閲覧者 %s）", (seat) => {
    const { unmount } = render(<RevealedCardsPanel log={logOf(JELLYFISH.points[1]!.log[seat])} names={names} />);
    expect(rows()).toEqual([]);
    unmount();
    render(<RevealedCardsPanel log={logOf(last(JELLYFISH.points).log[seat])} names={names} />);
    expect(rows()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: メノクラゲ PMCG3-011 （ログの位置 0:1）$/)]);
    expect(panel().textContent).not.toMatch(/GD2-003#1/);
  });

  it("どの代表でも、見せたカードの出来事は 3 閲覧者で同じ（公開の出来事）。前の時点の next からの log は追記だけ", () => {
    type Page = { entries: { log_index: number; event: { kind: string } }[]; next: { segment: number; index: number } };
    type Point = { log: Record<string, readonly Page[]>; fromPrev?: Record<string, readonly Page[]> };
    for (const r of [MASTER_BALL, GIFT, JELLYFISH] as unknown as { points: Point[] }[]) {
      const final = last(r.points);
      const shown = (s: string) => final.log[s]![0]!.entries.filter((e) => e.event.kind === "reveal_from_deck");
      expect(shown("0")).toEqual(shown("1"));
      expect(shown("1")).toEqual(shown("spectator"));
      const prev = r.points[r.points.length - 2]!;
      const tail = logResponse(clone(final.fromPrev!["1"]![0]), prev.log["1"]![0]!.next);
      expect(tail.entries.map((e) => e.log_index)[0]).toBe(prev.log["1"]![0]!.next.index);
    }
  });
});

describe("非公開の対照（実応答: パソコン通信）", () => {
  it.each(SEATS)("探したカードは欄に出ない（閲覧者 %s）", (seat) => {
    render(<RevealedCardsPanel log={logOf(last(CS.points).log[seat])} names={names} />);
    expect(rows()).toEqual([]);
    expect(panel().textContent).not.toMatch(/マサキ|PMCG1-074/);
  });
});

describe("従来の表示（人工: 実応答を写して値を変えた）", () => {
  it("card_id のない出来事は「識別の情報なし」、カード名表にない card_id は「カード定義にないカード（ID）」", () => {
    const page = clone(last(GIFT.points).log[1][0]) as unknown as LogResponse;
    const shown = page.entries.filter((e) => e.event.kind === "reveal_from_deck");
    delete (shown[0]!.event as Record<string, unknown>).card_id;
    (shown[1]!.event as Record<string, unknown>).card_id = "XX-999";
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    expect(rows()).toEqual([expect.stringContaining("プレイヤー0が山札から見せて手札に加えた: 見せたカード（識別の情報なし）"), expect.stringContaining("プレイヤー1が山札から見せて手札に加えた: カード定義にないカード（XX-999）")]);
  });

  it("baseline_end より前（hub を作った時点の投影）なら、2 つの行とも注記を付ける", () => {
    const page = clone(last(GIFT.points).log.spectator[0]) as unknown as LogResponse;
    page.baseline_end = page.end;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    const items = within(panel()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const li of items) expect(li.textContent).toMatch(/接続元の状態から取得した履歴です/);
  });
});
