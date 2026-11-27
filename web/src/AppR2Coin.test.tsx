// 画面全体での 0.189.0（R-2: 本人のうらのバトル場のワザの宣言のクチバシティジムのコイン。0.188.0 の提示・0.189.0 の先読みの修正）の表示・入力・送信（模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/r2Coin.ts（導入した 0.189.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は 2 つだけ: 受理の筋書きの送る前のプレイヤー1 の candidates（実応答の本人の candidates を、番でない形にし、coverage は実応答の番でない応答のものに替えた）と、log の from に合わせた実応答のページの切り出し
// （実応答の complete なページから from 以降を返す）。実エンジンとの確かめは server/tests/test_r2_coin.py と e2e/r2-coin.spec.ts。
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, emptyLog, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as T from "./test/r2Coin";

type Seat = "0" | "1" | "spectator" | "host";
type Page = { entries: { segment: number; log_index: number; event: Record<string, unknown> }[]; next: unknown; end: unknown; complete: boolean };
type After = { submit: unknown; viewsAfter: Record<Seat, unknown>; logAfter: Record<string, readonly Page[]>; candidatesAfter: Record<string, unknown> };
type Submit = After & {
  choices: readonly string[];
  views: Record<Seat, unknown>;
  log: Record<string, readonly Page[]>;
  candidates: { response: Record<string, unknown> };
  inputs: unknown;
  retry?: After & { choices: readonly string[]; candidates: { response: Record<string, unknown> }; inputs: unknown; check: unknown };
};
type Board = {
  views: Record<Seat, unknown>;
  candidates: { response: Record<string, unknown> };
  inputs: unknown;
  checks: Record<string, { choices: readonly string[]; body: unknown }>;
  submits: Record<string, Submit>;
};
const B = (b: unknown) => b as Board;
const SEAT_OF: Record<string, Seat> = { tok0: "0", tok1: "1", tokS: "spectator", tokH: "host" };
const tokenOf = (c: Call) => c.path.split("/")[3]!;
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const same = (a: readonly unknown[] | undefined, b: readonly unknown[]) => JSON.stringify(a ?? []) === JSON.stringify(b);
const CATALOG = {
  gui_server: 1,
  ok: true,
  cards: [
    { id: "PMCG5-076", name_ja: "クチバシティジム", category: "trainer", stage: null, hp: null },
    { id: "PMCG5-037", name_ja: "マチスのコイル", category: "pokemon", stage: "basic", hp: 40 },
    { id: "PMCG5-057", name_ja: "マチスのオニスズメ", category: "pokemon", stage: "basic", hp: 50 },
    { id: "PMCG5-059", name_ja: "マチスのラッタ", category: "pokemon", stage: "stage1", hp: 60 },
    { id: "PMCG5-040", name_ja: "マチスのレアコイル", category: "pokemon", stage: "stage1", hp: 70 },
    { id: "PMCG1-058", name_ja: "エビワラー", category: "pokemon", stage: "basic", hp: 70 },
  ],
};

/** 人工: 実応答の complete なページ（1 ページ）から、from 以降の出来事だけを返す。 */
function logPage(pages: readonly Page[], from: unknown): unknown {
  const whole = pages[0]!;
  if (pages.length !== 1 || !whole.complete) throw new Error("1 ページの complete なログだけを扱う");
  if (from === undefined) return whole;
  const start = (from as { index: number }).index;
  return { ...whole, entries: whole.entries.filter((e) => e.log_index >= start) };
}

