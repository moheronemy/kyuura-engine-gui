// 画面全体での U7-4 のワザの宣言（模擬の応答・模擬の描画）: 宣言のあとの決定への移り・遅れた check と submit・拒否と受理のあとの停止・情報境界。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, commonRoutes, deferred, inputs, mockRenderer, mockTransport, observation, player, pokemon, view, type Call } from "./test/fixtures";
import { COVERAGE_U73 } from "./test/u73";
import { ACCEPTED_AWAITING_OWN, ACCEPTED_HALTED, ADDON_STAGES, ATTACK_CANDIDATE, FACE_DOWN_ATTACK_STAGES, JAB_STAGES, REJECTED_HC1 } from "./test/u74";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const COVERAGE = {
  ...COVERAGE_U73,
  implemented_kinds: [...COVERAGE_U73.implemented_kinds.slice(0, 10), "use_attack", ...COVERAGE_U73.implemented_kinds.slice(10)],
  not_covered_kinds: COVERAGE_U73.not_covered_kinds.filter((k) => k !== "use_attack"),
  offered_kinds: ["end_turn", "use_attack"],
};
const HALT = ACCEPTED_HALTED.result!.halt;

interface World {
  phase: "turn" | "decision" | "halted";
  revision: number;
  faceDown?: boolean;
}

function obsFor(viewer: 0 | 1 | null, world: World) {
  const active = world.faceDown ? { face_down: true } : pokemon(1, "エビワラー", { card_id: "PMCG1-058", damage: 0 });
  return observation(viewer, [player(0, { handCards: viewer === 0 ? [] : null, active }), player(1, { handCards: viewer === 1 ? [{ card: 77, card_id: "SECRET-2" }] : null, active: pokemon(2, "ゴース", { card_id: "PMCG1-050" }) })]);
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
    const status = world.phase === "halted" ? { status: "halted", continuable: false, waiting: [], halt: HALT } : {};
    if (type === "view") return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), obsFor(viewer, world), status);
    if (type === "candidates") {
      const rev = `r${world.revision}`;
      if (world.phase === "halted") return candidates(rev, [], { situation: "halted", empty_reason: "game_ended" });
      if (tok !== "tok0") return candidates(rev, [], { situation: "waiting_for_player", empty_reason: "not_actor" });
      if (world.phase === "decision") {
        return candidates(rev, [cand("answer_decision", "may_stop_later", { id: "c1", input_stages: [{ stage: 1, input: "choose_option" }] })]);
      }
      return candidates(rev, [cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] }), { ...ATTACK_CANDIDATE, id: "c2" }], { coverage: COVERAGE });
    }
    if (type === "inputs") {
      if (world.phase === "decision") {
        return inputs("answer_decision", [
          { stage: 1, input: "choose_option", decision_kind: "select_pokemon", meaning: "pokemon", count: { min: 1, max: 1 }, options: [{ id: "o1", value: 2, processability: "may_stop_later" }], order: "not_applicable" },
        ]);
      }
      return inputs("use_attack", world.faceDown ? FACE_DOWN_ATTACK_STAGES : c.body?.candidate === "c2" && world.revision === 2 ? ADDON_STAGES : JAB_STAGES);
    }
    if (type === "check") return { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
    if (type === "submit") {
      world.revision += 1;
      if (world.phase === "decision") {
        world.phase = "halted";
        return ACCEPTED_HALTED;
      }
      world.phase = "decision";
      return ACCEPTED_AWAITING_OWN;
    }
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
}

async function start(transport: ReturnType<typeof server>) {
  const user = userEvent.setup();
  const mock = mockRenderer();
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

async function openAttack(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(await waitFor(() => candidateItem("ワザを使う"))).getByRole("button", { name: "この操作を選ぶ" }));
  return within(viewerArea()).findByRole("region", { name: /^入力/ });
}

const submits = (t: { calls: Call[] }) => t.calls.filter((c) => c.body?.type === "submit");

