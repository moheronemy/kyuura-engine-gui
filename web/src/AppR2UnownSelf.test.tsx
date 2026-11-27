// 画面全体での 0.192.0（R-2 のアンノーンの自己持ち主: 本人のうらのバトル場のアンノーンX・A のワザの宣言に、使い手自身の［XXXXX］・［ANGER］（with_power。zone が active・
// face_down が true・card_id なし）を示す）の表示・入力・送信（模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/r2UnownSelf.ts（導入した 0.192.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は次だけで、テストの名前・注記で分ける:
// - 受理の筋書きの送る前のプレイヤー1 の candidates（AppR2Unown と同じ。実応答の本人の candidates を番でない形にした）
// - log の from に合わせた実応答のページの切り出し（AppR2Unown と同じ）
// - 同じ力の組の check 拒否のあとの送信: 実応答の「拒否のあと同じ対戦で直した入力」の check・送信・そのあとを、その対戦の最初の送信として使う（画面は拒否された組を送らない）
// - 選べるものの番号を振り直した応答（番号・並びの位置を固定値で読まないことの確かめ）
// 実エンジンとの確かめは server/tests/test_r2_unown_self.py と e2e/r2-unown-self.spec.ts。
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, emptyLog, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as T from "./test/r2UnownSelf";

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
    { id: "PF2-001", name_ja: "アンノーン[N]", category: "pokemon", stage: "basic", hp: 40 },
    { id: "neo4-065", name_ja: "アンノーンX", category: "pokemon", stage: "basic", hp: 50 },
    { id: "neo2-030", name_ja: "アンノーンA", category: "pokemon", stage: "basic", hp: 40 },
    { id: "PMCG1-054", name_ja: "イワーク", category: "pokemon", stage: "basic", hp: 90 },
    { id: "neo1-042", name_ja: "ピチュー", category: "pokemon", stage: "baby", hp: 30 },
    { id: "PMCG1-060", name_ja: "コラッタ", category: "pokemon", stage: "basic", hp: 30 },
    { id: "PMCG3-007", name_ja: "ベトベトン", category: "pokemon", stage: "stage1", hp: 70 },
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

