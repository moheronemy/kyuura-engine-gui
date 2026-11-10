// 画面全体での PT-5t-C1（エンジン 0.179.0。相手のバトル場がうらのとき、同じ play_trainer の候補にねむれ!ねむれ!（unverified）とマサキ（may_stop_later）の選べるものが並ぶ。
// 模擬の接続層・模擬の描画。応答の形は test/pt5t.ts の実応答）。使う人（プレイヤー 1）の画面だけに候補・入力・検査・診断。相手のバトル場は公開の位置と裏向きだけ
// （本当のカードの ID・名前・画像を補わない）。check は今の主体・取っ手・候補・入力への答えだけを使い、カードの選び直し・元の入力への戻り・閲覧者の切り替えで捨てる。
// 拒否は本人だけに示し、自動で再送しない。受理のあとは結果を予告せず、応答と観測で表示する。実エンジンとの確認は server/tests/test_pt5t_c1.py と e2e/pt5t-c1.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { candidates, cardDefinitions, commonRoutes, deferred, ENERGY_RECORD, mockRenderer, mockTransport, pokemonRecord, type Call } from "./test/fixtures";
import { PT5T_CANDIDATES, PT5T_CHECK, PT5T_INPUTS, PT5T_REALS, PT5T_VIEWS } from "./test/pt5t";
import { submit as envelope } from "./test/u74";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const REAL_IDS = Object.keys(PT5T_REALS);
const REALS = new RegExp(Object.entries(PT5T_REALS).flat().join("|"));
// カード定義は本当のカードも含む（定義を知っていても、観測にないものを補わないことを確かめる）
const DEFINITIONS = cardDefinitions([pokemonRecord("PMCG1-058", "エビワラー"), ...Object.entries(PT5T_REALS).map(([id, name]) => pokemonRecord(id, name)), ENERGY_RECORD]);
const REJECTED = envelope("rejected", { status: "in_progress", diagnostic_id: "TRAINER_REJECTED", category: "invalid_input", message: "この操作は、今の対戦の状態ではルール上できません。" });
const TRAINER = "手札のトレーナーを使う";

function server(override: (c: Call) => unknown = () => undefined) {
  return mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    if (c.path === "/api/card-definitions") return DEFINITIONS;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    if (type === "view") {
      if (tok === "tok0") return PT5T_VIEWS[0];
      if (tok === "tok1") return PT5T_VIEWS[1];
      if (tok === "tokH") return { ...PT5T_VIEWS.spectator, viewer: "host" };
      return PT5T_VIEWS.spectator;
    }
    if (type === "candidates") {
      if (tok !== "tok1") return candidates("r1", [], { situation: "waiting_for_player", empty_reason: "not_actor", coverage: { ...PT5T_CANDIDATES.response.coverage, offered_kinds: [], unverified_paths: [] } });
      return PT5T_CANDIDATES;
    }
    if (type === "inputs") return { ...PT5T_INPUTS, response: { ...PT5T_INPUTS.response, candidate: c.body?.candidate } };
    if (type === "check") return PT5T_CHECK;
    if (type === "submit") return envelope("accepted", { status: "in_progress", next: [{ kind: "turn_action", player: 1 }] });
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
}

async function start(transport: ReturnType<typeof mockTransport>, mock = mockRenderer()) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mock.renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await within(viewerArea()).findByLabelText("プレイヤー0の手札");
  return { user, mock };
}

const item = (label: string) =>
  within(viewerArea())
    .queryAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head") && li.textContent?.includes(label));
const submits = (t: ReturnType<typeof mockTransport>) => t.calls.filter((c) => c.body?.type === "submit");
const checks = (t: ReturnType<typeof mockTransport>) => t.calls.filter((c) => c.body?.type === "check");

async function asUser(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
  await waitFor(() => expect(item(TRAINER)).toBeTruthy());
}

async function openTrainer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(item(TRAINER)!).getByRole("button", { name: "この操作を選ぶ" }));
  return within(viewerArea()).findByRole("region", { name: /^入力/ });
}

const radio = (panel: HTMLElement, cardId: string) => within(panel).getByRole("radio", { name: new RegExp(cardId) });
const optionRow = (panel: HTMLElement, cardId: string) => radio(panel, cardId).closest("li") as HTMLElement;

