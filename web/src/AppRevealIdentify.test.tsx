// 画面全体での 0.184.0（見せる 17 の呼ぶ箇所の card_id）の代表 3 経路（模擬の接続層・模擬の描画。製品のコードは 0.183.0 から変えていない）。
// 出典: 「実応答」は test/revealLog.ts（導入した 0.184.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は遅い応答と、時点を飛ばした取り直しの位置で実応答を切り出した log（エンジンの情報境界の確かめには使わない）。
// 実エンジンとの確かめは server/tests/test_reveal.py と e2e/reveal-identify.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, deferred, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as F from "./test/revealLog";

type Seat = "0" | "1" | "spectator";
type Page = { entries: { log_index: number; event: { kind: string } }[]; next: unknown };
type Point = { views: Record<Seat, unknown>; log: Record<Seat, readonly Page[]>; atEnd: Record<Seat, readonly Page[]>; fromPrev?: Record<Seat, readonly Page[]> };
type Step = { actor: 0 | 1; candidates: { response: Record<string, unknown> }; inputs: unknown; choices: readonly string[]; check: unknown; submit: unknown };
type Rep = { points: readonly Point[]; steps: readonly Step[]; candidatesAfter: { response: Record<string, unknown> } };
const REPS = { gift: F.GIFT as unknown as Rep, master: F.MASTER_BALL as unknown as Rep, jelly: F.JELLYFISH as unknown as Rep, cs: F.CS as unknown as Rep };
const SEAT_OF: Record<string, Seat> = { tok0: "0", tok1: "1", tokS: "spectator" };
const tokenOf = (c: Call) => c.path.split("/")[3]!;
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const panel = () => within(viewerArea()).getByRole("region", { name: "見せたカード（公開のログ）" });
const rows = () => within(panel()).queryAllByRole("listitem").map((li) => li.textContent ?? "");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const CATALOG = {
  gui_server: 1,
  ok: true,
  cards: [
    { id: "PMCG1-060", name_ja: "コラッタ", category: "pokemon", stage: "basic", hp: 30 },
    { id: "neo1-073", name_ja: "きのみ", category: "trainer", stage: null, hp: null },
    { id: "PMCG3-011", name_ja: "メノクラゲ", category: "pokemon", stage: "basic", hp: 40 },
    { id: "PMCG1-074", name_ja: "マサキ", category: "trainer", stage: null, hp: null },
  ],
};

function realLog(rep: Rep, phase: number, seat: Seat, from: unknown): unknown {
  const p = rep.points[phase]!;
  if (from === undefined) return p.log[seat][0];
  if (same(from, p.atEnd[seat][0]!.next)) return p.atEnd[seat][0];
  if (phase > 0 && same(from, rep.points[phase - 1]!.log[seat][0]!.next)) return p.fromPrev![seat][0];
  // 時点を飛ばした取り直し（ほかの閲覧者の画面にいた間に進んだ）: その時点の先頭からの応答を、同じ位置から切り出した（人工・実応答の写し）
  const whole = p.log[seat][0]!;
  const start = (from as { index: number }).index;
  return { ...whole, entries: whole.entries.filter((e) => e.log_index >= start) };
}

function server(rep: Rep, override: (c: Call) => unknown = () => undefined) {
  const world = { phase: 0 };
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
      if (seat === undefined) throw new Error("ホストの画面は log を読まない");
      return realLog(rep, world.phase, seat, c.body?.from);
    }
    const views = rep.points[world.phase]!.views;
    if (type === "view") return tok === "tokH" ? { ...(views.spectator as object), viewer: "host" } : views[seat!];
    const step = rep.steps[world.phase];
    if (type === "candidates") {
      const own = step ? step.candidates : rep.candidatesAfter;
      const actor = step ? String(step.actor) : "0";
      if (seat === actor) return own;
      return { ...own, response: { ...own.response, actor: seat === "spectator" || seat === undefined ? null : Number(seat), situation: "waiting_for_player", empty_reason: "not_actor", candidates: [] } };
    }
    if (type === "inputs") return step!.inputs;
    if (type === "check") return step!.check;
    if (type === "submit") {
      world.phase += 1;
      return step!.submit;
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
  if (!item) throw new Error(`候補 ${label} がまだない`);
  return item;
}

/** 候補を選び、各段の最初の選べるもの（「選ばない」を除く。実応答ではどの段も対象の 1 つ）を選んで、check → 送信。 */
async function answerFirst(user: ReturnType<typeof userEvent.setup>, label: string, outcome: RegExp) {
  await user.click(within(await waitFor(() => candidateItem(label))).getByRole("button", { name: "この操作を選ぶ" }));
  const p = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  await waitFor(() => expect(p.querySelectorAll("fieldset.stage").length).toBeGreaterThan(0));
  for (const stage of Array.from(p.querySelectorAll("fieldset.stage"))) {
    const first = within(stage as HTMLElement)
      .queryAllByRole("radio")
      .find((r) => !/選ばない/.test(r.closest("label")?.textContent ?? "")); // 最小数 0 の段の「選ばない」は選ばない
    if (first) await user.click(first);
  }
  await user.click(within(p).getByRole("button", { name: "入力を検査" }));
  await within(p).findByText(/エンジンの検査を通りました/);
  await user.click(within(p).getByRole("button", { name: "送信" }));
  await waitFor(() => {
    const latest = within(viewerArea()).getByRole("region", { name: "診断と結果" }).querySelector(".callout");
    expect(latest?.textContent ?? "").toMatch(outcome);
    expect(viewerArea().querySelector(".console")?.getAttribute("aria-busy")).toBe("false");
  });
  await settle();
}

