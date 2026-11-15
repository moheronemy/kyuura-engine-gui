// 0.185.0（化石の発掘の山札の側の card_id・スロットゲームの束 reveal_deck_top の card_ids）の、見せたカードの欄（components/RevealedCards.tsx）と実行時検証（api/validate.ts）。
// 出典: 「実応答」は test/fossilSlotLog.ts（導入した 0.185.0 の接続層の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は実応答を写して card_ids・cards・baseline_end を変えたもの（出典を分けた。エンジンが出す値ではない）。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogResponse } from "../api/types";
import { logResponse, ProtocolError } from "../api/validate";
import { initialVisibleLog, mergeLogPage, type VisibleLog, type VisibleLogState } from "../state/visibleLog";
import { FOSSIL, PRIVATE_BUNDLE, SLOT_PAIR, SLOT_TRIPLE } from "../test/fossilSlotLog";
import { RevealedCardsPanel } from "./RevealedCards";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const CATALOG = new Map([
  ["PMCG3-046", "なにかの化石"],
  ["PMCG1-091", "ピッピ人形"],
  ["PMCG1-099", "水エネルギー"],
  ["PMCG1-097", "草エネルギー"],
  ["PMCG1-098", "炎エネルギー"],
  ["PMCG1-060", "コラッタ"],
]);
const names = (id: string) => CATALOG.get(id);
type Seat = 0 | 1 | "spectator";
const SEATS: Seat[] = [0, 1, "spectator"];
type Ev = { kind: string; cards?: number[]; card_ids?: string[]; card?: number; card_id?: string; player?: number };
type Page = { entries: { segment: number; log_index: number; event: Ev }[]; next: { segment: number; index: number } };

function logOf(pages: readonly unknown[], extra: Partial<VisibleLogState> = {}): VisibleLog {
  let state: VisibleLogState = initialVisibleLog;
  let from: LogResponse["next"] | null = null;
  for (const p of pages) {
    const page = logResponse(clone(p), from); // 実行時検証をそのまま通す
    const m = mergeLogPage(state, page);
    if ("conflict" in m) throw new Error(m.conflict);
    state = { ...m, status: m.complete ? "ready" : "loading" };
    from = page.next;
  }
  return { ...state, ...extra, retry: () => undefined };
}
const panel = () => screen.getByRole("region", { name: "見せたカード（公開のログ）" });
const rows = () => within(panel()).queryAllByRole("listitem");
const texts = () => rows().map((li) => li.textContent ?? "");
const last = <T,>(a: readonly T[]) => a[a.length - 1]!;
const finalPage = (rep: { points: readonly unknown[] }, seat: Seat) => (last(rep.points) as { log: Record<string, readonly Page[]> }).log[String(seat)]![0]!;
const bundleOf = (page: Page) => page.entries.find((e) => e.event.kind === "reveal_deck_top")!;

describe("F 化石の発掘（実応答）: 山札から選んだカードを、選んだ時点から既存の行で", () => {
  it.each(SEATS)("選ぶ前は出ず、選んだあとになにかの化石（閲覧者 %s）。選ばなかったピッピ人形は出ない", (seat) => {
    const { unmount } = render(<RevealedCardsPanel log={logOf(FOSSIL.points[1]!.log[seat])} names={names} />);
    expect(texts()).toEqual([]);
    unmount();
    render(<RevealedCardsPanel log={logOf(FOSSIL.points[2]!.log[seat])} names={names} />);
    expect(texts()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: なにかの化石 PMCG3-046 （ログの位置 0:1）$/)]);
    expect(panel().textContent).not.toMatch(/ピッピ人形|PMCG1-091|トレーナー/);
  });
});

