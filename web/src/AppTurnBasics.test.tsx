// 画面全体での U7-3 の操作（模擬の応答・模擬の描画）: 遅れた check の答え・取り直し・受理のあとの取り直しとカード画像の差し替え。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, commonRoutes, deferred, inputs, mockRenderer, mockTransport, observation, player, pokemon, submitResult, view, type Call } from "./test/fixtures";
import { COVERAGE_U73, EVOLVE_STAGES, RETREAT_STAGES } from "./test/u73";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

interface World {
  benchCardId: string;
  revision: number;
}

function obsFor(viewer: 0 | 1 | null, world: World) {
  const p0 = player(0, { handCards: viewer === 0 ? [{ card: 8, card_id: "PMCG1-030" }] : null, active: pokemon(1, "エビワラー", { card_id: "PMCG1-058" }) });
  p0.bench = [pokemon(3, world.benchCardId === "PMCG1-030" ? "ニドリーノ" : "ニドラン♂", { card_id: world.benchCardId, hp: 60, printed_hp: 60, damage: 10 }) as never];
  return observation(viewer, [p0, player(1, { handCards: viewer === 1 ? [{ card: 77, card_id: "SECRET-1" }] : null, active: { face_down: true } })]);
}

function server(world: World, overrides: (c: Call) => unknown | undefined = () => undefined) {
  return mockTransport((c) => {
    const o = overrides(c);
    if (o !== undefined) return o;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
    if (type === "view") return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), obsFor(viewer, world));
    if (type === "candidates") {
      if (tok !== "tok0") return candidates(`r${world.revision}`, []);
      // 番号は種類の並びと関係なく付ける（GUI は kind で表示を決める）
      return candidates(
        `r${world.revision}`,
        [
          cand("retreat", "supported", { id: "c7", input_stages: [{ stage: 1, input: "choose_option" }, { stage: 2, input: "choose_option" }] }),
          cand("end_turn", "may_stop_later", { id: "c3", input_disclosure: "no_input", input_stages: [] }),
          cand("evolve", "supported", { id: "c1", input_stages: [{ stage: 1, input: "choose_option" }, { stage: 2, input: "choose_option" }] }),
        ],
        { coverage: { ...COVERAGE_U73, offered_kinds: ["end_turn", "evolve", "retreat"] } },
      );
    }
    if (type === "inputs") return inputs(c.body?.candidate === "c7" ? "retreat" : "evolve", c.body?.candidate === "c7" ? RETREAT_STAGES : EVOLVE_STAGES);
    if (type === "check") return { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
    if (type === "submit") {
      world.revision += 1;
      if (c.body?.candidate === "c1") world.benchCardId = "PMCG1-030"; // 進化: 場のカードが変わる
      return submitResult("accepted");
    }
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
}

async function start(transport: ReturnType<typeof server>, mock = mockRenderer()) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mock.renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await within(viewerArea()).findByLabelText("プレイヤー0の手札");
  return { user, mock };
}

function candidateItem(label: string) {
  return within(viewerArea())
    .getAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head")?.textContent?.includes(label))!;
}

