// 画面全体での 0.183.0 の読み取りの要求 log と、0.182.0 のポケモン交換おじさんの見せる 2 枚の表示（模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/traderLog.ts（導入した 0.183.0 の接続層の HTTP の口の応答そのまま。構築盤面と既存の固定例。new_game からではない）。
// 「人工」は遅い応答・誤り・位置の不明・別の対戦・応答の組み合わせ（実応答を写して位置を変えたものを含む）で、エンジンの情報境界の確かめには使わない。
// 実エンジンとの確かめ（主体別の取得・hidden・診断・状態を変えない）は server/tests/test_log.py と e2e/trader-log.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { NetworkError } from "./api/transport";
import { commonRoutes, deferred, MATCH, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as F from "./test/traderLog";

type Seat = 0 | 1 | "spectator";
type Phase = "S0" | "S1" | "S2" | "S3";
const SEAT_OF: Record<string, Seat> = { tok0: 0, tok1: 1, tokS: "spectator", tok0b: 0, tok1b: 1, tokSb: "spectator" };
const tokenOf = (c: Call) => c.path.split("/")[3]!;
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const panel = () => within(viewerArea()).getByRole("region", { name: "見せたカード（公開のログ）" });
const rows = () => within(panel()).queryAllByRole("listitem").map((li) => li.textContent ?? "");
const CATALOG = {
  gui_server: 1,
  ok: true,
  cards: [
    { id: F.TRADER_RETURNED_ID, name_ja: "ジュゴン", category: "pokemon", stage: "stage1", hp: 80 },
    { id: F.TRADER_REVEALED_ID, name_ja: "フシギソウ", category: "pokemon", stage: "stage1", hp: 60 },
    { id: "PMCG1-074", name_ja: "マサキ", category: "trainer", stage: null, hp: null },
    { id: "PMCG1-093", name_ja: "ポケモン交換おじさん", category: "trainer", stage: null, hp: null },
  ],
};
const VIEWS = { S0: F.TRADER_VIEWS_S0, S1: F.TRADER_VIEWS_S1, S2: F.TRADER_VIEWS_S2, S3: F.TRADER_VIEWS_S3 } as const;
const LOGS = { S0: F.TRADER_LOG_S0, S1: F.TRADER_LOG_S1, S2: F.TRADER_LOG_S2, S3: F.TRADER_LOG_S3 } as const;
const FROM_PREV = { S1: F.TRADER_LOG_S1_FROM_PREV, S2: F.TRADER_LOG_S2_FROM_PREV, S3: F.TRADER_LOG_S3_FROM_PREV } as const;
const AT_END = { S0: F.TRADER_LOG_S0_AT_END, S1: F.TRADER_LOG_S1_AT_END, S2: F.TRADER_LOG_S2_AT_END, S3: F.TRADER_LOG_S3_AT_END } as const;
const STEPS = { S0: F.TRADER_PLAY, S1: F.TRADER_RETURN, S2: F.TRADER_REVEAL } as const;
const NEXT: Record<Phase, Phase> = { S0: "S1", S1: "S2", S2: "S3", S3: "S3" };
const PREV: Partial<Record<Phase, Phase>> = { S1: "S0", S2: "S1", S3: "S2" };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const POSITION_UNKNOWN = { contract: "kyuura-client-api", format: 1, type: "log", ok: false, error: { code: "CLIENT_LOG_POSITION_UNKNOWN", message: "ログの位置がこの対戦の範囲にない" } };

/** 実応答の log を、時点と from で返す（先頭・前の時点の next・その時点の末尾。ほかの位置は想定外）。 */
function realLog(phase: Phase, seat: Seat, from: unknown): unknown {
  if (from === undefined) return LOGS[phase][seat][0];
  if (same(from, AT_END[phase][seat][0].next)) return AT_END[phase][seat][0];
  const prev = PREV[phase];
  if (prev && same(from, LOGS[prev][seat][0].next)) return FROM_PREV[phase as keyof typeof FROM_PREV][seat][0];
  // 2 つ前の時点の next から（画面が 1 つの時点を飛ばして取り直した）: その時点の先頭からの応答を、同じ位置から切り出した（人工・実応答の写し）
  const whole = LOGS[phase][seat][0];
  const start = (from as { index: number }).index;
  return { ...whole, entries: whole.entries.filter((e) => e.log_index >= start) };
}

function traderServer(override: (c: Call) => unknown = () => undefined) {
  const world: { phase: Phase } = { phase: "S0" };
  const transport = mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    if (c.path === "/api/cards") return CATALOG;
    const common = c.body?.type === "log" ? undefined : commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const seat = SEAT_OF[tok];
    if (type === "log") {
      if (seat === undefined) throw new Error(`ホストの画面は log を読まない（${tok}）`);
      return realLog(world.phase, seat, c.body?.from);
    }
    if (type === "view") return tok === "tokH" ? { ...VIEWS[world.phase].spectator, viewer: "host" } : VIEWS[world.phase][seat!];
    if (type === "candidates") {
      const own = world.phase === "S3" ? F.TRADER_CANDIDATES_AFTER : STEPS[world.phase as keyof typeof STEPS].candidates;
      if (seat === 0) return own;
      return { ...own, response: { ...own.response, actor: seat === 1 ? 1 : null, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [] } };
    }
    const step = STEPS[world.phase as keyof typeof STEPS];
    if (type === "inputs") return step.inputs;
    if (type === "check") return step.check;
    if (type === "submit") {
      world.phase = NEXT[world.phase];
      return step.submit;
    }
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
  return { transport, world };
}

async function start(transport: ReturnType<typeof mockTransport>) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mockRenderer().renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await within(viewerArea()).findByLabelText("プレイヤー0の手札");
  return user;
}