describe("S スロットゲームの束（実応答）", () => {
  it.each(SEATS)("同じ ID 2 枚と 1 枚: 名前・枚数・順・重複が実応答の cards・card_ids の添字の順と同じ（閲覧者 %s）", (seat) => {
    const { unmount } = render(<RevealedCardsPanel log={logOf(SLOT_PAIR.points[0]!.log[seat])} names={names} />);
    expect(texts()).toEqual([]); // 公開の前
    unmount();
    render(<RevealedCardsPanel log={logOf(SLOT_PAIR.points[1]!.log[seat])} names={names} />);
    const b = bundleOf(finalPage(SLOT_PAIR, seat));
    expect(b.event.card_ids).toEqual(["PMCG1-099", "PMCG1-097", "PMCG1-099"]); // 実応答の並び（切ったあとの山札の上から）
    const cells = Array.from(rows()[0]!.querySelectorAll("strong.bundle-card")).map((s) => s.textContent);
    expect(cells).toEqual(b.event.card_ids!.map((id) => `${CATALOG.get(id)} ${id}`));
    expect(texts()[0]).toMatch(/プレイヤー0が山札の上から3枚を見せた: 水エネルギー PMCG1-099・草エネルギー PMCG1-097・水エネルギー PMCG1-099 （ログの位置 0:2）$/);
    expect(texts().slice(1)).toEqual([
      expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: 水エネルギー PMCG1-099 （ログの位置 0:3）$/),
      expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: 水エネルギー PMCG1-099 （ログの位置 0:4）$/),
    ]);
    expect(texts().join("")).not.toMatch(/山札の順|山札の上にある|残り/); // 行の中で、並びから、その後の山札の順を説明しない（欄の説明文は「表すものではありません」）
  });

  it.each(SEATS)("同じ ID 3 枚: まとめずに 3 枚とも出す（閲覧者 %s）", (seat) => {
    render(<RevealedCardsPanel log={logOf(SLOT_TRIPLE.points[1]!.log[seat])} names={names} />);
    const cells = Array.from(rows()[0]!.querySelectorAll("strong.bundle-card")).map((s) => s.textContent);
    expect(cells).toEqual(["水エネルギー PMCG1-099", "水エネルギー PMCG1-099", "水エネルギー PMCG1-099"]);
    expect(texts()[0]).toMatch(/プレイヤー0が山札の上から3枚を見せた: /);
    expect(texts()).toHaveLength(4); // 束 1 行と、手札に加えた 3 枚の行
  });

  it("束の出来事は 3 閲覧者で同じ値。後の受理（番を終える）で前の出来事は変わらない", () => {
    for (const rep of [SLOT_PAIR, SLOT_TRIPLE]) {
      const at = (i: number, s: Seat) => (rep.points[i]!.log[s][0] as unknown as Page).entries;
      expect(bundleOf(finalPage(rep, 0))).toEqual(bundleOf(finalPage(rep, 1)));
      expect(bundleOf(finalPage(rep, 1))).toEqual(bundleOf(finalPage(rep, "spectator")));
      for (const s of SEATS) expect(at(2, s).slice(0, at(1, s).length)).toEqual(at(1, s));
    }
  });
});

describe("本人だけが見る束の対照（実応答: マスターボールの look_at_deck_top）", () => {
  it.each(SEATS)("見ただけの束は欄に出さず、見せたコラッタだけ（閲覧者 %s）", (seat) => {
    render(<RevealedCardsPanel log={logOf(last(PRIVATE_BUNDLE.points).log[seat])} names={names} />);
    expect(texts()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: コラッタ PMCG1-060 （ログの位置 0:2）$/)]);
    expect(texts().join("")).not.toMatch(/炎エネルギー|PMCG1-098|山札の上から/); // 行だけ（欄の説明文は束にふれる）
  });
});

describe("旧形式・カード名表にない ID・baseline（人工: 実応答を写して値を変えた）", () => {
  it("card_ids のない旧形式は受け付け、束全体を「識別の情報なし」（枚数は cards の長さ）。後の reveal_from_deck から補わない", () => {
    const page = clone(finalPage(SLOT_PAIR, 1));
    delete bundleOf(page).event.card_ids;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    expect(texts()[0]).toMatch(/プレイヤー0が山札の上から3枚を見せた: 見せたカード（識別の情報なし） （ログの位置 0:2）$/);
    expect(rows()[0]!.querySelectorAll("strong.bundle-card")).toHaveLength(0);
  });

  it("カード名表にない ID は、そのカードだけ「カード定義にないカード（ID）」", () => {
    const page = clone(finalPage(SLOT_PAIR, "spectator"));
    bundleOf(page).event.card_ids![1] = "XX-999";
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    const cells = Array.from(rows()[0]!.querySelectorAll("strong.bundle-card")).map((s) => s.textContent);
    expect(cells).toEqual(["水エネルギー PMCG1-099", "カード定義にないカード（XX-999）", "水エネルギー PMCG1-099"]);
  });

  it("baseline_end より前の束にも、接続元の状態から取得した履歴の注記", () => {
    const page = clone(finalPage(SLOT_TRIPLE, 1)) as unknown as LogResponse;
    page.baseline_end = page.end;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    expect(texts()).toHaveLength(4);
    for (const t of texts()) expect(t).toMatch(/接続元の状態から取得した履歴です/);
  });
});

describe("束の実行時検証（人工の不正な応答。旧形式として黙って扱わない）", () => {
  const broken: [string, (e: Record<string, unknown>) => void][] = [
    ["card_ids が cards より短い（一部だけ）", (e) => (e.card_ids = (e.card_ids as string[]).slice(0, 2))],
    ["card_ids が cards より長い", (e) => (e.card_ids = [...(e.card_ids as string[]), "PMCG1-099"])],
    ["card_ids の要素が null", (e) => ((e.card_ids as unknown[])[1] = null)],
    ["card_ids の要素が数", (e) => ((e.card_ids as unknown[])[0] = 99)],
    ["card_ids が null", (e) => (e.card_ids = null)],
    ["card_ids が文字列", (e) => (e.card_ids = "PMCG1-099")],
    ["card_ids が空の並び", (e) => (e.card_ids = [])],
    ["cards が並びでない", (e) => (e.cards = 4)],
    ["cards の要素が文字列", (e) => ((e.cards as unknown[])[0] = "4")],
    ["cards に同じ参照が重なる（別の個体でない）", (e) => ((e.cards as unknown[])[2] = (e.cards as unknown[])[0])],
    // 28 章: 「card_ids のある束の cards に null」は拒否の例から外し、下の受け付ける境界の例へ移した（エンジンの契約はうらの伏せの null を許す）
  ];
  it.each(broken)("%s は ProtocolError", (_name, mutate) => {
    const page = clone(finalPage(SLOT_PAIR, 1));
    mutate(bundleOf(page).event as unknown as Record<string, unknown>);
    expect(() => logResponse(page, null)).toThrow(ProtocolError);
  });

  it("実応答と、card_ids を除いた旧形式は通る", () => {
    for (const rep of [SLOT_PAIR, SLOT_TRIPLE]) {
      for (const s of SEATS) expect(() => logResponse(clone(finalPage(rep, s)), null)).not.toThrow();
      const old = clone(finalPage(rep, 1));
      delete bundleOf(old).event.card_ids;
      expect(() => logResponse(old, null)).not.toThrow();
    }
  });
});

