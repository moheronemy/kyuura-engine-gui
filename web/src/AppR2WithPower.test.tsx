// 画面全体での 0.190.0（R-2 の［めいれい］: 本人のうらのバトル場のワザの宣言に、自分の場のおもてのポケモンの［めいれい］（with_power）を示す）の表示・入力・送信
// （模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/r2WithPower.ts（導入した 0.190.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は次だけで、テストの名前・注記で分ける:
// - 受理の筋書きの送る前のプレイヤー1 の candidates（実応答の本人の candidates を、番でない形にし、coverage は実応答の番でない応答のものに替えた。AppR2Coin と同じ）
// - log の from に合わせた実応答のページの切り出し（実応答の complete なページから from 以降を返す）
// - コインと［めいれい］の同時の提示（実在するカードの組み合わせにない。エンジンのテストも人工。実応答の入力に 2 段目のコインを 1 つ加えた応答と、その check の答え）
// 実エンジンとの確かめは server/tests/test_r2_with_power.py と e2e/r2-with-power.spec.ts。
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, emptyLog, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as T from "./test/r2WithPower";

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
    { id: "PMCG6-004", name_ja: "サカキのニドラン♂", category: "pokemon", stage: "basic", hp: 40 },
    { id: "PR1-068", name_ja: "サカキのニドキング", category: "pokemon", stage: "stage2", hp: 100 },
    { id: "PMCG1-005", name_ja: "ニドラン♂", category: "pokemon", stage: "basic", hp: 40 },
    { id: "PMCG3-007", name_ja: "ベトベトン", category: "pokemon", stage: "stage1", hp: 70 },
    { id: "PMCG1-060", name_ja: "コラッタ", category: "pokemon", stage: "basic", hp: 30 },
    { id: "PMCG1-058", name_ja: "エビワラー", category: "pokemon", stage: "basic", hp: 70 },
    { id: "PMCG5-076", name_ja: "クチバシティジム", category: "trainer", stage: null, hp: null },
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

/** 盤面 1 つ・送信の筋書き 1 つの模擬の接続層。送ったら実応答の「送ったあと」へ、拒否なら同じ対戦で直した入力の応答へ移る。
 * extraChecks は人工の check の答え（人工の入力のときだけ）。 */