describe("U7-3 の操作（画面全体）", () => {
  it("進化: 受理のあと候補・入力を捨てて取り直し、場の画像を古い Canvas を消してから新しいカードで描く。今の HP は観測の値", async () => {
    const world = { benchCardId: "PMCG1-029", revision: 1 };
    const transport = server(world);
    const { user, mock } = await start(transport);
    await settle();
    const benchCalls = mock.calls.filter((c) => c.cardId === "PMCG1-029");
    expect(benchCalls.length).toBeGreaterThan(0);
    await user.click(within(candidateItem("進化させる")).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-030/ }));
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-029/ }));
    await user.click(within(panel).getByRole("button", { name: "送信" }));
    expect(transport.calls.filter((c) => c.body?.type === "submit").map((c) => c.body?.choices)).toEqual([["o1", "o2"]]);
    await within(viewerArea()).findByRole("article", { name: "ベンチ1: ニドリーノ" });
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    // 古い場のカードの Canvas: キャンセルして消し、外した
    for (const call of benchCalls) {
      expect(mock.cancelled).toContain(call.canvas);
      expect(call.canvas.width).toBe(0);
      expect(call.canvas.isConnected).toBe(false);
    }
    await settle();
    expect(mock.calls.some((c) => c.cardId === "PMCG1-030")).toBe(true);
    // 遅れて終わった古い描画は戻らない
    for (const call of benchCalls) await act(async () => call.resolve(true));
    expect(benchCalls.every((c) => !c.canvas.isConnected)).toBe(true);
    const bench = within(viewerArea()).getByRole("article", { name: "ベンチ1: ニドリーノ" });
    expect(within(bench).getByText("50/60")).toBeInTheDocument();
    expect(within(bench).getByText("印刷の画像")).toBeInTheDocument();
    // 候補は取り直した（受理で古い取っ手を捨てる）
    await waitFor(() => expect(transport.calls.filter((c) => c.body?.type === "candidates" && tokenOf(c) === "tok0").length).toBeGreaterThanOrEqual(2));
  });

  it("遅れて届いた check の答えは、入力を変えたあとの今の入力に使わない", async () => {
    const world = { benchCardId: "PMCG1-029", revision: 1 };
    const late = deferred<unknown>();
    let checks = 0;
    const transport = server(world, (c) => {
      if (c.body?.type !== "check") return undefined;
      checks += 1;
      return checks === 1 ? late.promise : undefined;
    });
    const { user } = await start(transport);
    await user.click(within(candidateItem("にげる")).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-030/ }));
    const boxes = within(panel).getAllByRole("checkbox");
    await user.click(boxes[0]!);
    await user.click(boxes[1]!);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // ["o1","o2","o3"] の check（遅れる）
    await user.click(boxes[1]!); // 入力を変える（o3 を外す）
    late.resolve({ contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false });
    await settle();
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    // v0.172 から: 入力を変えたあとに届いた答えは置かない。元の入力に戻しても、その遅れた答えは使わず、検査し直す（U7-5g の上流の変更と同じ扱い）
    await user.click(boxes[1]!);
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    expect(await within(panel).findByText(/エンジンの検査を通りました/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeEnabled();
  });

  it("check が refetch_required なら候補を取り直し、古い入力を捨てる（自動で送らない）", async () => {
    const world = { benchCardId: "PMCG1-029", revision: 1 };
    const transport = server(world, (c) =>
      c.body?.type === "check"
        ? { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: false, refusal: { code: "CANDIDATES_STALE", message: "古い" } }, refetch_required: true }
        : undefined,
    );
    const { user } = await start(transport);
    await user.click(within(candidateItem("にげる")).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-030/ }));
    const before = transport.calls.filter((c) => c.body?.type === "candidates" && tokenOf(c) === "tok0").length;
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull());
    expect(transport.calls.filter((c) => c.body?.type === "candidates" && tokenOf(c) === "tok0").length).toBeGreaterThan(before);
    expect(transport.calls.filter((c) => c.body?.type === "submit")).toHaveLength(0);
  });

  it("やめると選択を捨てるだけで、何も送らない", async () => {
    const world = { benchCardId: "PMCG1-029", revision: 1 };
    const transport = server(world);
    const { user } = await start(transport);
    await user.click(within(candidateItem("進化させる")).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-030/ }));
    await user.click(within(panel).getByRole("button", { name: "やめる" }));
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(transport.calls.filter((c) => c.body?.type === "submit" || c.body?.type === "check")).toHaveLength(0);
  });

  it("相手の観測にある本人のうらのカード・相手の手札は、U7-3 の候補があっても DOM に出ない", async () => {
    const world = { benchCardId: "PMCG1-029", revision: 1 };
    const { user, mock } = await start(server(world));
    await user.click(within(candidateItem("進化させる")).getByRole("button", { name: "この操作を選ぶ" }));
    await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await settle();
    expect(document.body.innerHTML).not.toMatch(/SECRET-1/);
    expect(mock.calls.every((c) => c.cardId !== "SECRET-1")).toBe(true);
  });
});