// docs/engine-contract.md 28 章: エンジンの契約（observation._mask_face_down は cards の uid だけを見る人ごとに null に伏せ、card_ids は伏せない。
// fossil-slot-reveal-identification-design.md 4 章「cards[i] が見る人によって null に伏せられても、位置はそのまま」）。
// 出典は人工の境界の例: 実応答を写して cards の要素を null にした（固定版のエンジンの実応答にこの形はまだ出ていない）。
describe("束の cards の null（人工の境界の例。エンジンの契約が許す形）", () => {
  const withNull = (positions: number[], seat: Seat = 1) => {
    const page = clone(finalPage(SLOT_PAIR, seat));
    for (const i of positions) (bundleOf(page).event.cards as unknown[])[i] = null;
    return page;
  };

  it.each([[[1]], [[0, 2]], [[0, 1, 2]]])("card_ids のある束で cards の %j 番が null でも受け付ける（null は重なりの検査に数えない）", (positions) => {
    expect(() => logResponse(withNull(positions), null)).not.toThrow();
  });

  it("表示は、その位置の出来事自身の card_ids だけ（枚数は cards の長さ・添字の順・重複をまとめない）", () => {
    const page = withNull([1]);
    const ids = bundleOf(page).event.card_ids!;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    const cells = Array.from(rows()[0]!.querySelectorAll("strong.bundle-card")).map((s) => s.textContent);
    expect(cells).toEqual(ids.map((id) => `${CATALOG.get(id)} ${id}`));
    expect(texts()[0]).toMatch(/プレイヤー0が山札の上から3枚を見せた: 水エネルギー PMCG1-099・草エネルギー PMCG1-097・水エネルギー PMCG1-099 （ログの位置 0:2）$/);
  });

  it("null の位置でも、カード名表にない ID は「カード定義にないカード（ID）」", () => {
    const page = withNull([1]);
    bundleOf(page).event.card_ids![1] = "XX-999";
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    const cells = Array.from(rows()[0]!.querySelectorAll("strong.bundle-card")).map((s) => s.textContent);
    expect(cells).toEqual(["水エネルギー PMCG1-099", "カード定義にないカード（XX-999）", "水エネルギー PMCG1-099"]);
  });

  it("card_ids のない旧形式で cards に null があっても「識別の情報なし」のまま（補わない）", () => {
    const page = withNull([0]);
    delete bundleOf(page).event.card_ids;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    expect(texts()[0]).toMatch(/プレイヤー0が山札の上から3枚を見せた: 見せたカード（識別の情報なし） （ログの位置 0:2）$/);
  });

  it("null のある束の baseline_end より前にも注記", () => {
    const page = withNull([2]) as unknown as LogResponse;
    page.baseline_end = page.end;
    render(<RevealedCardsPanel log={logOf([page])} names={names} />);
    for (const t of texts()) expect(t).toMatch(/接続元の状態から取得した履歴です/);
  });

  const stillBroken: [string, (e: Record<string, unknown>) => void][] = [
    ["null があり card_ids が短い（一部だけ）", (e) => (e.card_ids = (e.card_ids as string[]).slice(0, 2))],
    ["null があり card_ids が長い", (e) => (e.card_ids = [...(e.card_ids as string[]), "PMCG1-099"])],
    ["null の位置の card_ids が null", (e) => ((e.card_ids as unknown[])[1] = null)],
    ["null の位置の card_ids が数", (e) => ((e.card_ids as unknown[])[1] = 99)],
    ["null があり card_ids が空", (e) => (e.card_ids = [])],
    ["null があり整数の参照が重なる", (e) => ((e.cards as unknown[])[2] = (e.cards as unknown[])[0])],
    ["null があり cards の要素が文字列", (e) => ((e.cards as unknown[])[0] = "4")],
    ["null のある束の hidden の値が文字列（変更の対象外の検査）", (e) => (e.hidden = { cards: "3" })],
    ["null のある束の player が null（変更の対象外の検査）", (e) => (e.player = null)],
  ];
  it.each(stillBroken)("%s は ProtocolError のまま", (_name, mutate) => {
    const page = withNull([1]);
    mutate(bundleOf(page).event as unknown as Record<string, unknown>);
    expect(() => logResponse(page, null)).toThrow(ProtocolError);
  });
});