describe("U7-4 のワザの宣言（画面全体）", () => {
  it("ワザを選ぶ → check → 送信 → 受理のあとの決定（本人の回答待ち・相手は待つ）→ 答えると受理のあと停止", async () => {
    const world: World = { phase: "turn", revision: 1 };
    const transport = server(world);
    const { user } = await start(transport);
    const panel = await openAttack(user);
    await user.click(within(panel).getByRole("radio", { name: /［ジャブ］/ }));
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([["o1"]]);
    // 受理（決定待ち）: 古い候補・入力を捨て、本人の決定の候補を取り直す
    expect(await within(viewerArea()).findByText("受理（決定待ち）: ワザを使う")).toBeInTheDocument();
    expect(within(viewerArea()).getByText("次: あなた（プレイヤー0）の決定への回答")).toBeInTheDocument();
    await waitFor(() => expect(candidateItem("決定に答える")).toBeTruthy());
    // 相手の画面は待つ（候補なし）
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    expect(await within(viewerArea()).findByText(/ほかのプレイヤーの操作待ち/)).toBeInTheDocument();
    expect(within(viewerArea()).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
    // 本人が決定に答える（既存の決定の入力）
    await user.click(screen.getByRole("radio", { name: "プレイヤー0" }));
    await user.click(within(await waitFor(() => candidateItem("決定に答える"))).getByRole("button", { name: "この操作を選ぶ" }));
    const decision = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(decision).getByRole("radio", { name: /ゴース/ }));
    await user.click(within(decision).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("受理（そのあと停止）: 決定に答える")).toBeInTheDocument();
    expect(within(viewerArea()).getByText(/宣言の拒否ではありません/)).toBeInTheDocument();
    await waitFor(() => expect(within(viewerArea()).getAllByText(/この場面の扱いは、今のルールと記録からは決まらない/).length).toBeGreaterThan(0));
    expect(within(viewerArea()).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
    expect(submits(transport)).toHaveLength(2);
  });

  it("遅れて届いた check の答えは、ワザを変えたあとの入力に使わない", async () => {
    const world: World = { phase: "turn", revision: 2 }; // 宣言といっしょに選ぶもののある入力
    const late = deferred<unknown>();
    let checks = 0;
    const transport = server(world, (c) => {
      if (c.body?.type !== "check") return undefined;
      checks += 1;
      return checks === 1 ? late.promise : undefined;
    });
    const { user } = await start(transport);
    const panel = await openAttack(user);
    await user.click(within(panel).getByRole("radio", { name: /［ワザA］/ }));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // ["o1"] の check（遅れる）
    await user.click(within(panel).getByRole("radio", { name: /［ワザB］/ })); // ワザを変える
    late.resolve({ contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false });
    await settle();
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(submits(transport)).toHaveLength(0);
  });

  it("送信中の二重クリックは 1 回だけ送り、閲覧者を切り替えたあとに届いた結果は新しい閲覧者の画面に出さない", async () => {
    const world: World = { phase: "turn", revision: 1 };
    const slow = deferred<unknown>();
    const transport = server(world, (c) => (c.body?.type === "submit" ? slow.promise : undefined));
    const { user } = await start(transport);
    const panel = await openAttack(user);
    await user.click(within(panel).getByRole("radio", { name: /［ジャブ］/ }));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.dblClick(await within(panel).findByRole("button", { name: "送信" }));
    expect(submits(transport)).toHaveLength(1);
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    world.phase = "decision";
    world.revision += 1;
    slow.resolve(ACCEPTED_AWAITING_OWN);
    await settle();
    expect(within(viewerArea()).queryByText(/受理（決定待ち）/)).toBeNull();
    expect(submits(transport)).toHaveLength(1);
  });

  it("エンジンの拒否（rejected）は状態が変わらないと示し、自動で再送しない（取っ手は失効しない）", async () => {
    const world: World = { phase: "turn", revision: 1 };
    const transport = server(world, (c) => (c.body?.type === "submit" ? REJECTED_HC1 : undefined));
    const { user } = await start(transport);
    const panel = await openAttack(user);
    await user.click(within(panel).getByRole("radio", { name: /［ジャブ］/ }));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("拒否（エンジン）: ワザを使う")).toBeInTheDocument();
    expect(within(viewerArea()).getByText(/区分: 未裁定（ゲーム上の禁止ではありません）/)).toBeInTheDocument();
    expect(within(viewerArea()).getByText(/エンジンが受け付けませんでした（状態は変わりません）/)).toBeInTheDocument();
    await settle();
    expect(submits(transport)).toHaveLength(1);
    // 同じ取っ手（revision が同じ）なので、入力の画面は残る（利用者が選び直せる）
    expect(within(viewerArea()).getByRole("region", { name: /^入力/ })).toBeInTheDocument();
  });

  it("本人のうらのバトル場のポケモンのワザ: 本人の候補のカードは本人の画面だけ。相手の画面の DOM・描画に出ない", async () => {
    const world: World = { phase: "turn", revision: 1, faceDown: true };
    const transport = server(world);
    const user = userEvent.setup();
    const mock = mockRenderer();
    render(<App transport={transport} cardRenderer={mock.renderer} />);
    const create = await screen.findByRole("button", { name: /対戦を作成/ });
    await waitFor(() => expect(create).toBeEnabled());
    await user.click(create);
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    const panel = await openAttack(user);
    expect(within(panel).getByRole("radio", { name: /［ひみつのワザ］/ }).closest("li")).toHaveTextContent("未確認");
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    await within(viewerArea()).findByLabelText("プレイヤー1の手札");
    await settle();
    expect(viewerArea().innerHTML).not.toMatch(/SECRET-1|ひみつのワザ/);
    const after = mock.calls.length;
    await settle();
    expect(mock.calls.slice(after).every((c) => c.cardId !== "SECRET-1")).toBe(true);
  });
});