function candidateItem(label: string) {
  const item = within(viewerArea())
    .getAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head")?.textContent?.includes(label));
  if (!item) throw new Error(`候補 ${label} がまだない`); // waitFor が待てるように投げる
  return item;
}

async function answer(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(within(await waitFor(() => candidateItem(label))).getByRole("button", { name: "この操作を選ぶ" }));
  const p = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  await user.click(within(p).getByRole("radio", { name: new RegExp(`${option} ?#\\d+$`) }));
  await user.click(within(p).getByRole("button", { name: "入力を検査" }));
  await user.click(await within(p).findByRole("button", { name: "送信" }));
}

async function showSeat(user: ReturnType<typeof userEvent.setup>, seat: string) {
  await user.click(screen.getByRole("radio", { name: seat }));
  await within(viewerArea()).findByRole("region", { name: "対戦の状態" });
  await settle();
}

const logCalls = (t: ReturnType<typeof mockTransport>, tok?: string) => t.calls.filter((c) => c.body?.type === "log" && (tok === undefined || tokenOf(c) === tok));
const ofType = (t: ReturnType<typeof mockTransport>, type: string) => t.calls.filter((c) => c.body?.type === type);

describe("交換おじさんの両段階（実応答）", () => {
  it("使った直後には出さず、もどしたあと・探したあとに、その時点の公開のログから示す。相手・観戦者の画面にも同じ 2 枚", async () => {
    const { transport } = traderServer();
    const user = await start(transport);
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ（0 件）/));
    await answer(user, "手札のトレーナーを使う", F.TRADER_PLAY.choices[0]);
    await within(viewerArea()).findByText(/受理（決定待ち）: 手札のトレーナーを使う/);
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ（1 件）/));
    expect(rows()).toEqual([]);
    await answer(user, "決定に答える", F.TRADER_RETURN.choices[0]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/プレイヤー0が手札から見せて山札へ戻した: ジュゴン PMCG1-030/);
    await answer(user, "決定に答える", F.TRADER_REVEAL.choices[0]);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[1]).toMatch(/プレイヤー0が山札から見せて手札に加えた: フシギソウ PMCG1-008/);
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(rows()[0]).toMatch(/プレイヤー0が手札から見せて山札へ戻した: ジュゴン PMCG1-030 （ログの位置 0:1）/);
      expect(rows()[1]).toMatch(/プレイヤー0が山札から見せて手札に加えた: フシギソウ PMCG1-008 （ログの位置 0:2）/);
    }
    // 入力・check・送信は今までどおり（選べるものの id のまま。自動で再送しない）。log は封筒と from だけで、ホストの画面は読まない
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1"], ["o1"], ["o4"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"], ["o1"], ["o4"]]);
    for (const c of logCalls(transport)) expect(Object.keys(c.body!).sort()).toEqual(c.body?.from ? ["contract", "format", "from", "type"] : ["contract", "format", "type"]);
    expect(logCalls(transport, "tokH")).toHaveLength(0);
    // 本人の画面で、保持した next から追記を読んでいる（毎回先頭からではない）
    const froms = logCalls(transport, "tok0").map((c) => c.body?.from ?? null);
    expect(froms[0]).toBeNull();
    expect(froms.slice(1).every((f) => f !== null)).toBe(true);
  });

  it("通知（送信の結果・拒否の診断）とは別の欄。見せたカードの欄に送信の結果は出ない", async () => {
    const { transport } = traderServer();
    const user = await start(transport);
    await answer(user, "手札のトレーナーを使う", F.TRADER_PLAY.choices[0]);
    await answer(user, "決定に答える", F.TRADER_RETURN.choices[0]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(panel().textContent).not.toMatch(/受理|拒否|operation_id/);
    expect(within(viewerArea()).getAllByText(/受理/).every((el) => !panel().contains(el))).toBe(true);
  });
});