/** 盤面 1 つ・送信の筋書き 1 つの模擬の接続層（AppR2WithPower と同じ）。送ったら実応答の「送ったあと」へ、拒否なら同じ対戦で直した入力の応答へ移る。 */
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
    if (type === "log") return sub ? logPage((after ? after.logAfter : sub.log)[seat]!, c.body?.from) : emptyLog(c);
    if (type === "candidates") {
      if (after) return after.candidatesAfter[seat];
      const own = world.phase === "rejected" ? sub!.retry!.candidates : sub ? sub.candidates : board.candidates;
      if (seat === "0") return own;
      if (sub?.retry) return sub.candidatesAfter[seat]; // 実応答: 拒否は状態を変えないので、拒否のあとのプレイヤー1 の candidates は送る前と同じ局面
      const notActor = (sub?.candidatesAfter["0"] as { response: { coverage: unknown } } | undefined)?.response.coverage;
      return { ...own, response: { ...own.response, actor: 1, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [], coverage: notActor } }; // 人工
    }
    if (type === "inputs") return override?.inputs ?? (world.phase === "rejected" ? sub!.retry!.inputs : sub ? sub.inputs : board.inputs);
    const choices = c.body?.choices as string[] | undefined;
    if (type === "check") {
      if (world.phase === "rejected" && sub!.retry && same(choices, sub!.retry.choices)) return sub!.retry.check;
      const found = [...(override?.checks ?? []), ...(override?.inputs ? [] : Object.values(board.checks))].find((x) => same(choices, x.choices));
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
/** 相手（プレイヤー1）のバトル場のポケモンのダメージ（観測の値のまま）。 */
const opponentDamage = (name = "イワーク") => {
  const card = within(viewerArea()).getByRole("article", { name: new RegExp(`バトル場: ${name}`) });
  const stats = within(card).getByLabelText("今の状態（観測の値）");
  return [...stats.querySelectorAll("div")].find((d) => d.querySelector("dt")?.textContent === "ダメージ")?.querySelector("dd")?.textContent;
};
const KIND = "自分の場のポケモンの、ワザといっしょに使う特殊能力";
const X = "［XXXXX\\[\\?\\?\\?\\?\\?\\]］";
const A = "［ANGER\\[アンガー\\]］";
// 自己持ち主: 公開の観測の場（バトル場・裏向き）と力の名前だけ。本当のカード（アンノーンX・A）の名前・ID は書かない
const SELF_X = new RegExp(`${X} — ${KIND}（裏向きのポケモン（プレイヤー0・バトル場））`);
const SELF_A = new RegExp(`${A} — ${KIND}（裏向きのポケモン（プレイヤー0・バトル場））`);
// 盤面 r2us_x_ax・r2us_a_ax: ベンチ 1 = アンノーンA（［ANGER］）、ベンチ 2 = アンノーンX（［XXXXX］）
const BENCH_A = new RegExp(`${A} — ${KIND}（アンノーンA（プレイヤー0・ベンチ1））`);
const BENCH_X = new RegExp(`${X} — ${KIND}（アンノーンX（プレイヤー0・ベンチ2））`);
const HP = /［めざめるパワー］/;
/** 2 段目の力の選べるもの（3 つなら checkbox、1 つなら「選ばない」と並ぶ radio。どちらも既存の画面の出し方）。「選ばない」は含めない。 */
const powerInputs = (p: HTMLElement) =>
  ([...stageOf(p, 2).querySelectorAll("input[type=checkbox], input[type=radio]")] as HTMLInputElement[]).filter((b) => b.closest("label")?.textContent !== "選ばない");
const labels = (p: HTMLElement) => powerInputs(p).map((b) => b.closest("label")?.textContent ?? "");
const powerInput = (p: HTMLElement, name: RegExp) => within(stageOf(p, 2)).queryByRole("checkbox", { name }) ?? within(stageOf(p, 2)).getByRole("radio", { name });

async function pickAndCheck(user: ReturnType<typeof userEvent.setup>, p: HTMLElement, powers: RegExp[]) {
  await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
  for (const h of powers) await user.click(powerInput(p, h));
  await user.click(within(p).getByRole("button", { name: "入力を検査" }));
  await waitFor(() => expect(within(p).getByRole("status")).toBeInTheDocument());
}

/** 人工: 実応答の「拒否のあと同じ対戦で直した入力」の check・送信・そのあとを、その対戦の最初の送信の筋書きにする（送る前の view・log・入力は実応答の同じ対戦のもの）。 */
function retryAsFirst(sub: Submit): Submit {
  const r = sub.retry!;
  return { ...sub, choices: r.choices, submit: r.submit, viewsAfter: r.viewsAfter, logAfter: r.logAfter, candidatesAfter: r.candidatesAfter, retry: undefined };
}

describe("R-2 のアンノーンの自己持ち主: うらのバトル場の使い手自身の［XXXXX］・［ANGER］（実応答）", () => {
  it("自己持ち主を先頭に、バトル場・裏向き・力の名前で別の持ち主と区別して示す（エンジンの並びのまま・既定は選ばない・未確認・本当のカードの名前を補わない）", async () => {
    const { transport } = server(B(T.R2US_X_AX), null);
    const user = await start(transport);
    expect(candidateItem("ワザを使う")).toHaveTextContent("未確認");
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    expect(labels(p)).toEqual([expect.stringMatching(SELF_X), expect.stringMatching(BENCH_A), expect.stringMatching(BENCH_X)]);
    const boxes = powerInputs(p);
    expect(boxes.map((b) => b.checked)).toEqual([false, false, false]); // 任意（自動で選ばない）
    for (const b of boxes) expect(b.closest("li")).toHaveTextContent("未確認");
    const self = boxes[0]!.closest("li")!;
    expect(self.textContent).not.toMatch(/アンノーン|neo4-065|ポケモン番号/); // card_id・カード名を、本人の real・既知のデッキ・番号から補わない
    const note = (T.R2US_X_AX.inputs.response.stages[1] as { note: string }).note;
    expect(note).toMatch(/使い手自身の力を先に示す/);
    expect(stageOf(p, 2).textContent).toContain(note); // エンジンの段の note をそのまま
    expect(p.textContent).not.toMatch(/ダメージが増えます|必ず|受理されます/);
  });

  it("自己［ANGER］も示す（GUI は効果 0 を判定して隠さない）。選んで送ると、結果は応答・観測のまま（コインなし・ダメージ 10）", async () => {
    const { transport } = server(B(T.R2US_A), "p1_only");
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    expect(labels(p)).toEqual([expect.stringMatching(SELF_A)]);
    expect(powerInputs(p).map((b) => b.checked)).toEqual([false]); // 任意（自動で選ばない）
    expect(stageOf(p, 2).textContent).not.toMatch(/アンノーン|neo2-030/);
    await user.click(powerInput(p, SELF_A));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(checkText(p)).toMatch(/特殊能力を選んで受理されても、その効果がはたらいたとは限りません/));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"]]);
    await settle();
    expect(coinRows()).toEqual([]);
    expect(opponentDamage()).toBe("10");
  });

  it("力なし・自己［XXXXX］: エンジンが返した参照のまま送る。自己［XXXXX］はコイン 3 枚・ダメージ 30（応答のまま）、力なしは 10", async () => {
    for (const [name, picks, expected, damage, coins] of [
      ["plain", [], ["o1"], "10", 0],
      ["p1_only", [SELF_X], ["o1", "o2"], "30", 3],
    ] as const) {
      const { transport } = server(B(T.R2US_X), name);
      const user = await start(transport);
      const p = await openAttack(user);
      await pickAndCheck(user, p, [...picks]);
      expect(checkText(p)).toMatch(/エンジンの形の検査を通りました/);
      await user.click(within(p).getByRole("button", { name: "送信" }));
      expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
      expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([expected]);
      expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([expected]);
      await waitFor(() => expect(coinRows()).toHaveLength(coins));
      if (coins) expect(coinRows().map((r) => r.match(/: (おもて|うら)/)?.[1])).toEqual(["おもて", "おもて", "うら"]);
      expect(opponentDamage()).toBe(damage);
      cleanup();
    }
  });

  it("自己［XXXXX］＋別の持ち主の［ANGER］: 選んだ順のまま送る。相手・観戦者にも公開の出来事・観測だけが届く（ダメージ 50）", async () => {
    const { transport } = server(B(T.R2US_X_AX), "p1_p2");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [SELF_X, BENCH_A]);
    expect(checkText(p)).toMatch(/同じ特殊能力を 2 つ選んでいないことだけ/);
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2", "o3"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(3));
    expect(opponentDamage()).toBe("50");
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      await waitFor(() => expect(coinRows()).toHaveLength(3));
      expect(opponentDamage()).toBe("50");
      expect(within(viewerArea()).queryByText(/受理.*ワザを使う/)).toBeNull();
    }
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1); // 自動の再送なし
  });

  it("同じ力の組（自己 X ＋ 別の X・自己 A ＋ 別の A）は check の拒否を示して送信できない。1 つに直して check を取り直すと送れる", async () => {
    for (const [board, name, same, self, sentFirst, damage] of [
      [T.R2US_X_AX, "p1_p3", BENCH_X, SELF_X, ["o1", "o2", "o4"], "30"],
      [T.R2US_A_AX, "p1_p2", BENCH_A, SELF_A, ["o1", "o2", "o3"], "10"],
    ] as const) {
      const real = B(board);
      const { transport } = server({ ...real, submits: { [name]: retryAsFirst(real.submits[name]!) } }, name);
      const user = await start(transport);
      const p = await openAttack(user);
      await pickAndCheck(user, p, [self, same]);
      await waitFor(() => expect(within(p).getByRole("status")).toHaveTextContent("CANDIDATE_INPUT_INVALID"));
      const send = within(p).getByRole("button", { name: "送信" });
      expect(send).toBeDisabled();
      await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: same })); // 外す（同じ選択肢をもう一度押すと外れる）
      expect(within(stageOf(p, 2)).getByRole("checkbox", { name: same })).not.toBeChecked();
      expect(within(stageOf(p, 2)).getByRole("checkbox", { name: self })).toBeChecked(); // ほかの選択は自動で変えない
      expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
      await user.click(within(p).getByRole("button", { name: "入力を検査" }));
      await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
      await user.click(within(p).getByRole("button", { name: "送信" }));
      expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
      expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([[...sentFirst], ["o1", "o2"]]);
      expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"]]); // 拒否された組は送らない
      await settle();
      expect(opponentDamage()).toBe(damage);
      cleanup();
    }
  });

  it("選択を変えたら前の check を使わない（自己持ち主を足す・外す）", async () => {
    const { transport } = server(B(T.R2US_X_AX), null);
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [BENCH_A]);
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: SELF_X }));
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(within(p).getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: SELF_X })); // 外す
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o3"], ["o1", "o3", "o2"]]); // 選んだ順
    expect(ofType(transport, "submit")).toHaveLength(0);
  });

  it("XP1: 自己［XXXXX］つきの送信の拒否は本人だけに示し、状態は変わらない。力を外して check を取り直すと送れる（自動の再送・選択なし）", async () => {
    const { transport } = server(B(T.R2US_BABY), "p1_only");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [SELF_X]);
    expect(checkText(p)).toMatch(/エンジンの形の検査を通りました/); // 候補・check では除外しない（GUI も予測しない）
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("拒否（エンジン）: ワザを使う")).toBeInTheDocument();
    expect(viewerArea()).toHaveTextContent("UNRESOLVED_GROUP_POWER_COIN_ORDER");
    await settle();
    expect(coinRows()).toEqual([]);
    expect(opponentDamage("ピチュー")).toBe("0");
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      expect(viewerArea().textContent).not.toMatch(/UNRESOLVED_GROUP_POWER_COIN_ORDER|拒否（エンジン）|アンノーンX|neo4-065|XXXXX/); // 本当のカード・診断・力の名前は届かない
      await waitFor(() => expect(coinPanel()).toHaveTextContent("コインの出来事はまだありません"));
    }
    await showSeat(user, "プレイヤー0");
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1); // 自動で送り直さない
    const again = await openAttack(user);
    await user.click(within(stageOf(again, 1)).getByRole("radio", { name: HP }));
    expect(powerInputs(again).map((b) => b.checked)).toEqual([false]); // 前の選択を自動で戻さない
    expect(within(again).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(powerInput(again, SELF_X));
    await user.click(within(stageOf(again, 2)).getByRole("radio", { name: "選ばない" })); // 力を外す
    expect(powerInputs(again).map((b) => b.checked)).toEqual([false]);
    await user.click(within(again).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(again).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"], ["o1"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(1)); // ベイビィのコイン（エンジンの公開のログのまま）
  });

  it("対照: 力が無効（かがくへんかガス）では、2 段目に力を出さない（GUI はカード名・能力名・場から補わない）", async () => {
    const { transport } = server(B(T.R2US_GAS), null);
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    expect(stageOf(p, 2)).toHaveTextContent("宣言といっしょに選べるものはありません");
    expect(within(stageOf(p, 2)).queryByRole("checkbox")).toBeNull();
    expect(stageOf(p, 2).textContent).not.toMatch(/XXXXX|ANGER/);
  });
});