function server(board: Board, name: string | null, override?: { inputs?: unknown; checks?: { choices: readonly string[]; body: unknown }[] }) {
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
    if (type === "log") return sub ? logPage((after ? after.logAfter : sub.log)[seat]!, c.body?.from) : emptyLog(c); // 対照の盤面はログを使わない（模擬の空のログ）
    if (type === "candidates") {
      if (after) return after.candidatesAfter[seat];
      const own = world.phase === "rejected" ? sub!.retry!.candidates : sub ? sub.candidates : board.candidates;
      if (seat === "0") return own;
      if (sub?.retry) return sub.candidatesAfter[seat]; // 実応答: 拒否は状態を変えないので、拒否のあとのプレイヤー1 の candidates は送る前と同じ局面
      const notActor = (sub?.candidatesAfter["0"] as { response: { coverage: unknown } } | undefined)?.response.coverage; // 実応答の番でない本人の coverage
      return { ...own, response: { ...own.response, actor: 1, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [], coverage: notActor } }; // 人工
    }
    if (type === "inputs") return override?.inputs ?? (world.phase === "rejected" ? sub!.retry!.inputs : sub ? sub.inputs : board.inputs);
    const choices = c.body?.choices as string[] | undefined;
    if (type === "check") {
      if (world.phase === "rejected" && sub!.retry && same(choices, sub!.retry.choices)) return sub!.retry.check;
      const found = [...(override?.checks ?? []), ...Object.values(board.checks)].find((x) => same(choices, x.choices));
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
const checkText = (p: HTMLElement) => within(p).getByRole("status").textContent ?? "";
/** 相手（プレイヤー1）のバトル場のエビワラーのダメージ（観測の値のまま）。 */
const opponentDamage = () => {
  const card = within(viewerArea()).getByRole("article", { name: /バトル場: エビワラー/ });
  const stats = within(card).getByLabelText("今の状態（観測の値）");
  return [...stats.querySelectorAll("div")].find((d) => d.querySelector("dt")?.textContent === "ダメージ")?.querySelector("dd")?.textContent;
};
const K1 = /［めいれい］ — 自分の場のポケモンの、ワザといっしょに使う特殊能力（サカキのニドキング（プレイヤー0・ベンチ1））/;
const K2 = /［めいれい］ — 自分の場のポケモンの、ワザといっしょに使う特殊能力（サカキのニドキング（プレイヤー0・ベンチ3））/;
const NIDOGERI = /［にどげり］/;

async function pickAttackAndCheck(user: ReturnType<typeof userEvent.setup>, p: HTMLElement, holders: RegExp[]) {
  await user.click(within(stageOf(p, 1)).getByRole("radio", { name: NIDOGERI }));
  for (const h of holders) await user.click(within(stageOf(p, 2)).getByRole(holders.length && stageOf(p, 2).querySelector("input[type=checkbox]") ? "checkbox" : "radio", { name: h }));
  await user.click(within(p).getByRole("button", { name: "入力を検査" }));
  await waitFor(() => expect(within(p).getByRole("status")).toBeInTheDocument());
}

describe("R-2 の［めいれい］: うらのバトル場のワザの宣言（実応答）", () => {
  it("2 段目にエンジンが返した［めいれい］を持ち主の場所つきで示し、既定は選ばない。未確認のまま、実行を保証しない案内を残す", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), "nidogeri_power");
    const user = await start(transport);
    expect(candidateItem("ワザを使う")).toHaveTextContent("未確認");
    const p = await openAttack(user);
    expect(within(stageOf(p, 1)).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual([
      expect.stringMatching(/［にどげり］/),
      expect.stringMatching(/［いかりのいちげき］/),
    ]);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: NIDOGERI }));
    const power = within(stageOf(p, 2)).getByRole("radio", { name: K1 });
    expect(power).not.toBeChecked(); // 自動で選ばない
    expect(within(stageOf(p, 2)).getByRole("radio", { name: "選ばない" })).toBeChecked(); // 任意（0 個でよい）
    expect(power.closest("li")).toHaveTextContent("未確認");
    expect(stageOf(p, 2)).toHaveTextContent("力を使えることは保証しない"); // エンジンの段の note のまま
    expect(p).toHaveTextContent(/必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます/);
    expect(p.textContent).not.toMatch(/ダメージが増えます|必ず|受理されます/);
  });

  it("力なし: [にどげり] の check・送信。［めいれい］を足さない。結果は応答・観測・ログのまま（コイン おもて 2 枚・ダメージ 20）", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), "nidogeri_plain");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAttackAndCheck(user, p, []);
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(2));
    expect(coinRows().every((r) => /プレイヤー0のコイン（ワザ）: おもて/.test(r))).toBe(true);
    expect(opponentDamage()).toBe("20");
  });

  it("力あり: [にどげり, ［めいれい］] の順で check・送信。check の文は特殊能力を使える・効果がはたらく保証でないと示す。結果は応答のまま（ダメージ 30）", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), "nidogeri_power");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAttackAndCheck(user, p, [K1]);
    const text = checkText(p);
    expect(text).toMatch(/エンジンの形の検査を通りました/);
    expect(text).toMatch(/特殊能力を使えるか/);
    expect(text).toMatch(/特殊能力を選んで受理されても、その効果がはたらいたとは限りません/);
    expect(text).toMatch(/同じ特殊能力を 2 つ選んでいないこと/);
    expect(text).not.toMatch(/コイン/); // コインを示していない応答では、コインの文を出さない
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o3"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o3"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(2));
    expect(opponentDamage()).toBe("30");
    // 相手・観戦者にも、エンジンが公開した同じ出来事・観測だけが届く（本人の入力・受理の表示は出ない）
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      await waitFor(() => expect(coinRows()).toHaveLength(2));
      expect(opponentDamage()).toBe("30");
      expect(within(viewerArea()).queryByText(/受理.*ワザを使う/)).toBeNull();
    }
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1); // 自動の再送なし
  });

  it("コイン 2 枚ともうら: ［めいれい］を選んで受理されてもダメージは 0 のまま（エンジンの計算を GUI で変えない）。おもて 1 枚は 20", async () => {
    for (const [board, sides, damage] of [[T.R2WP_ONE_TT, /: うら/, "0"], [T.R2WP_ONE_HT, null, "20"]] as const) {
      const { transport } = server(B(board), "nidogeri_power");
      const user = await start(transport);
      const p = await openAttack(user);
      await pickAttackAndCheck(user, p, [K1]);
      await user.click(await within(p).findByRole("button", { name: "送信" }));
      expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
      await waitFor(() => expect(coinRows()).toHaveLength(2));
      if (sides) expect(coinRows().every((r) => sides.test(r))).toBe(true);
      else expect(coinRows().map((r) => r.match(/: (おもて|うら)/)?.[1])).toEqual(["おもて", "うら"]);
      // ダメージ 0 は観測で 0（盤面は 0 を表示する）
      expect(opponentDamage()).toBe(damage);
      cleanup();
    }
  });

  it("持ち主 2 匹: それぞれ場所で区別し、2 つ選ぶと check が拒否し送れない。1 つへ直して check を取り直すと送れる（GUI は自分で禁止しない）", async () => {
    const { transport } = server(B(T.R2WP_TWO), "nidogeri_k1");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: NIDOGERI }));
    const k1 = within(stageOf(p, 2)).getByRole("checkbox", { name: K1 }) as HTMLInputElement;
    const k2 = within(stageOf(p, 2)).getByRole("checkbox", { name: K2 }) as HTMLInputElement;
    expect([k1.checked, k2.checked]).toEqual([false, false]);
    await user.click(k1);
    await user.click(k2);
    expect([k1.checked, k2.checked]).toEqual([true, true]); // 通常の操作で 2 つ選べる（GUI は禁止しない）
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(checkText(p)).toMatch(/通りません CANDIDATE_INPUT_INVALID/));
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(k2); // 1 つへ直す
    expect(within(p).getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(checkText(p)).toMatch(/エンジンの形の検査を通りました/));
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o3", "o4"], ["o1", "o3"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o3"]]); // 拒否された入力は送らない
    expect(opponentDamage()).toBe("30");
  });

  it("持ち主 2 匹: 2 匹目だけを選ぶと、その参照値のまま送る", async () => {
    const { transport } = server(B(T.R2WP_TWO), "nidogeri_k2");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAttackAndCheck(user, p, [K2]);
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o4"]]);
  });

  it("同じ持ち主の重なりは通常の操作では作れない（同じ選択肢をもう一度押すと外れる）。重なりの入力の扱いは接続層の契約テスト", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), "nidogeri_plain");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: NIDOGERI }));
    const k1 = within(stageOf(p, 2)).getByRole("radio", { name: K1 });
    await user.click(k1);
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: "選ばない" }));
    await user.click(k1);
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("status")).toBeInTheDocument());
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o3"]]);
  });

  it("選択を変えたら前の check を使わない（［めいれい］を外す・ワザを変える）", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), "nidogeri_plain");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAttackAndCheck(user, p, [K1]);
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: "選ばない" }));
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(within(p).getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: K1 }));
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［いかりのいちげき］/ }));
    expect(within(stageOf(p, 2)).getByRole("radio", { name: K1 })).not.toBeChecked(); // ワザを変えたら 2 段目を捨てる
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: NIDOGERI }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o3"], ["o1"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"]]);
  });

  it("エンジンの拒否（いかりのいちげき + ［めいれい］）は本人だけに示し、状態は変わらない。にどげり + ［めいれい］へ直して送ると受理する", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), "ikari_power");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［いかりのいちげき］/ }));
    await user.click(within(stageOf(p, 2)).getByRole("radio", { name: K1 }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("拒否（エンジン）: ワザを使う")).toBeInTheDocument();
    expect(viewerArea()).toHaveTextContent("NOT_ENOUGH_DAMAGE_COUNTERS");
    expect(viewerArea()).toHaveTextContent(/エンジンが受け付けませんでした（状態は変わりません）/);
    await settle();
    expect(coinRows()).toEqual([]);
    expect(opponentDamage()).toBe("0");
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      expect(viewerArea().textContent).not.toMatch(/NOT_ENOUGH_DAMAGE_COUNTERS|拒否（エンジン）|サカキのニドラン♂|いかりのいちげき/);
      await waitFor(() => expect(coinPanel()).toHaveTextContent("コインの出来事はまだありません"));
    }
    await showSeat(user, "プレイヤー0");
    const again = await openAttack(user);
    expect(within(again).getByRole("button", { name: "送信" })).toBeDisabled();
    await pickAttackAndCheck(user, again, [K1]);
    await user.click(await within(again).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o2", "o3"], ["o1", "o3"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(2));
    expect(opponentDamage()).toBe("30");
  });

  it("対照: 力が無効（かがくへんかガス）・名前が一致しない本当のカードでは、2 段目に［めいれい］を出さない（GUI はカード名・場から決めない）", async () => {
    for (const board of [T.R2WP_GAS, T.R2WP_NOT_NAMED]) {
      const { transport } = server(B(board), null);
      const user = await start(transport);
      const p = await openAttack(user);
      await user.click(within(stageOf(p, 1)).getAllByRole("radio")[0]!);
      expect(stageOf(p, 2)).toHaveTextContent("宣言といっしょに選べるものはありません");
      expect(within(stageOf(p, 2)).queryByRole("radio", { name: /めいれい/ })).toBeNull();
      await user.click(within(p).getByRole("button", { name: "入力を検査" }));
      await waitFor(() => expect(checkText(p)).toMatch(/ワザの番号が 1 つで、ほかを選ばないことだけ/)); // 0.180.0 からの文のまま
      cleanup();
    }
  });
});