describe("PT-5t-C1（画面全体）", () => {
  it("混在する選べるもの: 候補は「送れる（後で止まりうる）」、選べるものごとに未確認（理由つき）と送れる。盤面は裏向きだけ。unverified も今の check のあとに送る", async () => {
    const transport = server();
    const { user, mock } = await start(transport);
    await asUser(user);
    expect(item(TRAINER)).toHaveTextContent("送れる（後で止まりうる）");
    expect(within(viewerArea()).getByLabelText(/バトル場: 裏向きのポケモン/)).toBeInTheDocument();
    expect(viewerArea().textContent).not.toMatch(REALS);
    const panel = await openTrainer(user);
    expect(optionRow(panel, "PMCG4-054")).toHaveTextContent("未確認");
    expect(optionRow(panel, "PMCG4-054")).toHaveTextContent("うらのカードの本当のカードでは確かめていない（使えるか・どうなるかは送信のあとエンジンが決める）");
    expect(optionRow(panel, "PMCG1-074")).toHaveTextContent("送れる（後で止まりうる）");
    expect(panel.textContent).not.toMatch(/ゲーム上の禁止|受理されます|完走します|使えます|おもてになります|場に残ります/);
    await user.click(radio(panel, "PMCG4-054"));
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    expect(checks(transport).map((c) => c.body?.choices)).toEqual([["o1"]]);
    expect(await within(panel).findByText(/エンジンの検査を通りました/)).toHaveTextContent("受理・完走の保証ではありません");
    await user.click(within(panel).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理: 手札のトレーナーを使う/)).toBeInTheDocument();
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([["o1"]]);
    expect(mock.calls.some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false); // 本当のカードの画像を描かない
  });

  it("カードを選び直すと check の答えを捨て、元の入力に戻しても、変える前に始めた遅れた check では送れない", async () => {
    const late = deferred<unknown>();
    let n = 0;
    const transport = server((c) => {
      if (c.body?.type !== "check") return undefined;
      n += 1;
      return n === 1 ? late.promise : undefined;
    });
    const { user } = await start(transport);
    await asUser(user);
    const panel = await openTrainer(user);
    await user.click(radio(panel, "PMCG4-054"));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await user.click(radio(panel, "PMCG1-074")); // 選び直す
    await user.click(radio(panel, "PMCG4-054")); // 元の入力に戻す
    late.resolve(PT5T_CHECK);
    await settle();
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled(); // 改めて check が要る
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(panel).getByRole("button", { name: "送信" })).toBeEnabled());
    await user.click(radio(panel, "PMCG1-074")); // check のあとに選び直す: 前の答えは使わない
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(submits(transport)).toHaveLength(0);
  });

  it("相手本人の画面には本人の知識（real）があり使う人の候補はない。観戦者には本当のカードも使う人の候補もない。閲覧者の切り替えで遅れた check を置かない", async () => {
    const late = deferred<unknown>();
    const transport = server((c) => (c.body?.type === "check" ? late.promise : undefined));
    const { user, mock } = await start(transport);
    await waitFor(() => expect(viewerArea().textContent).toMatch(/あなたにだけ見えるカード: コラッタ/));
    expect(item(TRAINER)).toBeUndefined();
    await asUser(user);
    const panel = await openTrainer(user);
    await user.click(radio(panel, "PMCG4-054"));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    late.resolve(PT5T_CHECK);
    await settle();
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(viewerArea().innerHTML).not.toMatch(/エンジンの検査を通りました|ねむれ!ねむれ!/);
    expect(viewerArea().textContent).not.toMatch(REALS);
    expect(item(TRAINER)).toBeUndefined();
    expect(within(viewerArea()).getByLabelText(/バトル場: 裏向きのポケモン/)).toBeInTheDocument();
    expect(mock.calls.some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false);
    expect(submits(transport)).toHaveLength(0);
  });

  it("拒否: 診断は送った本人の画面だけ。自動で再送しない。相手・観戦者の画面に出ない", async () => {
    const transport = server((c) => (c.body?.type === "submit" ? REJECTED : undefined));
    const { user } = await start(transport);
    await asUser(user);
    const panel = await openTrainer(user);
    await user.click(radio(panel, "PMCG4-054"));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    await within(viewerArea()).findByText(/拒否（エンジン）: 手札のトレーナーを使う/);
    expect(viewerArea().textContent).toMatch(/送ったあなたにだけ表示しています/);
    await settle();
    expect(submits(transport)).toHaveLength(1);
    for (const seat of ["プレイヤー0", "観戦者"]) {
      await user.click(screen.getByRole("radio", { name: seat }));
      await settle();
      expect(viewerArea().innerHTML).not.toMatch(/TRAINER_REJECTED|拒否（エンジン）|エンジンの検査を通りました/);
    }
  });
});
