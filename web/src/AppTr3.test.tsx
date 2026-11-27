// 画面全体での 0.186.0（開発用の規約集合 CS-KYUURA-PLAY-TR3@1）の明示選択と、規約による使用不可の表示・送信の制御（模擬の接続層・模擬の描画）。
// 出典: 「実応答」は test/tr3.ts（導入した 0.186.0 の接続層の HTTP の口の応答そのまま。構築盤面。new_game からではない）。
// 「人工」は、作成の要求と別の盤面の応答の組み合わせ（接続後の表示が画面の選択値でなく対戦の状態の値であることの確かめ）と、送信の拒否の応答の差しかえ（実応答の拒否を写した）。
// 実エンジンとの確かめは server/tests/test_tr3.py と e2e/tr3.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { commonRoutes, mockRenderer, mockTransport, PRESETS, type Call } from "./test/fixtures";
import * as T from "./test/tr3";

type Seat = "0" | "1" | "spectator" | "host";
type Board = {
  views: Record<Seat, unknown>;
  candidates: { response: Record<string, unknown> };
  inputs: unknown;
  checks: Record<string, unknown>;
  refusedSubmits: Record<string, unknown>;
  accepted?: { option: string; submit: unknown; candidatesAfter: unknown; viewsAfter: Record<Seat, unknown> };
};
const B = (b: unknown) => b as Board;
const SEAT_OF: Record<string, Seat> = { tok0: "0", tok1: "1", tokS: "spectator", tokH: "host" };
const tokenOf = (c: Call) => c.path.split("/")[3]!;
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const CATALOG = {
  gui_server: 1,
  ok: true,
  cards: [
    { id: "PMCG1-072", name_ja: "突風", category: "trainer", stage: null, hp: null },
    { id: "PMCG1-073", name_ja: "ポケモンいれかえ", category: "trainer", stage: null, hp: null },
    { id: "PMCG1-071", name_ja: "きずぐすり", category: "trainer", stage: null, hp: null },
    { id: "PMCG1-018", name_ja: "ガーディ", category: "pokemon", stage: "basic", hp: 60 },
  ],
};

function server(board: Board, override: (c: Call) => unknown = () => undefined) {
  const world = { accepted: false };
  const transport = mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    if (c.path === "/api/cards") return CATALOG;
    if (c.path === "/api/decks/presets") return { ...PRESETS, convention_sets: T.NEW_GAME.conventionSets };
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const seat = SEAT_OF[tokenOf(c)]!;
    if (type === "view") return (world.accepted ? board.accepted!.viewsAfter : board.views)[seat];
    if (type === "candidates") {
      const own = (world.accepted ? board.accepted!.candidatesAfter : board.candidates) as { response: Record<string, unknown> };
      if (seat === "0") return own;
      return { ...own, response: { ...own.response, actor: seat === "1" ? 1 : null, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [] } };
    }
    if (type === "inputs") return board.inputs;
    const choice = (c.body?.choices as string[] | undefined)?.[0] ?? "";
    if (type === "check") return board.checks[choice];
    if (type === "submit") {
      if (board.refusedSubmits[choice]) return board.refusedSubmits[choice];
      if (board.accepted && choice === board.accepted.option) {
        world.accepted = true;
        return board.accepted.submit;
      }
    }
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
  return { transport, world };
}