async function showSeat(user: ReturnType<typeof userEvent.setup>, seat: string) {
  await user.click(screen.getByRole("radio", { name: seat }));
  await within(viewerArea()).findByRole("region", { name: "対戦の状態" });
  await settle();
}

const ofType = (t: ReturnType<typeof mockTransport>, type: string) => t.calls.filter((c) => c.body?.type === type);

describe("B 特殊能力（おくりもの。実応答）: 使った人と相手がそれぞれ見せる", () => {
  it("見せるまでは出さず、使った人の 1 枚、相手の 1 枚の順に、相手・観戦者の欄にも同じ名前で出る。入力・check・送信は今までどおり", async () => {
    const { transport } = server(REPS.gift);
    const user = await start(transport);
    await answerFirst(user, "進化させる", /受理/);
    await answerFirst(user, "決定に答える", /受理/);
    await answerFirst(user, "決定に答える", /受理/);
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ/));
    expect(rows()).toEqual([]); // 山札から選ぶ前
    await answerFirst(user, "決定に答える", /受理/);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/プレイヤー0が山札から見せて手札に加えた: きのみ neo1-073/);
    await showSeat(user, "プレイヤー1");
    await waitFor(() => expect(rows()).toHaveLength(1));
    await answerFirst(user, "決定に答える", /受理/);
    await answerFirst(user, "決定に答える", /受理/);
    await waitFor(() => expect(rows()).toHaveLength(2));
    for (const seat of ["プレイヤー1", "観戦者", "プレイヤー0"]) {
      await showSeat(user, seat);
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(rows()[0]).toMatch(/プレイヤー0が山札から見せて手札に加えた: きのみ neo1-073 （ログの位置 0:2）/);
      expect(rows()[1]).toMatch(/プレイヤー1が山札から見せて手札に加えた: きのみ neo1-073 （ログの位置 0:4）/);
      expect(panel().textContent).not.toMatch(/@power0|接続元の状態/);
    }
    const real = REPS.gift.steps.map((s) => s.choices);
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual(real);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual(real); // 自動で再送しない
    expect(ofType(transport, "log").filter((c) => tokenOf(c) === "tokH")).toHaveLength(0);
  });
});

describe("A トレーナー（マスターボール。実応答）", () => {
  it("使った直後には出さず、加えたあとに観戦者の欄にもコラッタ", async () => {
    const { transport } = server(REPS.master);
    const user = await start(transport);
    await answerFirst(user, "手札のトレーナーを使う", /受理（決定待ち）/);
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ/));
    expect(rows()).toEqual([]);
    await answerFirst(user, "決定に答える", /受理/);
    await waitFor(() => expect(rows()).toHaveLength(1));
    await showSeat(user, "観戦者");
    await waitFor(() => expect(rows()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: コラッタ PMCG1-060 （ログの位置 0:2）/)]));
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual(REPS.master.steps.map((s) => s.choices));
  });
});

describe("C ワザの要素（くらげのむれ）と非公開の対照（実応答）・遅い応答（人工）", () => {
  it("相手・観戦者の欄にメノクラゲ。閲覧者を切り替えたあとに届いた前の閲覧者の応答は捨てる", async () => {
    const late = deferred<unknown>();
    let held = false;
    const { transport, world } = server(REPS.jelly, (c) => {
      if (c.body?.type === "log" && tokenOf(c) === "tok0" && !held) {
        held = true;
        return late.promise;
      }
      return undefined;
    });
    world.phase = 1; // 宣言のあと・山札から選ぶ前
    const user = await start(transport);
    await showSeat(user, "プレイヤー1");
    await waitFor(() => expect(panel().textContent).toMatch(/取得したログ/));
    expect(rows()).toEqual([]);
    await act(async () => late.resolve(REPS.jelly.points[2]!.log["0"][0])); // 前の閲覧者の、あとの時点の応答
    await settle();
    expect(rows()).toEqual([]);
    world.phase = 2;
    for (const seat of ["観戦者", "プレイヤー1"]) {
      await showSeat(user, seat);
      await waitFor(() => expect(rows()).toEqual([expect.stringMatching(/プレイヤー0が山札から見せて手札に加えた: メノクラゲ PMCG3-011 （ログの位置 0:1）/)]));
    }
  });

  it.each(["プレイヤー1", "観戦者"])("パソコン通信の探したカードは %s の欄に出ない", async (seat) => {
    const { transport, world } = server(REPS.cs);
    world.phase = REPS.cs.points.length - 1;
    const user = await start(transport);
    await showSeat(user, seat);
    await waitFor(() => expect(panel().textContent).toMatch(/見せたカードの出来事はまだありません/));
    expect(panel().textContent).not.toMatch(/マサキ|PMCG1-074/);
  });
});
