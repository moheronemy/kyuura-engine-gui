// 画面全体での U7-5（模擬の応答・模擬の描画）: 錯乱ジムで相手が答える決定・本人だけの拒否と辞退、うらのカードをおもてにしたあとの画像と状態の更新・情報境界。
// 形は test/u75.ts（固定版のエンジン 0.170.0 の実応答の形）。実エンジンとの確認は e2e/u75.spec.ts と server/tests/test_u7_5.py。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, cardDefinitions, commonRoutes, inputs, mockRenderer, mockTransport, observation, player, pokemon, pokemonRecord, view, type Call } from "./test/fixtures";
import {
  ACCEPT_REQUEST_STAGES,
  ANSWER_CANDIDATE,
  CHAOS_ACCEPTED_OTHER,
  DECLINED_BACK_TO_TURN,
  REJECTED_BORROW,
  REVEAL_STAGES,
  TRAINER_CANDIDATE,
  TRAINER_CHAOS_STAGES,
} from "./test/u75";
import { submit as envelope } from "./test/u74";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const submits = (t: { calls: Call[] }) => t.calls.filter((c) => c.body?.type === "submit");

function candidateItem(label: string) {
  return within(viewerArea())
    .getAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head")?.textContent?.includes(label))!;
}

async function start(transport: ReturnType<typeof mockTransport>) {
  const user = userEvent.setup();
  const mock = mockRenderer();
  render(<App transport={transport} cardRenderer={mock.renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await within(viewerArea()).findByLabelText("プレイヤー0の手札");
  return { user, mock };
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(within(await waitFor(() => candidateItem(label))).getByRole("button", { name: "この操作を選ぶ" }));
  return within(viewerArea()).findByRole("region", { name: /^入力/ });
}

describe("錯乱ジム: 使った側の宣言のあと、相手が答える", () => {
  it("答える人にだけ入力を出し、使えない「使う」の拒否は答えた人にだけ示す。辞退で決定から抜けられる", async () => {
    const world = { phase: "turn" as "turn" | "borrow" | "back", revision: 1 };
    const transport = mockTransport((c) => {
      const common = commonRoutes(c);
      if (common !== undefined) return common;
      const type = c.body?.type;
      const tok = tokenOf(c);
      const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
      const rev = `r${world.revision}`;
      if (type === "view") {
        const obs = observation(viewer, [player(0, { handCards: viewer === 0 ? [] : null, active: pokemon(1, "ガーディ", { card_id: "PMCG1-018" }) }), player(1, { handCards: viewer === 1 ? [] : null, active: pokemon(2, "ブーバー", { card_id: "PMCG1-020" }) })]);
        return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), obs);
      }
      if (type === "candidates") {
        const actor = world.phase === "borrow" ? "tok1" : "tok0";
        if (tok !== actor) return candidates(rev, [], { situation: "waiting_for_player", empty_reason: "not_actor" });
        if (world.phase === "borrow") return candidates(rev, [ANSWER_CANDIDATE]);
        return candidates(rev, [cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] }), TRAINER_CANDIDATE]);
      }
      if (type === "inputs") return world.phase === "borrow" ? inputs("answer_decision", ACCEPT_REQUEST_STAGES) : inputs("play_trainer", TRAINER_CHAOS_STAGES);
      if (type === "check") return { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
      if (type === "submit") {
        world.revision += 1; // 実エンジンは候補を取るたびに新しい取っ手を出す（拒否のあとの取り直しでも番号が変わる）
        if (world.phase === "turn") {
          world.phase = "borrow";
          return CHAOS_ACCEPTED_OTHER;
        }
        if ((c.body?.choices as unknown[]).length > 0) return REJECTED_BORROW;
        world.phase = "back";
        return DECLINED_BACK_TO_TURN;
      }
      throw new Error(`想定外 ${c.path} ${String(type)}`);
    });
    const { user } = await start(transport);
    // プレイヤー0: 交換おじさんを使う（check → 送信）。受理（決定待ち）で、答えるのは相手
    const panel = await choose(user, "手札のトレーナーを使う");
    await user.click(within(panel).getAllByRole("radio")[0]!);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("受理（決定待ち）: 手札のトレーナーを使う")).toBeInTheDocument();
    expect(within(viewerArea()).getByText("次: プレイヤー1の決定への回答（相手が答えます。答えるまで待ちます）")).toBeInTheDocument();
    expect(await within(viewerArea()).findByText(/ほかのプレイヤーの操作待ち/)).toBeInTheDocument();
    expect(within(viewerArea()).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull(); // 使った側に入力は出ない
    // プレイヤー1: 「使う」→ 拒否（本人だけ）
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    let decision = await choose(user, "決定に答える");
    expect(within(decision).getByText(/accept_request/)).toBeInTheDocument();
    await user.click(within(decision).getByRole("radio", { name: /値 1/ }));
    await user.click(within(decision).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("拒否（エンジン）: 決定に答える")).toBeInTheDocument();
    expect(within(viewerArea()).getByText("この結果は送ったあなたにだけ表示しています（相手・観戦者には知らせません）。")).toBeInTheDocument();
    expect(within(viewerArea()).getByText("診断: NO_POKEMON_CARD_IN_HAND")).toBeInTheDocument();
    await settle();
    expect(submits(transport)).toHaveLength(2); // 自動で再送しない
    // 使ったプレイヤー・観戦者の画面に、拒否の通知はない
    for (const seat of ["プレイヤー0", "観戦者"]) {
      await user.click(screen.getByRole("radio", { name: seat }));
      await within(viewerArea()).findByRole("region", { name: "対戦の状態" });
      await settle();
      expect(within(viewerArea()).queryByText(/拒否（エンジン）/)).toBeNull();
      expect(viewerArea().innerHTML).not.toContain("NO_POKEMON_CARD_IN_HAND");
    }
    // プレイヤー1: 取り直した候補で、辞退（何も選ばない）を送る → 受理、使ったプレイヤーの番にもどる
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    decision = await choose(user, "決定に答える");
    await user.click(within(decision).getByRole("radio", { name: "選ばない" }));
    await user.click(within(decision).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("受理: 決定に答える")).toBeInTheDocument();
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([["o1"], ["o1"], []]);
  });
});

