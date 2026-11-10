// 画面全体での UP-5t-C1（エンジン 0.178.0。相手のバトル場がうらのときの［くさいかふん］の候補が unverified。模擬の接続層・模擬の描画。応答の形は test/up5t.ts の実応答）。
// 使う人（プレイヤー 1）の画面だけに候補・入力・検査・診断。相手のバトル場は公開の位置と裏向きだけ（本当のカードの ID・名前・画像を補わない）。相手本人（プレイヤー 0）の画面には
// 本人の知識（real）がある。check は今の主体・取っ手・候補・入力への答えだけを使い、閲覧者の切り替え・候補の選び直しで捨てる。拒否は本人だけに示し、自動で再送しない。
// 受理のあとは結果を予告せず、応答と観測で表示する。実エンジンとの確認は server/tests/test_up5t_c1.py と e2e/up5t-c1.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { candidates, cardDefinitions, commonRoutes, deferred, ENERGY_RECORD, mockRenderer, mockTransport, pokemonRecord, type Call } from "./test/fixtures";
import { submit as envelope } from "./test/u74";
import { UP5T_CANDIDATES_FACE_DOWN, UP5T_CANDIDATES_FACE_UP, UP5T_CHECK_FACE_DOWN, UP5T_INPUTS_FACE_DOWN, UP5T_REALS, UP5T_VIEWS_FACE_DOWN, UP5T_VIEWS_FACE_UP } from "./test/up5t";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const REAL_IDS = Object.keys(UP5T_REALS);
const REALS = new RegExp(Object.entries(UP5T_REALS).flat().join("|"));
// カード定義は本当のカードも含む（定義を知っていても、観測にないものを補わないことを確かめる）
const DEFINITIONS = cardDefinitions([pokemonRecord("PMCG1-058", "エビワラー"), pokemonRecord("PMCG4-006", "わるいクサイハナ"), ...Object.entries(UP5T_REALS).map(([id, name]) => pokemonRecord(id, name)), ENERGY_RECORD]);
const REJECTED = envelope("rejected", { status: "in_progress", diagnostic_id: "POWER_ALREADY_USED", category: "invalid_input", message: "この操作は、今の対戦の状態ではルール上できません。" });

interface World {
  faceUp: boolean;
}

function server(world: World, override: (c: Call) => unknown = () => undefined) {
  return mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    if (c.path === "/api/card-definitions") return DEFINITIONS;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const views = world.faceUp ? UP5T_VIEWS_FACE_UP : UP5T_VIEWS_FACE_DOWN;
    if (type === "view") {
      if (tok === "tok0") return views[0];
      if (tok === "tok1") return views[1];
      if (tok === "tokH") return { ...views.spectator, viewer: "host" };
      return views.spectator;
    }
    if (type === "candidates") {
      if (tok !== "tok1") return candidates("r1", [], { situation: "waiting_for_player", empty_reason: "not_actor", coverage: { ...UP5T_CANDIDATES_FACE_DOWN.response.coverage, offered_kinds: [], unverified_paths: [] } });
      return world.faceUp ? UP5T_CANDIDATES_FACE_UP : UP5T_CANDIDATES_FACE_DOWN;
    }
    if (type === "inputs") return { ...UP5T_INPUTS_FACE_DOWN, response: { ...UP5T_INPUTS_FACE_DOWN.response, candidate: c.body?.candidate } };
    if (type === "check") return UP5T_CHECK_FACE_DOWN;
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
  await waitFor(() => expect(item("くさいかふん")).toBeTruthy());
}

async function openPower(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(item("くさいかふん")!).getByRole("button", { name: "この操作を選ぶ" }));
  return within(viewerArea()).findByRole("region", { name: /^入力/ });
}