describe("R-2: コインと［めいれい］の同時の提示（人工。実在するカードの組み合わせにない）", () => {
  /** 人工: 実応答の入力の 2 段目の先頭にクチバシティジムのコインを 1 つ加え、番号を振り直した応答（エンジンのテストの人工のケースと同じ並び: コイン → 場の並び）。 */
  function artificialInputs() {
    const body = structuredClone(T.R2WP_ONE_HH.inputs) as unknown as { response: { stages: Record<string, unknown>[] } };
    const [first, second] = body.response.stages as [Record<string, unknown>, Record<string, unknown> & { options: Record<string, unknown>[] }];
    const reasons = ["face_down_reveal_not_evaluated"];
    const coin = { id: "o3", addon: "stadium_coin", card: 99, card_id: "PMCG5-076", eligible: true, processability: "unverified", reasons };
    const power = { ...second.options[0]!, id: "o4" };
    second.options = [coin, power];
    second.count = { min: 0, max: 2 };
    second.options_by_choice = Object.fromEntries(
      (first.options as { id: string }[]).map((a) => [a.id, [coin, power].map((o) => ({ option: o.id, eligible: true, processability: "unverified", reasons }))]),
    );
    return body;
  }
  const valid = (choices: string[]) => ({ choices, body: T.R2WP_ONE_HH.checks.attack_power.body }); // 人工: 実応答の通る答えを使う

  it("check の文は、示されたもの（コイン・特殊能力）の両方を保証しないと示す。選んだ順のまま送る", async () => {
    const { transport } = server(B(T.R2WP_ONE_HH), null, { inputs: artificialInputs(), checks: [valid(["o1", "o4", "o3"])] });
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: NIDOGERI }));
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: K1 }));
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: /場のスタジアムのコインを投げる（クチバシティジム）/ }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(checkText(p)).toMatch(/エンジンの形の検査を通りました/));
    const text = checkText(p);
    expect(text).toMatch(/特殊能力を使えるか/);
    expect(text).toMatch(/コインを投げられるか/);
    expect(text).toMatch(/コインを選んで受理されても、コインを投げたとは限りません/);
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o4", "o3"]]);
  });
});