async function start(transport: ReturnType<typeof mockTransport>, conventions?: string) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mockRenderer().renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  const select = screen.getByLabelText("規約集合（任意）") as HTMLSelectElement;
  await waitFor(() => expect(select.options.length).toBe(1 + T.NEW_GAME.conventionSets.length));
  if (conventions !== undefined) await user.selectOptions(select, conventions);
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
async function openTrainer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(await waitFor(() => candidateItem("手札のトレーナーを使う"))).getByRole("button", { name: "この操作を選ぶ" }));
  const p = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  await waitFor(() => expect(p.querySelectorAll("fieldset.stage").length).toBe(1));
  return p;
}
const optionItem = (p: HTMLElement, name: string) => within(p).getAllByRole("listitem").find((li) => li.querySelector("label.option")?.textContent?.includes(name))!;
async function showSeat(user: ReturnType<typeof userEvent.setup>, seat: string) {
  await user.click(screen.getByRole("radio", { name: seat }));
  await within(viewerArea()).findByRole("region", { name: "対戦の状態" });
  await settle();
}
const ofType = (t: ReturnType<typeof mockTransport>, type: string) => t.calls.filter((c) => c.body?.type === type);
const created = (t: ReturnType<typeof mockTransport>) => t.calls.filter((c) => c.path === "/api/local-match").map((c) => c.body);
const statusSet = () => within(viewerArea()).getByRole("region", { name: "対戦の状態" });

describe("TR3 の明示選択（作成の画面）", () => {
  it("既定は省略のまま（conventions を送らない）。一覧の TR3 に説明が付き、選んだときだけ PO の規約を含む集合だと説明する", async () => {
    const { transport } = server(B(T.CUR_GUST));
    const user = userEvent.setup();
    render(<App transport={transport} cardRenderer={mockRenderer().renderer} />);
    const select = (await screen.findByLabelText("規約集合（任意）")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(4));
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "CS-KYUURA-PLAY-S2A@1", "CS-KYUURA-PLAY-PO@1", "CS-KYUURA-PLAY-TR3@1"]);
    expect(select.options[3]!.textContent).toBe("CS-KYUURA-PLAY-TR3@1（対象がない突風・ポケモンいれかえ・きずぐすりを使用不可とするプレイ用規約）");
    expect(screen.queryByText(/20 規約/)).toBeNull();
    await user.selectOptions(select, "CS-KYUURA-PLAY-TR3@1");
    const desc = screen.getByText(/20 規約/);
    expect(desc.textContent).toMatch(/CS-KYUURA-PLAY-PO@1 の 20 規約に、この 3 件/);
    expect(desc.textContent).toMatch(/この 3 件だけの集合ではありません/);
    expect(desc.textContent).toMatch(/史実の裁定が確定したものではありません/);
    expect(desc.textContent).not.toMatch(/裁定が確定しました|公式の裁定です/);
    await user.selectOptions(select, "");
    expect(screen.queryByText(/20 規約/)).toBeNull();
    await user.click(screen.getByRole("button", { name: /対戦を作成/ }));
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    expect(created(transport)).toHaveLength(1);
    expect(created(transport)[0]).not.toHaveProperty("conventions"); // 既定は変えない（省略のまま）
    // 接続後は対戦の状態の集合（実応答: 既定の CURRENT）
    await waitFor(() => expect(statusSet().textContent).toMatch(/CS-KYUURA-CURRENT@1/));
    expect(statusSet().textContent).not.toMatch(/TR3/);
  });

  it("TR3 を選んだ対戦だけ、要求の conventions がその値そのまま。接続後の表示は対戦の状態の集合（実応答: TR3）と説明", async () => {
    const { transport } = server(B(T.TR3_GUST));
    await start(transport, "CS-KYUURA-PLAY-TR3@1");
    expect(created(transport)).toEqual([expect.objectContaining({ mode: "decks", conventions: "CS-KYUURA-PLAY-TR3@1" })]);
    await waitFor(() => expect(statusSet().textContent).toMatch(/CS-KYUURA-PLAY-TR3@1/));
    expect(statusSet().textContent).toMatch(/対象がない突風・ポケモンいれかえ・きずぐすりを使用不可とするプレイ用規約/);
  });

  it("画面で TR3 を選んでも、接続後は対戦の状態の集合を表示して選択値で上書きしない（人工の組み合わせ: 応答は実応答の CURRENT の盤面）", async () => {
    const { transport } = server(B(T.CUR_GUST));
    await start(transport, "CS-KYUURA-PLAY-TR3@1");
    await waitFor(() => expect(statusSet().textContent).toMatch(/CS-KYUURA-CURRENT@1/));
    expect(statusSet().textContent).not.toMatch(/TR3|プレイ用規約/);
  });
});

