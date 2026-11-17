// 画面全体での 0.191.0（R-2 のアンノーンの［XXXXX］・［ANGER］: 本人のうらのバトル場のアンノーンのワザの宣言に、自分の場の別のおもての持ち主の力（with_power）を示す）の
// 表示・入力・送信（模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/r2Unown.ts（導入した 0.191.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は次だけで、テストの名前・注記で分ける:
// - 受理の筋書きの送る前のプレイヤー1 の candidates（実応答の本人の candidates を、番でない形にし、coverage は実応答の番でない応答のものに替えた。AppR2WithPower と同じ）
// - log の from に合わせた実応答のページの切り出し（実応答の complete なページから from 以降を返す）
// - ワザごとに違う宣言といっしょに選ぶもの（現登録のアンノーンはワザが 1 つ。エンジンのテストの人工のケースと同じく、ワザを足した応答と、その check の答え）
// 実エンジンとの確かめは server/tests/test_r2_unown.py と e2e/r2-unown.spec.ts。
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, emptyLog, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as T from "./test/r2Unown";

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
// 盤面 r2u_xa: ベンチ 1 = アンノーンA（［ANGER］）、ベンチ 2 = アンノーンX（［XXXXX］）。r2u_baby は逆の並び
const ANGER_1 = new RegExp(`［ANGER\\[アンガー\\]］ — ${KIND}（アンノーンA（プレイヤー0・ベンチ1））`);
const X_2 = new RegExp(`［XXXXX\\[\\?\\?\\?\\?\\?\\]］ — ${KIND}（アンノーンX（プレイヤー0・ベンチ2））`);
const X_1 = new RegExp(`［XXXXX\\[\\?\\?\\?\\?\\?\\]］ — ${KIND}（アンノーンX（プレイヤー0・ベンチ1））`);
const ANGER_2 = new RegExp(`［ANGER\\[アンガー\\]］ — ${KIND}（アンノーンA（プレイヤー0・ベンチ2））`);
const HP = /［めざめるパワー］/;

async function pickAndCheck(user: ReturnType<typeof userEvent.setup>, p: HTMLElement, powers: RegExp[], attack: RegExp = HP) {
  await user.click(within(stageOf(p, 1)).getByRole("radio", { name: attack }));
  for (const h of powers) await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: h }));
  await user.click(within(p).getByRole("button", { name: "入力を検査" }));
  await waitFor(() => expect(within(p).getByRole("status")).toBeInTheDocument());
}