describe("非公開の検索・baseline（実応答）", () => {
  it.each([["プレイヤー0"], ["プレイヤー1"], ["観戦者"]])("パソコン通信の探したカードは %s の欄に出ない", async (seat) => {
    const { transport } = traderServer((c) => {
      if (c.path === "/api/cards") return CATALOG;
      const s = c.path.startsWith("/api/seat/") ? SEAT_OF[tokenOf(c)] : undefined;
      if (c.body?.type === "view" && s !== undefined) return F.CS_VIEWS[s];
      if (c.body?.type === "log" && s !== undefined) return c.body.from ? F.CS_LOG_AT_END[s][0] : F.CS_LOG[s][0];
      return undefined;
    });
    const user = await start(transport);
    if (seat !== "プレイヤー0") await showSeat(user, seat);
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ（\d+ 件）に、見せたカードの出来事はまだありません/));
    expect(panel().textContent).not.toMatch(new RegExp(`マサキ|PMCG1-074|${F.SEARCHED_UID}`));
  });

  it("hub を作る前の出来事（baseline_end より前）に「接続元の状態から取得した履歴」の注記", async () => {
    const { transport } = traderServer((c) => {
      if (c.path === "/api/cards") return CATALOG;
      const s = c.path.startsWith("/api/seat/") ? SEAT_OF[tokenOf(c)] : undefined;
      if (c.body?.type === "view" && s !== undefined) return F.BASELINE_VIEWS[s];
      if (c.body?.type === "log" && s !== undefined) return c.body.from ? F.BASELINE_LOG_AT_END[s][0] : F.BASELINE_LOG[s][0];
      return undefined;
    });
    const user = await start(transport);
    await showSeat(user, "観戦者");
    await waitFor(() => expect(rows()).toHaveLength(2));
    for (const r of rows()) expect(r).toMatch(/接続元の状態から取得した履歴です/);
  });
});