describe("規約による使用不可と、CURRENT の未裁定の違い（実応答）", () => {
  it("TR3・突風（相手のベンチが空）: 候補の一覧は理由を読み替えず、入力の画面で規約による除外と分かる。選べず、check・送信に除外の id を入れない", async () => {
    const { transport } = server(B(T.TR3_GUST));
    const user = await start(transport, "CS-KYUURA-PLAY-TR3@1");
    const item = await waitFor(() => candidateItem("手札のトレーナーを使う"));
    // 一覧は選べるものを受け取っていないので、規約とも未実装とも断定しない中立の表示（API の値は not_implemented・no_eligible_card のまま）
    expect(item.querySelector(".badges")!.textContent).toMatch(/実行できる選択肢なし/);
    expect(item.textContent).toMatch(/入力画面で理由を確認できます/);
    expect(item.textContent).not.toMatch(/規約により使用不可|未実装/);
    const p = await openTrainer(user);
    const row = optionItem(p, "突風");
    expect(within(row).getByRole("radio")).toBeDisabled();
    expect(row.textContent).toMatch(/規約により使用不可/);
    expect(row.textContent).toContain("規約 PC-GUST-WITHOUT-OPPONENT-BENCH@1");
    expect(p.querySelector(".badges")!.textContent).toMatch(/規約により使用不可/);
    expect(p.querySelector(".badges")!.textContent).not.toMatch(/エンジンが未対応です/);
    await user.click(within(row).getByRole("radio"));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await settle();
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(ofType(transport, "check").every((c) => !(c.body?.choices as string[]).includes("o1"))).toBe(true);
    expect(ofType(transport, "submit")).toHaveLength(0);
  });

  it("CURRENT・混在: 突風・きずぐすりは未裁定（規約の文なし）。ポケモンいれかえは選んで check・送信でき、受理", async () => {
    const { transport } = server(B(T.CUR_MIXED));
    const user = await start(transport);
    const p = await openTrainer(user);
    for (const n of ["突風", "きずぐすり"]) {
      expect(within(optionItem(p, n)).getByRole("radio")).toBeDisabled();
      expect(optionItem(p, n).textContent).toMatch(/未裁定/);
      expect(optionItem(p, n).textContent).not.toMatch(/規約/);
    }
    await user.click(within(optionItem(p, "ポケモンいれかえ")).getByRole("radio"));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await within(p).findByText(/エンジンの検査を通りました/);
    await user.click(within(p).getByRole("button", { name: "送信" }));
    await waitFor(() => expect(within(viewerArea()).getByRole("region", { name: "診断と結果" }).textContent).toMatch(/受理/));
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o3"]]);
  });

  it("TR3・混在: 除外の 2 枚は規約により使用不可、ポケモンいれかえは今までどおり使えて受理。送るのはその id だけで、自動の再送・代わりのカードの自動選択はない", async () => {
    const { transport } = server(B(T.TR3_MIXED));
    const user = await start(transport, "CS-KYUURA-PLAY-TR3@1");
    const p = await openTrainer(user);
    expect(optionItem(p, "突風").textContent).toContain("規約 PC-GUST-WITHOUT-OPPONENT-BENCH@1");
    expect(optionItem(p, "きずぐすり").textContent).toContain("規約 PC-POTION-WITHOUT-DAMAGE@1");
    for (const n of ["突風", "きずぐすり"]) expect(within(optionItem(p, n)).getByRole("radio")).toBeDisabled();
    const sw = within(optionItem(p, "ポケモンいれかえ")).getByRole("radio");
    expect(sw).toBeEnabled();
    expect(sw).not.toBeChecked(); // 代わりのカードを自動で選ばない
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(sw);
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await within(p).findByText(/エンジンの検査を通りました/);
    await user.click(within(p).getByRole("button", { name: "送信" }));
    await waitFor(() => expect(within(viewerArea()).getByRole("region", { name: "診断と結果" }).textContent).toMatch(/受理/));
    await settle();
    expect(ofType(transport, "check").map((c) => c.body?.choices)).toEqual([["o3"]]);
    expect(ofType(transport, "submit").map((c) => c.body?.choices)).toEqual([["o3"]]);
  });

  it("TR3・全除外: 候補は規約により使用不可（未実装の案内にしない）で、送れない", async () => {
    const { transport } = server(B(T.TR3_ALL_EXCLUDED));
    const user = await start(transport, "CS-KYUURA-PLAY-TR3@1");
    const p = await openTrainer(user);
    expect(within(p).getAllByRole("radio").every((r) => (r as HTMLInputElement).disabled)).toBe(true);
    expect(p.textContent).toMatch(/選べるカードがすべてこの対戦の規約集合で除外されているため送れません/);
    expect(p.textContent).not.toMatch(/エンジンが未対応です|処理可能性の区分により送れません/);
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(ofType(transport, "submit")).toHaveLength(0);
  });
});