describe("うらのカードをおもてにする: 画像と状態は受理のあとの観測から", () => {
  it("おもてにする前はうらの画像だけ（持ち主には文字で本人の知識）。おもてにしたあと、新しい印刷の画像に切り替える", async () => {
    const world = { revealed: false, revision: 1 };
    const faceDown = { pokemon_id: 3, face_down: true, damage: 0, energy: [], trainers: [], special_conditions: [], persistent_effects: [], markers: [] };
    const transport = mockTransport((c) => {
      if (c.path === "/api/card-definitions") return cardDefinitions([pokemonRecord("PMCG1-014", "ヒトカゲ"), pokemonRecord("PMCG1-020", "ブーバー")]);
      const common = commonRoutes(c);
      if (common !== undefined) return common;
      const type = c.body?.type;
      const tok = tokenOf(c);
      const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
      const rev = `r${world.revision}`;
      if (type === "view") {
        const bench = world.revealed ? [pokemon(3, "ヒトカゲ", { card_id: "PMCG1-014" })] : [viewer === 0 ? { ...faceDown, real: { card: 2, card_id: "PMCG1-014", name_ja: "ヒトカゲ" } } : faceDown];
        const p0 = player(0, { handCards: viewer === 0 ? [] : null, active: pokemon(1, "ブーバー", { card_id: "PMCG1-020" }) });
        p0.bench = bench as never;
        return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), observation(viewer, [p0, player(1, { handCards: viewer === 1 ? [] : null })]));
      }
      if (type === "candidates") {
        if (tok !== "tok0" || world.revealed) return candidates(rev, [], { situation: tok === "tok0" ? "actor_to_act" : "waiting_for_player", empty_reason: "not_actor" });
        return candidates(rev, [cand("reveal_face_down", "may_stop_later", { id: "c2", reasons: ["face_down_reveal_not_evaluated"], choices_format: "[場のポケモンの番号]", input_stages: [{ stage: 1, input: "choose_option" }] })]);
      }
      if (type === "inputs") return inputs("reveal_face_down", REVEAL_STAGES);
      if (type === "check") return { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
      if (type === "submit") {
        world.revision += 1;
        world.revealed = true;
        return envelope("accepted", { next: [{ kind: "turn_action", player: 0 }] });
      }
      throw new Error(`想定外 ${c.path} ${String(type)}`);
    });
    const { user, mock } = await start(transport);
    const p0Area = () => within(viewerArea()).getByRole("region", { name: /^プレイヤー0/ });
    const bench = () => within(p0Area()).getByLabelText(/ベンチ1: /);
    expect(bench()).toHaveAttribute("aria-label", "ベンチ1: 裏向きのポケモン");
    expect(bench()).toHaveTextContent("あなたにだけ見えるカード: ヒトカゲ PMCG1-014（相手・観戦者には見えません）");
    await settle();
    expect(mock.calls.some((c) => c.cardId === "PMCG1-014")).toBe(false); // 場ではうらのまま（表の画像を描かない）
    // 相手の画面: 持ち主の知識は DOM にない
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    await within(viewerArea()).findByLabelText("プレイヤー1の手札");
    await settle();
    expect(viewerArea().innerHTML).not.toMatch(/PMCG1-014|ヒトカゲ/);
    // 本人: おもてにする（残るかを予告しない）→ 受理のあとの観測で、新しい印刷の画像に切り替える
    await user.click(screen.getByRole("radio", { name: "プレイヤー0" }));
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    const panel = await choose(user, "うらのカードをおもてにする");
    expect(within(panel).getByText(/ここでは予告しません/)).toBeInTheDocument();
    await user.click(within(panel).getByRole("radio", { name: /裏向きのポケモン（ベンチ1）/ }));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText("受理: うらのカードをおもてにする")).toBeInTheDocument();
    await waitFor(() => expect(bench()).toHaveAttribute("aria-label", "ベンチ1: ヒトカゲ"));
    await waitFor(() => expect(mock.calls.some((c) => c.cardId === "PMCG1-014")).toBe(true));
    expect(within(bench()).queryByLabelText("裏向きのポケモン")).toBeNull();
    expect(within(bench()).getByText("印刷の画像")).toBeInTheDocument();
  });
});