describe("R-2 のアンノーン: うらのバトル場のワザの宣言の［XXXXX］・［ANGER］（実応答）", () => {
  it("2 段目に、エンジンが返した 2 つの力を名前と持ち主の場所で区別して示す。既定は選ばない。未確認・実行を保証しない案内・新しい note をそのまま出す", async () => {
    const { transport } = server(B(T.R2U_XA), "plain");
    const user = await start(transport);
    expect(candidateItem("ワザを使う")).toHaveTextContent("未確認");
    const p = await openAttack(user);
    expect(within(stageOf(p, 1)).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual([expect.stringMatching(HP)]);
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    const boxes = within(stageOf(p, 2)).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((b) => b.closest("label")?.textContent)).toEqual([expect.stringMatching(ANGER_1), expect.stringMatching(X_2)]); // エンジンの並び（場の並び）のまま
    expect(boxes.map((b) => b.checked)).toEqual([false, false]); // 自動で選ばない（0 個でよい）
    for (const b of boxes) expect(b.closest("li")).toHaveTextContent("未確認");
    const note = (T.R2U_XA.inputs.response.stages[1] as { note: string }).note;
    expect(note).toMatch(/ダメージが増えることは保証しない/);
    expect(stageOf(p, 2).textContent).toContain(note); // エンジンの段の note を欠かさずそのまま
    expect(p).toHaveTextContent(/必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます/);
    expect(p.textContent).not.toMatch(/ダメージが増えます|必ず|受理されます/);
  });

  it("力なし: [めざめるパワー] だけを check・送信。力を足さない。結果は応答・観測のまま（ダメージ 10・コインなし）", async () => {
    const { transport } = server(B(T.R2U_XA), "plain");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, []);
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"]]);
    await settle();
    expect(coinRows()).toEqual([]);
    expect(opponentDamage()).toBe("10");
  });

  it("［XXXXX］だけ: その参照値で送る。check の文は特殊能力を使える・効果がはたらく保証でないと示す。コイン 3 枚・ダメージ 30 は応答のまま", async () => {
    const { transport } = server(B(T.R2U_XA), "p2_only");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [X_2]);
    const text = checkText(p);
    expect(text).toMatch(/エンジンの形の検査を通りました/);
    expect(text).toMatch(/特殊能力を使えるか/);
    expect(text).toMatch(/特殊能力を選んで受理されても、その効果がはたらいたとは限りません/);
    expect(text).not.toMatch(/コインを投げられるか/); // コインの選択肢を示していない
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o3"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(3));
    expect(coinRows().map((r) => r.match(/: (おもて|うら)/)?.[1])).toEqual(["おもて", "おもて", "うら"]);
    expect(coinRows().every((r) => /プレイヤー0のコイン（出どころ power）/.test(r))).toBe(true); // 出どころはエンジンの値のまま
    expect(opponentDamage()).toBe("30");
  });

  it("［ANGER］だけ: その参照値で送る。コインなし・ダメージ 30 は応答のまま", async () => {
    const { transport } = server(B(T.R2U_XA), "p1_only");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [ANGER_1]);
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"]]);
    await settle();
    expect(coinRows()).toEqual([]);
    expect(opponentDamage()).toBe("30");
  });

  it("両方: 選んだ順のまま送る（［XXXXX］→［ANGER］・［ANGER］→［XXXXX］）。相手・観戦者にも公開の出来事・観測だけが届く（ダメージ 50）", async () => {
    for (const [name, order, expected] of [
      ["p2_p1", [X_2, ANGER_1], ["o1", "o3", "o2"]],
      ["p1_p2", [ANGER_1, X_2], ["o1", "o2", "o3"]],
    ] as const) {
      const { transport } = server(B(T.R2U_XA), name);
      const user = await start(transport);
      const p = await openAttack(user);
      await pickAndCheck(user, p, [...order]);
      expect(checkText(p)).toMatch(/エンジンの形の検査を通りました/);
      await user.click(within(p).getByRole("button", { name: "送信" }));
      expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
      expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([expected]);
      expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([expected]);
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
      cleanup();
    }
  });

  it("同じ選択肢をもう一度押すと外れる（重なりは通常の操作で作れない）。選択を変えたら前の check を使わない", async () => {
    const { transport } = server(B(T.R2U_XA), "p1_only");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [X_2]);
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    const x = within(stageOf(p, 2)).getByRole("checkbox", { name: X_2 });
    await user.click(x); // 外す
    expect(x).not.toBeChecked();
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(within(p).getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: ANGER_1 }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o3"], ["o1", "o2"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"]]);
  });

  it("XP1: ［XXXXX］つきの送信をエンジンが拒否したことは本人だけに示し、状態は変わらない。［ANGER］へ直して check を取り直すと送れる（自動の再送・選択なし）", async () => {
    const { transport } = server(B(T.R2U_BABY), "p1_only");
    const user = await start(transport);
    const p = await openAttack(user);
    await pickAndCheck(user, p, [X_1]);
    expect(checkText(p)).toMatch(/エンジンの形の検査を通りました/); // 候補・check では除外しない（GUI も予測しない）
    await user.click(within(p).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("拒否（エンジン）: ワザを使う")).toBeInTheDocument();
    expect(viewerArea()).toHaveTextContent("UNRESOLVED_GROUP_POWER_COIN_ORDER");
    expect(viewerArea()).toHaveTextContent(/エンジンが受け付けませんでした（状態は変わりません）/);
    await settle();
    expect(coinRows()).toEqual([]);
    expect(opponentDamage("ピチュー")).toBe("0");
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      expect(viewerArea().textContent).not.toMatch(/UNRESOLVED_GROUP_POWER_COIN_ORDER|拒否（エンジン）|アンノーン\[N\]|PF2-001/); // 本当のカード（うらのまま）。めざめるパワーはベンチの公開のアンノーンの印刷のワザにもあるので使わない
      await waitFor(() => expect(coinPanel()).toHaveTextContent("コインの出来事はまだありません"));
    }
    await showSeat(user, "プレイヤー0");
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1); // 拒否のあとに自動で送り直さない
    const again = await openAttack(user);
    expect(within(again).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(stageOf(again, 1)).getByRole("radio", { name: HP }));
    expect((within(stageOf(again, 2)).getAllByRole("checkbox") as HTMLInputElement[]).map((b) => b.checked)).toEqual([false, false]); // 前の選択を自動で戻さない
    await user.click(within(stageOf(again, 2)).getByRole("checkbox", { name: ANGER_2 }));
    await user.click(within(again).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(again).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"], ["o1", "o3"]]);
    await waitFor(() => expect(coinRows()).toHaveLength(1)); // ベイビィのコイン（エンジンの公開のログのまま）
  });

  it("対照: 自己持ち主・力が無効（かがくへんかガス）では、2 段目に力を出さない（GUI はカード名・能力名・場から補わない）", async () => {
    for (const board of [T.R2U_SELF, T.R2U_GAS]) {
      const { transport } = server(B(board), null);
      const user = await start(transport);
      const p = await openAttack(user);
      await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
      expect(stageOf(p, 2)).toHaveTextContent("宣言といっしょに選べるものはありません");
      expect(within(stageOf(p, 2)).queryByRole("checkbox")).toBeNull();
      expect(stageOf(p, 2).textContent).not.toMatch(/XXXXX|ANGER/);
      await user.click(within(p).getByRole("button", { name: "入力を検査" }));
      await waitFor(() => expect(checkText(p)).toMatch(/ワザの番号が 1 つで、ほかを選ばないことだけ/)); // 0.180.0 からの文のまま
      cleanup();
    }
  });
});