describe("取得の状態（人工: 遅い応答・切り替え・誤り・位置の不明・ページ）", () => {
  it("閲覧者を切り替えたあとに届いた前の閲覧者の応答は捨てる", async () => {
    const late = deferred<unknown>();
    let first = true;
    const { transport, world } = traderServer((c) => {
      if (c.body?.type === "log" && tokenOf(c) === "tok0" && first) {
        first = false;
        return late.promise;
      }
      return undefined;
    });
    world.phase = "S1";
    const user = await start(transport);
    await showSeat(user, "プレイヤー1");
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ（1 件）/));
    await act(async () => late.resolve(F.TRADER_LOG_S3[0][0])); // 前の閲覧者（プレイヤー0）の、別の時点の応答
    await settle();
    expect(rows()).toEqual([]);
    expect(panel().textContent).toMatch(/取得したログ（1 件）/);
  });

  it("新しい対戦に置き換えたあとに届いた前の対戦の応答は捨てる（取得状態はゲームごと）", async () => {
    const late = deferred<unknown>();
    let held = false;
    let created = 0;
    const MATCH2 = { ...MATCH, match: { ...MATCH.match, match_id: "m2", seats: { player0: { token: "tok0b" }, player1: { token: "tok1b" }, spectator: { token: "tokSb" } }, host: { token: "tokHb" } } };
    const { transport, world } = traderServer((c) => {
      if (c.path === "/api/local-match") return ++created === 1 ? MATCH : MATCH2;
      if (c.body?.type === "log" && tokenOf(c) === "tok0" && !held) {
        held = true;
        return late.promise;
      }
      if (tokenOf(c) === "tokHb" && c.body?.type === "view") return { ...F.TRADER_VIEWS_S1.spectator, viewer: "host" };
      return undefined;
    });
    world.phase = "S1";
    const user = await start(transport);
    await user.click(screen.getByRole("button", { name: "新しい対戦…" }));
    await user.click(await screen.findByRole("button", { name: /対戦を作成/ }));
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    await waitFor(() => expect(logCalls(transport, "tok0b").length).toBeGreaterThan(0));
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ（1 件）/));
    await act(async () => late.resolve(F.TRADER_LOG_S3[0][0]));
    await settle();
    expect(rows()).toEqual([]);
  });

  it("更新が gap になっても、ログは保持した next から読む（更新の保持とは独立）", async () => {
    let gap = false;
    const { transport, world } = traderServer((c) => {
      if (gap && /\/updates\?after=\d+$/.test(c.path)) return { gui_server: 1, ok: true, kind: "updates", latest: 120, oldest_retained: 21, gap: true, updates: [] };
      return undefined;
    });
    world.phase = "S2";
    const user = await start(transport);
    await waitFor(() => expect(rows()).toHaveLength(1));
    world.phase = "S3";
    gap = true;
    const before = logCalls(transport, "tok0").length;
    await user.click(within(viewerArea()).getByRole("button", { name: "再取得" }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(await within(viewerArea()).findByText(/古い更新は接続層の保持範囲の外です/)).toBeInTheDocument();
    expect(logCalls(transport, "tok0")[before]!.body?.from).toEqual(F.TRADER_LOG_S2[0][0].next);
  });

  it("位置の不明では先頭から 1 回だけ取り直し、取り直しも失敗したら誤りを示して止める（再取得で自動に繰り返さない）", async () => {
    let unknown = false;
    const { transport, world } = traderServer((c) => (c.body?.type === "log" && unknown ? POSITION_UNKNOWN : undefined));
    world.phase = "S2";
    const user = await start(transport);
    await waitFor(() => expect(rows()).toHaveLength(1));
    unknown = true;
    const before = logCalls(transport, "tok0").length;
    await user.click(within(viewerArea()).getByRole("button", { name: "再取得" }));
    await within(panel()).findByRole("alert");
    expect(within(panel()).getByRole("alert").textContent).toMatch(/CLIENT_LOG_POSITION_UNKNOWN.*先頭から取り直しても/);
    expect(logCalls(transport, "tok0").slice(before).map((c) => c.body?.from ?? null)).toEqual([F.TRADER_LOG_S2[0][0].next, null]);
    for (let i = 0; i < 3; i++) await user.click(within(viewerArea()).getByRole("button", { name: "再取得" }));
    await settle();
    expect(logCalls(transport, "tok0")).toHaveLength(before + 2); // 止めたまま
    unknown = false;
    await user.click(within(panel()).getByRole("button", { name: "ログを先頭から取り直す" }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(logCalls(transport, "tok0").at(-1)!.body?.from).toBeUndefined();
  });

  it("読み取りの失敗は誤りとして示し、送信・check は変えない（自動で再送しない）", async () => {
    const { transport } = traderServer((c) => (c.body?.type === "log" ? new NetworkError() : undefined));
    const user = await start(transport);
    await within(panel()).findByRole("alert");
    expect(panel().textContent).not.toMatch(/まだありません/);
    await answer(user, "手札のトレーナーを使う", F.TRADER_PLAY.choices[0]);
    await within(viewerArea()).findByText(/受理（決定待ち）: 手札のトレーナーを使う/);
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1);
    expect(ofType(transport, "check")).toHaveLength(1);
    expect(logCalls(transport, "tok0")).toHaveLength(1); // 誤りのあとは画面のボタンまで読まない
  });

  it("256 件を超えるログ（実応答の 3 ページ）を complete まで読み、追記（人工）も保持した next から足す", async () => {
    const pages = F.SUDDEN_DEATH_SPECTATOR_PAGES;
    let appended = false;
    const extra = {
      ...pages[2],
      entries: [{ segment: 0, log_index: 681, event: { kind: "reveal_from_deck", turn: 40, player: 1, card: 99, card_id: F.TRADER_REVEALED_ID } }],
      next: { segment: 0, index: 682 },
      end: { segment: 0, index: 682 },
    };
    const atEnd = (i: number) => ({ ...pages[2], entries: [], next: { segment: 0, index: i }, end: { segment: 0, index: i } });
    const { transport } = traderServer((c) => {
      if (c.body?.type !== "log" || tokenOf(c) !== "tokS") return undefined;
      const from = c.body.from as { index: number } | undefined;
      if (!from) return pages[0];
      if (from.index === 256) return pages[1];
      if (from.index === 512) return pages[2];
      if (from.index === 681) return appended ? extra : atEnd(681);
      return atEnd(682);
    });
    const user = await start(transport);
    await showSeat(user, "観戦者");
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ（681 件）/));
    expect(logCalls(transport, "tokS").slice(0, 3).map((c) => (c.body?.from as { index: number } | undefined)?.index ?? null)).toEqual([null, 256, 512]);
    appended = true;
    await user.click(within(viewerArea()).getByRole("button", { name: "再取得" }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/プレイヤー1が山札から見せて手札に加えた: フシギソウ PMCG1-008 （ログの位置 0:681）/);
    expect(rows()[0]).not.toMatch(/接続元の状態/); // baseline_end（681）以降
  });
});