describe("UP-5t-C1（画面全体）", () => {
  it("うら: 使う人の画面は未確認と理由、盤面は裏向きだけ。check の前は送れず、今の check のあとだけ送る。受理は応答で表示する", async () => {
    const transport = server({ faceUp: false });
    const { user, mock } = await start(transport);
    await asUser(user);
    expect(item("くさいかふん")).toHaveTextContent("未確認");
    expect(item("くさいかふん")).toHaveTextContent("うらのカードの本当のカードでは確かめていない");
    expect(within(viewerArea()).getByLabelText(/バトル場: 裏向きのポケモン/)).toBeInTheDocument(); // 相手のバトル場（公開の位置と裏向き）
    expect(viewerArea().textContent).not.toMatch(REALS);
    const panel = await openPower(user);
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(panel.textContent).not.toMatch(/受理されます|完走します|使えます|おもてになります|トラッシュされます/);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    expect(checks(transport).map((c) => c.body?.choices)).toEqual([[]]);
    expect(await within(panel).findByText(/エンジンの検査を通りました/)).toHaveTextContent("受理・完走の保証ではありません");
    await user.click(within(panel).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理: 特殊能力を使う/)).toBeInTheDocument();
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([[]]);
    expect(mock.calls.some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false); // 本当のカードの画像を描かない
  });

  it("おもての対照: 同じ候補は「送れる（後で止まりうる）」でうらの理由はない。check の門は同じ", async () => {
    const transport = server({ faceUp: true });
    const { user } = await start(transport);
    await asUser(user);
    expect(item("くさいかふん")).toHaveTextContent("送れる（後で止まりうる）");
    const shown = item("くさいかふん")!.cloneNode(true) as HTMLElement;
    shown.querySelectorAll("details").forEach((d) => d.remove()); // エンジンの保証文（説明のまま表示）を除いた GUI の表示
    expect(shown.textContent).not.toMatch(/未確認|うらのカードの本当のカードでは確かめていない/);
    const panel = await openPower(user);
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
  });

  it("相手本人（プレイヤー 0）の画面には本人の知識（real）があり、使う人の候補はない。観戦者の画面には本当のカードも使う人の候補もない", async () => {
    const transport = server({ faceUp: false });
    const { user, mock } = await start(transport);
    await waitFor(() => expect(viewerArea().textContent).toMatch(/あなたにだけ見えるカード: コラッタ/));
    expect(item("くさいかふん")).toBeUndefined();
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    await settle();
    expect(viewerArea().textContent).not.toMatch(REALS);
    expect(item("くさいかふん")).toBeUndefined();
    expect(within(viewerArea()).getByLabelText(/バトル場: 裏向きのポケモン/)).toBeInTheDocument();
    expect(mock.calls.some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false);
  });

  it("閲覧者の切り替え・候補の選び直しで、古い check の答えを使わない（遅れた答えも置かない）", async () => {
    const late = deferred<unknown>();
    let n = 0;
    const transport = server({ faceUp: false }, (c) => {
      if (c.body?.type !== "check") return undefined;
      n += 1;
      return n === 1 ? late.promise : undefined;
    });
    const { user } = await start(transport);
    await asUser(user);
    let panel = await openPower(user);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    late.resolve(UP5T_CHECK_FACE_DOWN);
    await settle();
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(viewerArea().innerHTML).not.toMatch(/エンジンの検査を通りました|くさいかふん/);
    await asUser(user);
    panel = await openPower(user);
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled(); // 前の閲覧者のときの check は使わない
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(within(panel).getByRole("button", { name: "送信" })).toBeEnabled());
    await user.click(within(panel).getByRole("button", { name: "やめる" }));
    panel = await openPower(user); // 候補を選び直す（新しい選択）
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    expect(submits(transport)).toHaveLength(0);
  });

  it("拒否: 診断は送った本人の画面だけ。自動で再送しない。相手・観戦者の画面に出ない", async () => {
    const transport = server({ faceUp: false }, (c) => (c.body?.type === "submit" ? REJECTED : undefined));
    const { user } = await start(transport);
    await asUser(user);
    const panel = await openPower(user);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    await within(viewerArea()).findByText(/拒否（エンジン）: 特殊能力を使う/);
    expect(viewerArea().textContent).toMatch(/送ったあなたにだけ表示しています/);
    await settle();
    expect(submits(transport)).toHaveLength(1);
    for (const seat of ["プレイヤー0", "観戦者"]) {
      await user.click(screen.getByRole("radio", { name: seat }));
      await settle();
      expect(viewerArea().innerHTML).not.toMatch(/POWER_ALREADY_USED|拒否（エンジン）|エンジンの検査を通りました/);
    }
  });
});