describe("R-2 のアンノーン: ワザごとに違う宣言といっしょに選ぶもの（人工。現登録のアンノーンはワザが 1 つ）", () => {
  /** 人工: 実応答の入力（r2u_xa）の 1 段目に、登録にないワザを 2 つ足した応答。o1 めざめるパワー = 両方、o2 = なし、o3 = ［XXXXX］だけ。
   * 2 段目の選べるものは番号を振り直す（o4 = ［ANGER］、o5 = ［XXXXX］）。エンジンのテストの人工のケース（2 つめのワザの組は空）を広げたもの */
  function artificialInputs() {
    const body = structuredClone(T.R2U_XA.inputs) as unknown as { response: { stages: (Record<string, unknown> & { options: Record<string, unknown>[] })[] } };
    const [first, second] = body.response.stages as [Record<string, unknown> & { options: Record<string, unknown>[] }, Record<string, unknown> & { options: Record<string, unknown>[] }];
    const base = first.options[0]!;
    first.options = [base, { ...base, id: "o2", attack_index: 1, name_ja: "人工のワザA" }, { ...base, id: "o3", attack_index: 2, name_ja: "人工のワザB" }];
    const [anger, x] = second.options as [Record<string, unknown>, Record<string, unknown>];
    second.options = [{ ...anger, id: "o4" }, { ...x, id: "o5" }];
    const pair = (id: string) => ({ option: id, eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] });
    second.options_by_choice = { o1: [pair("o4"), pair("o5")], o2: [], o3: [pair("o5")] };
    return body;
  }
  const valid = (choices: string[]) => ({ choices, body: T.R2U_XA.checks.attack_only.body }); // 人工: 実応答の通る答えを使う

  it("選んだワザの組だけを示し、ワザを変えたら組にない選択を送る入力から外し、前の check を使わない。示されない組を作らない", async () => {
    const { transport } = server(B(T.R2U_XA), null, { inputs: artificialInputs(), checks: [valid(["o1", "o5"]), valid(["o2"]), valid(["o3", "o5"]), valid(["o3"])] });
    const user = await start(transport);
    const p = await openAttack(user);
    const labels = () => (within(stageOf(p, 2)).queryAllByRole("checkbox") as HTMLInputElement[]).map((b) => b.closest("label")?.textContent ?? "");
    // めざめるパワー: 両方
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    expect(labels()).toEqual([expect.stringMatching(ANGER_1), expect.stringMatching(X_2)]);
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: X_2 }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    // 人工のワザA: 組なし。前の選択（o5）を送る入力に残さず、前の check も使わない
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［人工のワザA］/ }));
    expect(labels()).toEqual([]);
    expect(stageOf(p, 2)).toHaveTextContent("このワザといっしょに選べるものはありません");
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    // 人工のワザB: ［XXXXX］だけ（［ANGER］は示さない）。選んでいないものを自動で選ばない
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: /［人工のワザB］/ }));
    expect(labels()).toEqual([expect.stringMatching(X_2)]);
    expect((within(stageOf(p, 2)).getByRole("checkbox", { name: X_2 }) as HTMLInputElement).checked).toBe(false);
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(stageOf(p, 2)).getByRole("checkbox", { name: X_2 }));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(p).getByRole("button", { name: "送信" })).toBeEnabled());
    // めざめるパワーへ戻すと、2 段目は選ばない状態から
    await user.click(within(stageOf(p, 1)).getByRole("radio", { name: HP }));
    expect((within(stageOf(p, 2)).getAllByRole("checkbox") as HTMLInputElement[]).map((b) => b.checked)).toEqual([false, false]);
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    // check に送ったのは、どれも今のワザの組の中だけ（o2 + 力・o3 + ［ANGER］は作らない）
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o1", "o5"], ["o2"], ["o3", "o5"]]);
    expect(ofType(transport, "submit")).toHaveLength(0);
  });
});
