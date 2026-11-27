// 画面全体での 0.193.0（C-TF1: 変身で写した、ワザといっしょに宣言する特殊能力を、おもての 2 段目に示さない）と 0.194.0（C-TF2 に関係する既存の操作: おもてのメタモンの
// きつねび → 交代の決定 → 回答 → 攻撃の結果）、うらのメタモンの no_printed_attack の保留の表示・入力・送信（模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/transformTf.ts（導入した 0.194.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は次だけで、テストの名前・注記で分ける:
// - 送る前のプレイヤー1 の candidates（AppR2UnownSelf と同じ。実応答の本人の candidates を番でない形にした）
// - log の from に合わせた実応答のページの切り出し（AppR2UnownSelf と同じ）
// 欠番の選択肢 id の送信（人工の入力）は、通常の画面で作れないので、接続層のテスト（server/tests/test_transform_tf.py）で確かめる。
// GUI はカード別の除外判定を持たない（写した力を示さないのはエンジン。画面は応答のまま）。ダメージは観測の値のまま（GUI は計算しない）。
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, emptyLog, mockRenderer, mockTransport, type Call } from "./test/fixtures";
import * as T from "./test/transformTf";

type Seat = "0" | "1" | "spectator" | "host";
type Page = { entries: { segment: number; log_index: number; event: Record<string, unknown> }[]; next: unknown; end: unknown; complete: boolean };
type Decision = {
  views: Record<Seat, unknown>;
  log: Record<string, readonly Page[]>;
  candidates: Record<string, unknown>;
  inputs: unknown;
  choices: readonly string[];
  check: unknown;
  submit: unknown;
};
type Submit = {
  choices: readonly string[];
  views: Record<Seat, unknown>;
  log: Record<string, readonly Page[]>;
  candidates: { response: Record<string, unknown> };
  inputs: unknown;
  submit: unknown;
  viewsAfter: Record<Seat, unknown>;
  logAfter: Record<string, readonly Page[]>;
  candidatesAfter: Record<string, unknown>;
  decision?: Decision;
};
type Board = {
  views: Record<Seat, unknown>;
  candidates: { response: Record<string, unknown> };
  inputs: unknown;
  checks?: Record<string, { choices: readonly string[]; body: unknown }>;
  submits?: Record<string, Submit>;
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
    { id: "PMCG3-042", name_ja: "メタモン", category: "pokemon", stage: "basic", hp: 50 },
    { id: "neo4-065", name_ja: "アンノーンX", category: "pokemon", stage: "basic", hp: 50 },
    { id: "neo2-030", name_ja: "アンノーンA", category: "pokemon", stage: "basic", hp: 40 },
    { id: "neo1-040", name_ja: "ランターン", category: "pokemon", stage: "stage1", hp: 80 },
    { id: "neo1-037", name_ja: "チョンチー", category: "pokemon", stage: "basic", hp: 50 },
    { id: "PMCG1-054", name_ja: "イワーク", category: "pokemon", stage: "basic", hp: 90 },
    { id: "ES3-009", name_ja: "ロコン", category: "pokemon", stage: "basic", hp: 50 },
    { id: "PMCG1-001", name_ja: "フシギダネ", category: "pokemon", stage: "basic", hp: 40 },
    { id: "PMCG1-023", name_ja: "ゼニガメ", category: "pokemon", stage: "basic", hp: 40 },
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

/** 盤面 1 つ・送信の筋書き 1 つの模擬の接続層。ワザを送ったら（決定があれば）実応答の「決定を待つあいだ」へ、回答を送ったら「送ったあと」へ移る。 */
function server(board: Board, name: string | null) {
  const sub = name === null ? null : board.submits![name]!;
  const world = { phase: "before" as "before" | "pending" | "after" };
  const transport = mockTransport((c) => {
    if (c.path === "/api/cards") return CATALOG;
    const common = c.body?.type === "log" ? undefined : commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const seat = SEAT_OF[tokenOf(c)]!;
    const dec = sub?.decision;
    if (type === "view") return (world.phase === "after" ? sub!.viewsAfter : world.phase === "pending" ? dec!.views : sub ? sub.views : board.views)[seat];
    if (type === "log") {
      if (!sub) return emptyLog(c);
      return logPage((world.phase === "after" ? sub.logAfter : world.phase === "pending" ? dec!.log : sub.log)[seat]!, c.body?.from);
    }
    if (type === "candidates") {
      if (world.phase === "after") return sub!.candidatesAfter[seat];
      if (world.phase === "pending") return dec!.candidates[seat];
      const own = sub ? sub.candidates : board.candidates;
      if (seat === "0") return own;
      const notActor = (sub?.candidatesAfter["0"] as { response: { coverage: unknown } } | undefined)?.response.coverage;
      return { ...own, response: { ...own.response, actor: 1, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [], coverage: notActor } }; // 人工
    }
    if (type === "inputs") return world.phase === "pending" ? dec!.inputs : sub ? sub.inputs : board.inputs;
    const choices = c.body?.choices as string[] | undefined;
    if (type === "check") {
      if (world.phase === "pending" && same(choices, dec!.choices)) return dec!.check;
      const found = Object.values(board.checks ?? {}).find((x) => same(choices, x.choices));
      if (world.phase === "before" && found) return found.body;
    }
    if (type === "submit" && sub) {
      if (world.phase === "before" && same(choices, sub.choices)) {
        world.phase = dec ? "pending" : "after";
        return sub.submit;
      }
      if (world.phase === "pending" && same(choices, dec!.choices)) {
        world.phase = "after";
        return dec!.submit;
      }
    }
    throw new Error(`想定外 ${c.path} ${String(type)} ${JSON.stringify(choices)} (${world.phase})`);
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
async function openKind(user: ReturnType<typeof userEvent.setup>, label: string, stages: number) {
  await user.click(within(await waitFor(() => candidateItem(label))).getByRole("button", { name: "この操作を選ぶ" }));
  const p = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  await waitFor(() => expect(p.querySelectorAll("fieldset.stage").length).toBe(stages));
  return p;
}
const stageOf = (p: HTMLElement, n: number) => p.querySelectorAll("fieldset.stage")[n - 1] as HTMLElement;
async function showSeat(user: ReturnType<typeof userEvent.setup>, seat: string) {
  await user.click(screen.getByRole("radio", { name: seat }));
  await within(viewerArea()).findByRole("region", { name: "対戦の状態" });
  await settle();
}
const ofType = (t: ReturnType<typeof mockTransport>, type: string) => t.calls.filter((c) => c.body?.type === type);
const checkText = (p: HTMLElement) => within(p).getByRole("status").textContent ?? "";
/** 相手（プレイヤー1）のバトル場のポケモンのダメージ（観測の値のまま）。 */
const opponentDamage = (name: string) => {
  const card = within(viewerArea()).getByRole("article", { name: new RegExp(`バトル場: ${name}`) });
  const stats = within(card).getByLabelText("今の状態（観測の値）");
  return [...stats.querySelectorAll("div")].find((d) => d.querySelector("dt")?.textContent === "ダメージ")?.querySelector("dd")?.textContent;
};
const KIND = "自分の場のポケモンの、ワザといっしょに使う特殊能力";
const X = "［XXXXX\\[\\?\\?\\?\\?\\?\\]］";
const A = "［ANGER\\[アンガー\\]］";
const BENCH_A = new RegExp(`${A} — ${KIND}（アンノーンA（プレイヤー0・ベンチ1））`);
/** 2 段目の力の選べるもの（「選ばない」は含めない）。 */
const powerInputs = (p: HTMLElement) =>
  ([...stageOf(p, 2).querySelectorAll("input[type=checkbox], input[type=radio]")] as HTMLInputElement[]).filter((b) => b.closest("label")?.textContent !== "選ばない");
const labels = (p: HTMLElement) => powerInputs(p).map((b) => b.closest("label")?.textContent ?? "");
const firstAttack = (p: HTMLElement) => within(stageOf(p, 1)).getAllByRole("radio")[0]!;

describe("C-TF1: 変身で写した、ワザといっしょに宣言する特殊能力（実応答）", () => {
  it("おもてのメタモンが写した［XXXXX］は 2 段目に出ず、別の持ち主（ベンチのアンノーンA）の［ANGER］はエンジンの id のまま示す（既定は選ばない・未確認）", async () => {
    const { transport } = server(B(T.TF1_COPY_X), null);
    const user = await start(transport);
    const p = await openKind(user, "ワザを使う", 2);
    await user.click(firstAttack(p));
    expect(labels(p)).toEqual([expect.stringMatching(BENCH_A)]);
    expect(stageOf(p, 2).textContent).not.toMatch(/XXXXX|メタモン（プレイヤー0・バトル場）/); // 写した力・使い手自身を GUI で補わない
    expect(powerInputs(p).map((b) => b.checked)).toEqual([false]); // 任意（自動で選ばない）
    expect(within(stageOf(p, 2)).getByRole("radio", { name: "選ばない" })).toBeChecked();
    expect(stageOf(p, 2).textContent).toContain("o3"); // エンジンの id のまま（欠番を詰めない）
    expect(stageOf(p, 2).textContent).not.toMatch(/\bo2\b/);
  });

  it("別の持ち主の［ANGER］を選んで送ると、エンジンが返した id のまま送り、結果は観測のまま（ダメージ 20）。力なしも 20", async () => {
    for (const [name, pick, expected] of [
      ["p1_only", true, ["o1", "o3"]],
      ["plain", false, ["o1"]],
    ] as const) {
      const { transport } = server(B(T.TF1_COPY_X), name);
      const user = await start(transport);
      const p = await openKind(user, "ワザを使う", 2);
      await user.click(firstAttack(p));
      if (pick) await user.click(within(stageOf(p, 2)).getByRole("radio", { name: BENCH_A }));
      await user.click(within(p).getByRole("button", { name: "入力を検査" }));
      await waitFor(() => expect(checkText(p)).toMatch(/エンジンの検査を通りました（受理・完走の保証ではありません/));
      await user.click(within(p).getByRole("button", { name: "送信" }));
      expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
      expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([expected]);
      expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([expected]);
      await settle();
      expect(opponentDamage("アンノーンX")).toBe("20");
      cleanup();
    }
  });

  it("おもてのメタモンが写した［すいりょくはつでん］は 2 段目に出ない（選べるものなし）。写したワザだけを送れる（ダメージ 20）", async () => {
    const { transport } = server(B(T.TF1_COPY_LANTURN), "plain");
    const user = await start(transport);
    const p = await openKind(user, "ワザを使う", 2);
    await user.click(firstAttack(p));
    expect(stageOf(p, 2)).toHaveTextContent("宣言といっしょに選べるものはありません");
    expect(powerInputs(p)).toEqual([]);
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"]]);
    await settle();
    expect(opponentDamage("ランターン")).toBe("20");
  });

  it("対照: 本来の持ち主（おもてのアンノーンX・ランターン）は、使い手自身の力を今までどおり示し、送れる（ダメージ 30）", async () => {
    for (const [board, name, sent, opponent, count] of [
      [T.TF1_ORIG_X, "p1_p2", ["o1", "o2", "o3"], "イワーク", 2],
      [T.TF1_ORIG_LANTURN, "p1_only", ["o1", "o2"], "イワーク", 1],
    ] as const) {
      const { transport } = server(B(board), name);
      const user = await start(transport);
      const p = await openKind(user, "ワザを使う", 2);
      await user.click(firstAttack(p));
      expect(powerInputs(p)).toHaveLength(count);
      expect(powerInputs(p).map((b) => b.checked)).toEqual(Array(count).fill(false));
      for (const b of powerInputs(p)) await user.click(b);
      await user.click(within(p).getByRole("button", { name: "入力を検査" }));
      await user.click(await within(p).findByRole("button", { name: "送信" }));
      expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
      expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([[...sent]]);
      await settle();
      expect(opponentDamage(opponent)).toBe("30");
      cleanup();
    }
  });
});

describe("C-TF2 に関係する既存の操作: おもてのメタモンのきつねび → 交代の決定 → 回答 → 結果（実応答）", () => {
  it("ワザを送ると決定（forced_switch）を示し、回答をエンジンの id のまま送る。交代後の結果は観測のまま（フシギダネにダメージ 20）。相手・観戦者にも同じ観測", async () => {
    const real = B(T.TF2_VULPIX_UP);
    const { transport, world } = server(real, "answer_bulbasaur");
    const user = await start(transport);
    const p = await openKind(user, "ワザを使う", 2);
    await user.click(firstAttack(p));
    expect(stageOf(p, 2)).toHaveTextContent("宣言といっしょに選べるものはありません");
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*ワザを使う/)).toBeInTheDocument();
    await waitFor(() => expect(world.phase).toBe("pending"));
    const d = await openKind(user, "決定に答える", 1);
    expect(stageOf(d, 1)).toHaveTextContent("forced_switch");
    const options = within(stageOf(d, 1)).getAllByRole("radio");
    expect(options.map((o) => o.closest("label")?.textContent)).toEqual([
      "選ばない",
      expect.stringMatching(/フシギダネ（プレイヤー1・ベンチ1）/),
      expect.stringMatching(/ゼニガメ（プレイヤー1・ベンチ2）/),
    ]);
    expect(options[0]).toBeChecked(); // 自動で選ばない（決定への回答は check_before_submit_kinds にない既存の扱いのまま。送るのは利用者の操作だけ）
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1); // 決定を示しても自動で答えない
    await user.click(options[1]!);
    await user.click(within(d).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(d).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*決定に答える/)).toBeInTheDocument();
    const dec = real.submits!.answer_bulbasaur!.decision!;
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"], [...dec.choices]]);
    await settle();
    expect(opponentDamage("フシギダネ")).toBe("20");
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await showSeat(user, seat);
      expect(opponentDamage("フシギダネ")).toBe("20");
      expect(within(viewerArea()).queryByText(/受理.*決定に答える/)).toBeNull();
    }
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(2); // 自動の再送なし
  });

  it("入れ替えないことも選べる（選ばないのまま送る）。結果は観測のまま（ロコンにダメージ 10）", async () => {
    const { transport, world } = server(B(T.TF2_VULPIX_UP), "answer_none");
    const user = await start(transport);
    const p = await openKind(user, "ワザを使う", 2);
    await user.click(firstAttack(p));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    await waitFor(() => expect(world.phase).toBe("pending"));
    const d = await openKind(user, "決定に答える", 1);
    expect(stageOf(d, 1)).toHaveTextContent("辞退できます");
    await user.click(within(d).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(d).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理.*決定に答える/)).toBeInTheDocument();
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o1"], []]);
    await settle();
    expect(opponentDamage("ロコン")).toBe("10");
  });

  it("決定を待つあいだ、相手（プレイヤー1）には回答の候補を出さない（実応答の candidates のまま）", async () => {
    const { transport, world } = server(B(T.TF2_VULPIX_UP), "answer_bulbasaur");
    const user = await start(transport);
    const p = await openKind(user, "ワザを使う", 2);
    await user.click(firstAttack(p));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(p).findByRole("button", { name: "送信" }));
    await waitFor(() => expect(world.phase).toBe("pending"));
    await waitFor(() => candidateItem("決定に答える"));
    await showSeat(user, "プレイヤー1");
    expect(() => candidateItem("決定に答える")).toThrow();
  });
});

describe("うらのメタモン: no_printed_attack の保留（実応答）", () => {
  it("ワザの候補は今の区分（未実装）のまま示し、変身のあとのワザ・2 段目を GUI で補わない。開いても段はなく、送信できない", async () => {
    const { transport } = server(B(T.TF2_VULPIX_FD), null);
    const user = await start(transport);
    const item = await waitFor(() => candidateItem("ワザを使う"));
    expect(item.textContent).not.toMatch(/きつねび|ロコン|へんしん/);
    await user.click(within(item).getByRole("button", { name: "この操作を選ぶ" }));
    const p = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await settle();
    expect(p.querySelectorAll("fieldset.stage")).toHaveLength(0); // エンジンの stages は []
    expect(p.textContent).not.toMatch(/きつねび|ロコン|へんしん/);
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled(); // 実行できる区分でない（既存の扱い）
    expect(ofType(transport, "inputs")).toHaveLength(1);
    expect(ofType(transport, "submit")).toHaveLength(0);
  });
});
