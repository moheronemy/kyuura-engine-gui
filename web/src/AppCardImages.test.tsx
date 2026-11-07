// 画面全体でのカード画像（模擬の応答・模擬の描画）。閲覧者の切り替え・非公開のカード・動的な状態・決定の選択肢。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, commonRoutes, inputs, mockRenderer, mockTransport, observation, player, pokemon, submitResult, view, type Call } from "./test/fixtures";

const HAND0 = [{ card: 2, card_id: "PMCG1-058" }];
const HAND1 = [{ card: 77, card_id: "SECRET-1" }];
const tokenOf = (c: Call) => c.path.split("/")[3];

function obsFor(viewer: 0 | 1 | null) {
  return observation(viewer, [
    player(0, { handCards: viewer === 0 ? HAND0 : null, active: pokemon(1, "エビワラー", { card_id: "PMCG1-058" }) }),
    player(1, { handCards: viewer === 1 ? HAND1 : null, active: { face_down: true } }),
  ]);
}

function server(overrides: (c: Call) => unknown | undefined = () => undefined) {
  return mockTransport((c) => {
    const o = overrides(c);
    if (o !== undefined) return o;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
    if (type === "view") return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), obsFor(viewer));
    if (type === "candidates") return candidates("r1", []);
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
}

async function startGame(transport: ReturnType<typeof server>, mock = mockRenderer()) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mock.renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await screen.findByRole("heading", { name: "表示する閲覧者（ローカルの切り替え）" });
  return { user, mock };
}

const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

describe("画面のカード画像", () => {
  it("自分の手札と公開の場は表面、相手の手札（枚数だけ）とうらのポケモンは裏面。非公開のカードは描かず DOM にも出さない", async () => {
    const { mock } = await startGame(server());
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    await settle();
    // 表面を描こうとしたのは観測にカード ID があるものだけ（全体の表には SECRET-1 の定義もある）
    expect(new Set(mock.calls.map((c) => c.cardId))).toEqual(new Set(["PMCG1-058"]));
    expect(mock.items).not.toContain("SECRET-1");
    const area = viewerArea();
    expect(within(area).getByRole("img", { name: "プレイヤー1・手札（裏向き 5 枚）" })).toBeInTheDocument();
    expect(within(area).getByRole("img", { name: "裏向きのポケモン" })).toBeInTheDocument();
    expect(within(area).getByRole("img", { name: /プレイヤー1・山札（裏向き 41 枚）/ })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/SECRET-1|ひみつのポケモン/);
  });

  it("動的な HP・ダメージ・状態は観測の値を文字で出し、画像は印刷の画像として別に示す", async () => {
    const { mock } = await startGame(server());
    const area = viewerArea();
    const active = await within(area).findByRole("article", { name: "バトル場: エビワラー" });
    await settle();
    for (const call of mock.calls) await act(async () => call.resolve(true));
    expect(within(active).getByText("50/70")).toBeInTheDocument();
    expect(within(active).getByText(/状態: poisoned/)).toBeInTheDocument();
    expect(within(active).getByText("印刷の画像")).toBeInTheDocument();
    expect(within(active).getByRole("img", { name: /^エビワラーの印刷のカード画像/ })).toBeInTheDocument();
    expect(within(active).getByLabelText("今の状態（観測の値）")).toHaveTextContent("ダメージ20");
  });

  it("閲覧者を切り替えると、前の閲覧者のカードの画像をすぐに消し、遅れて終わった描画も戻らない", async () => {
    const { user, mock } = await startGame(server());
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    await settle();
    const before = mock.calls.slice();
    await act(async () => before[0]!.resolve(true)); // 1 枚は描けた（ピクセルがある）
    before[0]!.canvas.width = 84;
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    for (const call of before) {
      expect(mock.cancelled).toContain(call.canvas);
      expect(call.canvas.width).toBe(0);
      expect(call.canvas.hidden).toBe(true);
      expect(call.canvas.isConnected).toBe(false);
    }
    // 遅れて終わった前の閲覧者の描画
    for (const call of before.slice(1)) await act(async () => call.resolve(true));
    expect(Array.from(viewerArea().querySelectorAll("canvas")).every((c) => !before.some((b) => b.canvas === c))).toBe(true);
    expect(await within(viewerArea()).findByLabelText("プレイヤー1の手札")).toBeInTheDocument();
    await settle();
    // プレイヤー1の観測: 自分の手札 SECRET-1 は表面、プレイヤー0の手札は裏面
    expect(mock.calls.slice(before.length).map((c) => c.cardId)).toContain("SECRET-1");
    expect(within(viewerArea()).getByRole("img", { name: "プレイヤー0・手札（裏向き 5 枚）" })).toBeInTheDocument();
    // 観戦者へ: SECRET-1 の画像も文字も残らない
    const secretCanvases = mock.calls.filter((c) => c.cardId === "SECRET-1").map((c) => c.canvas);
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    await within(viewerArea()).findByText(/観戦者は観測と公開の更新だけ/);
    for (const c of secretCanvases) {
      expect(c.isConnected).toBe(false);
      expect(c.width).toBe(0);
    }
    for (const call of mock.calls.filter((c) => c.cardId === "SECRET-1")) await act(async () => call.resolve(true));
    expect(viewerArea().innerHTML).not.toMatch(/SECRET-1|ひみつのポケモン/);
  });

  it("決定の選択肢の画像を押すと、同じ選択肢の入力を選ぶ（送るのは選択肢の id）", async () => {
    const stage = {
      stage: 1,
      input: "choose_option" as const,
      meaning: "card",
      count: { min: 1, max: 1 },
      order: "not_applicable",
      options: [
        { id: "o1", processability: "supported", card: 2, card_id: "PMCG1-058" },
        { id: "o2", processability: "supported", card: 3, card_id: "PMCG1-102" },
      ],
    };
    const transport = server((c) => {
      if (tokenOf(c) !== "tok0") return undefined;
      if (c.body?.type === "candidates") return candidates("r1", [cand("answer_decision", "supported")]);
      if (c.body?.type === "inputs") return inputs("answer_decision", [stage]);
      if (c.body?.type === "submit") return submitResult("accepted");
      return undefined;
    });
    const { user, mock } = await startGame(transport);
    const area = viewerArea();
    await user.click(await within(area).findByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(area).findByRole("region", { name: /^入力/ });
    await settle();
    expect(mock.calls.map((c) => c.cardId)).toContain("PMCG1-102");
    const option = within(panel).getByRole("radio", { name: /基本闘エネルギー|PMCG1-102/ });
    const image = option.closest("label")!.querySelector(".card-image") as HTMLElement;
    await user.click(image);
    expect(option).toBeChecked();
    await user.click(within(panel).getByRole("button", { name: "送信" }));
    const sent = transport.calls.filter((c) => c.body?.type === "submit");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body?.choices).toEqual(["o2"]);
  });
});