/** 盤面 1 つ・送信の筋書き 1 つの模擬の接続層。送ったら実応答の「送ったあと」へ、拒否なら同じ対戦で直した入力の応答へ移る。 */
function server(board: Board, name: string | null) {
  const sub = name === null ? null : board.submits[name]!;
  const world = { phase: "before" as "before" | "after" | "rejected" | "retried" };
  const transport = mockTransport((c) => {
    if (c.path === "/api/cards") return CATALOG;
    const common = c.body?.type === "log" ? undefined : commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const seat = SEAT_OF[tokenOf(c)]!;
    const after: After | null = world.phase === "after" ? sub : world.phase === "retried" ? sub!.retry! : null;
    if (type === "view") return (after ? after.viewsAfter : sub ? sub.views : board.views)[seat];
    if (type === "log") return sub ? logPage((after ? after.logAfter : sub.log)[seat]!, c.body?.from) : emptyLog(c); // 対照の盤面はログを採っていない（模擬の空のログ）
    if (type === "candidates") {
      if (after) return after.candidatesAfter[seat];
      const own = world.phase === "rejected" ? sub!.retry!.candidates : sub ? sub.candidates : board.candidates;
      if (seat === "0") return own;
      if (sub?.retry) return sub.candidatesAfter[seat]; // 実応答: 拒否は状態を変えないので、拒否のあとのプレイヤー1 の candidates は送る前と同じ局面
      const notActor = (sub?.candidatesAfter["0"] as { response: { coverage: unknown } } | undefined)?.response.coverage; // 実応答の番でない本人の coverage
      return { ...own, response: { ...own.response, actor: 1, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [], coverage: notActor } }; // 人工
    }
    if (type === "inputs") return world.phase === "rejected" ? sub!.retry!.inputs : sub ? sub.inputs : board.inputs;
    const choices = c.body?.choices as string[] | undefined;
    if (type === "check") {
      if (world.phase === "rejected" && sub!.retry && same(choices, sub!.retry.choices)) return sub!.retry.check;
      const found = Object.values(board.checks).find((x) => same(choices, x.choices));
      if (found) return found.body;
    }
    if (type === "submit" && sub) {
      if (world.phase === "before" && same(choices, sub.choices)) {
        world.phase = sub.retry ? "rejected" : "after";
        return sub.submit;
      }
      if (world.phase === "rejected" && same(choices, sub.retry!.choices)) {
        world.phase = "retried";
        return sub.retry!.submit;
      }
    }
    throw new Error(`想定外 ${c.path} ${String(type)} ${JSON.stringify(choices)}`);
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
async function openAttack(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(await waitFor(() => candidateItem("ワザを使う"))).getByRole("button", { name: "この操作を選ぶ" }));
  const p = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  await waitFor(() => expect(p.querySelectorAll("fieldset.stage").length).toBe(2));
  return p;
}
const stageOf = (p: HTMLElement, n: number) => p.querySelectorAll("fieldset.stage")[n - 1] as HTMLElement;
async function showSeat(user: ReturnType<typeof userEvent.setup>, seat: string) {
  await user.click(screen.getByRole("radio", { name: seat }));
  await within(viewerArea()).findByRole("region", { name: "対戦の状態" });
  await settle();
}
const ofType = (t: ReturnType<typeof mockTransport>, type: string) => t.calls.filter((c) => c.body?.type === type);
const coinPanel = () => within(viewerArea()).getByRole("region", { name: "コインの結果（公開のログ）" });
const coinRows = () => within(coinPanel()).queryAllByRole("listitem").map((li) => li.textContent ?? "");
const COIN = /場のスタジアムのコインを投げる（クチバシティジム）/;

describe("R-2: うらのバトル場のワザの宣言とクチバシティジムのコイン（実応答）", () => {
  it("2 段目にエンジンが返したコインを示し、既定は選ばない。処理可能性は未確認のまま、実行を保証しない案内を残す", async () => {
    const { transport } = server(B(T.R2_COIN_MAGNEMITE_HEADS), "tackle_coin");
    const user = await start(transport);
    expect(candidateItem("ワザを使う")).toHaveTextContent("未確認");
    const p = await openAttack(user);
    expect(within(stageOf(p, 1)).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual([
      expect.stringMatching(/［でんきショック］/),
      expect.stringMatching(/［たいあたり］/),
    ]);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［たいあたり］/ }));
    const coin = within(stageOf(p, 2)).getByRole("radio", { name: COIN });
    expect(coin).not.toBeChecked(); // 自動で選ばない
    expect(within(stageOf(p, 2)).getByRole("radio", { name: "選ばない" })).toBeChecked(); // 任意（0 個でよい）
    expect(coin.closest("li")).toHaveTextContent("未確認");
    expect(stageOf(p, 2)).toHaveTextContent("選んでも、コインを投げることは保証しない"); // エンジンの段の note のまま
    expect(p).toHaveTextContent(/必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます/);
    expect(p.textContent).not.toMatch(/必ずコイン|コインを投げます|受理されます/);
  });

  it("コインなし: [たいあたり] の check・送信。コインを足さない", async () => {
    const { transport } = server(B(T.R2_COIN_MAGNEMITE_HEADS), "tackle_plain");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［たいあたり］/ }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o2"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o2"]]);
    await waitFor(() => expect(coinPanel()).toHaveTextContent("コインの出来事はまだありません"));
  });

  it("コインあり: [たいあたり, コイン] の順で check・送信し、受理のあとエンジンの公開のログのコインの結果（おもて）を示す", async () => {
    const { transport } = server(B(T.R2_COIN_MAGNEMITE_HEADS), "tackle_coin");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［たいあたり］/ }));
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: COIN }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    const ok = await within(p).findByRole("status", { name: "" });
    await waitFor(() => expect(within(p).getByText(/エンジンの形の検査を通りました/)).toBeInTheDocument());
    expect(within(p).getByText(/エンジンの形の検査を通りました/).textContent).toMatch(/宣言といっしょに選ぶもの/);
    expect(within(p).getByText(/エンジンの形の検査を通りました/).textContent).toMatch(/コインを投げられるか/);
    expect(ok).toBeTruthy();
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o2", "o3"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o2", "o3"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(1));
    expect(coinRows()[0]).toMatch(/プレイヤー0のコイン（場のスタジアム: クチバシティジム PMCG5-076）: おもて/);
    // 相手・観戦者にも、エンジンが公開した同じ出来事だけが届く（本人の入力・診断は出ない）
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      await waitFor(() => expect(coinRows()).toHaveLength(1));
      expect(coinRows()[0]).toMatch(/: おもて/);
      expect(within(viewerArea()).queryByText(/受理.*ワザを使う/)).toBeNull();
    }
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1); // 自動の再送なし
  });

  it("コインの面（うら）は実応答のまま示す", async () => {
    const { transport } = server(B(T.R2_COIN_MAGNEMITE_TAILS), "tackle_coin");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［たいあたり］/ }));
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: COIN }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    await waitFor(() => expect(coinRows()).toHaveLength(1));
    expect(coinRows()[0]).toMatch(/: うら/);
  });

  it("選択を変えたら前の check を使わない（コインを外す・ワザを変える）", async () => {
    const { transport } = server(B(T.R2_COIN_MAGNEMITE_HEADS), "tackle_plain");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［たいあたり］/ }));
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: COIN }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: "選ばない" }));
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(within(p).getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: COIN }));
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［でんきショック］/ }));
    expect(within(stageOf(p, 2)).getByRole("radio", { name: COIN })).not.toBeChecked(); // ワザを変えたら 2 段目を捨てる
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［たいあたり］/ }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o2", "o3"], ["o2"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o2"]]);
  });

  it("VM1（かまいたち + コイン）の拒否は本人だけに示し、状態・ログは変わらない。コインなしへ直して送ると受理し、ワザのコインの結果を示す", async () => {
    const { transport } = server(B(T.R2_COIN_SPEAROW), "kamaitachi_coin");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［かまいたち］/ }));
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: COIN }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("拒否（エンジン）: ワザを使う")).toBeInTheDocument();
    expect(viewerArea()).toHaveTextContent("UNRESOLVED_VERMILION_GYM_ATTACK_ORDER");
    expect(viewerArea()).toHaveTextContent(/エンジンが受け付けませんでした（状態は変わりません）/);
    await settle();
    expect(coinRows()).toEqual([]);
    expect(ofType(transport, "submit")).toHaveLength(1);
    // 相手・観戦者: 拒否の診断・本当のカード・コインの出来事は届かない
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      expect(viewerArea().textContent).not.toMatch(/UNRESOLVED_VERMILION_GYM_ATTACK_ORDER|拒否（エンジン）|マチスのオニスズメ|かまいたち/);
      await waitFor(() => expect(coinPanel()).toHaveTextContent("コインの出来事はまだありません"));
    }
    // 本人: 同じ局面で入力を直す（コインなし）。前の check は使わない
    await showSeat(user, "プレイヤー0");
    const again = await openAttack(user);
    await user.click(within(stageOf(again, 1)).getByRole("radio", { name: /［かまいたち］/ }));
    expect(within(stageOf(again, 2)).getByRole("radio", { name: "選ばない" })).toBeChecked();
    expect(within(again).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(again).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(again).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o2", "o3"], ["o2"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(1));
    expect(coinRows()[0]).toMatch(/プレイヤー0のコイン（ワザ）: うら/);
  });

  it("たねでない本当のカード（マチスのラッタ）: コインを選んで受理されても、コインの出来事は出ない（結果は応答のまま）", async () => {
    const { transport } = server(B(T.R2_COIN_RATICATE), "first_coin");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［きあいだめ］/ }));
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: COIN }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    await waitFor(() => expect(coinPanel()).toHaveTextContent("コインの出来事はまだありません"));
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o3"]]);
  });

  it("対照: スタジアムなし・特殊能力を持つ本当のカードでは、2 段目にコインを出さない（GUI はカード名・スタジアムから決めない）", async () => {
    for (const board of [T.R2_NO_STADIUM, T.R2_POWERED]) {
      const { transport } = server(B(board), null);
      const user = await start(transport);
      const p = await openAttack(user);
      await user.click(within(stageOf(p, 1)).getAllByRole("radio")[0]!);
      expect(stageOf(p, 2)).toHaveTextContent("宣言といっしょに選べるものはありません");
      expect(within(stageOf(p, 2)).queryByRole("radio", { name: COIN })).toBeNull();
      cleanup();
    }
  });
});