describe("R-2 のアンノーンの自己持ち主: 選べるものの番号を固定値で読まない（人工）", () => {
  /** 人工: 実応答（r2us_x_ax）の 2 段目の選べるものの番号を振り直した応答（並びはエンジンのまま: 自己 X → ベンチの A → ベンチの X）。 */
  function renumbered() {
    const body = structuredClone(T.R2US_X_AX.inputs) as unknown as { response: { stages: (Record<string, unknown> & { options: Record<string, unknown>[] })[] } };
    const second = body.response.stages[1]!;
    const ids = ["o9", "o7", "o8"];
    second.options = second.options.map((o, i) => ({ ...o, id: ids[i] }));
    const pair = (id: string) => ({ option: id, eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] });
    second.options_by_choice = { o1: ids.map(pair) };
    return body;
  }
  const valid = (choices: string[]) => ({ choices, body: T.R2US_X_AX.checks.attack_only.body }); // 人工: 実応答の通る答えを使う

  it("表示の並びはエンジンの並びのまま、送る値はエンジンが返した id のまま", async () => {
    const { transport } = server(B(T.R2US_X_AX), null, { inputs: renumbered(), checks: [valid(["o1", "o7", "o9"])] });
    const user = await start(transport);
    const p = await openAttack(user);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    expect(labels(p)).toEqual([expect.stringMatching(SELF_X), expect.stringMatching(BENCH_A), expect.stringMatching(BENCH_X)]);
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: BENCH_A }));
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: SELF_X }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o7", "o9"]]);
  });
});