describe("check・送信・主体の切り替えへの非干渉", () => {
  it("TR3・混在: check を通したあとに閲覧者を切り替えて戻ると、前の選択・check の結果を使わない（送信には新しい check が要る）", async () => {
    const { transport } = server(B(T.TR3_MIXED));
    const user = await start(transport, "CS-KYUURA-PLAY-TR3@1");
    let p = await openTrainer(user);
    await user.click(within(optionItem(p, "ポケモンいれかえ")).getByRole("radio"));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await within(p).findByText(/エンジンの検査を通りました/);
    await showSeat(user, "プレイヤー1");
    await showSeat(user, "プレイヤー0");
    expect(within(viewerArea()).queryByText(/エンジンの検査を通りました/)).toBeNull();
    p = await openTrainer(user);
    expect(within(optionItem(p, "ポケモンいれかえ")).getByRole("radio")).not.toBeChecked();
    expect(within(p).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(ofType(transport, "submit")).toHaveLength(0);
  });

  it("直接の口の拒否 CANDIDATE_NOT_EXECUTABLE は診断としてそのまま表示し、再送しない（人工の差しかえ: 送信の応答を、実応答の除外の拒否に置きかえた）", async () => {
    const refused = B(T.TR3_MIXED).refusedSubmits.o1 as { refusal: { code: string; message: string } };
    const { transport } = server(B(T.TR3_MIXED), (c) => (c.body?.type === "submit" ? refused : undefined));
    const user = await start(transport, "CS-KYUURA-PLAY-TR3@1");
    const p = await openTrainer(user);
    await user.click(within(optionItem(p, "ポケモンいれかえ")).getByRole("radio"));
    await user.click(within(p).getByRole("button", { name: "入力を検査" }));
    await within(p).findByText(/エンジンの検査を通りました/);
    await user.click(within(p).getByRole("button", { name: "送信" }));
    const results = within(viewerArea()).getByRole("region", { name: "診断と結果" });
    await waitFor(() => expect(results.textContent).toMatch(/CANDIDATE_NOT_EXECUTABLE/));
    // 既存の拒否の表示（コードと REFUSAL_TEXT。エンジンの文は出さない形）のまま。規約による除外と決めつけない
    expect(results.textContent).toMatch(/送らなかった（ホストの段の拒否）/);
    expect(results.textContent).toMatch(/未裁定・未対応・規約集合による除外など/);
    expect(refused.refusal.code).toBe("CANDIDATE_NOT_EXECUTABLE");
    await settle();
    expect(ofType(transport, "submit")).toHaveLength(1);
  });
});
