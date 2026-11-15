// 画面全体での F-1（エンジン 0.180.0。本人のうらのバトル場のポケモンのワザの候補だけに、実装に合う保証の文が付く。模擬の接続層・模擬の描画。応答の形は test/f1.ts の実応答）。
// 本人（プレイヤー 0）の画面だけに候補・入力・検査・診断。相手・観戦者の画面ではバトル場は公開の位置と裏向きだけ（本当のカードの ID・名前・ワザ・画像を補わない）。
// check は今の主体・取っ手・候補・入力への答えだけを使い、ワザの選び直し・元の入力への戻り・閲覧者の切り替えで捨てる。check の文は形の検査だけ（エネルギー・受理・完走の保証ではない）。
// 拒否は本人だけに示し、自動で再送しない。受理・おもてにすることを送る前に予告しない。実エンジンとの確かめは server/tests/test_f1.py と e2e/f1.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { candidates, cardDefinitions, commonRoutes, deferred, ENERGY_RECORD, mockRenderer, mockTransport, pokemonRecord, type Call } from "./test/fixtures";
import { F1_CANDIDATES, F1_CHECK, F1_INPUTS, F1_REAL_ATTACKS, F1_REALS, F1_VIEWS } from "./test/f1";
import { submit as envelope } from "./test/u74";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const REAL_IDS = Object.keys(F1_REALS);
const SECRETS = new RegExp([...Object.entries(F1_REALS).flat(), ...F1_REAL_ATTACKS].join("|"));
// カード定義は本当のカードも含む（定義を知っていても、観測にないものを補わないことを確かめる）
const DEFINITIONS = cardDefinitions([pokemonRecord("PMCG1-058", "エビワラー"), ...Object.entries(F1_REALS).map(([id, name]) => pokemonRecord(id, name)), ENERGY_RECORD]);
const REJECTED = envelope("rejected", { status: "in_progress", diagnostic_id: "INSUFFICIENT_ENERGY", category: "invalid_input", message: "この操作は、今の対戦の状態ではルール上できません。" });
const ATTACK = "ワザを使う";
const GUI_PROMISE = /受理されます|完走します|使えます|エネルギーが足ります|足りています|おもてになります|おもてにしてから|場に残ります|トラッシュされます/;

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
      if (tok === "tok0") return F1_VIEWS[0];
      if (tok === "tok1") return F1_VIEWS[1];
      if (tok === "tokH") return { ...F1_VIEWS.spectator, viewer: "host" };
      return F1_VIEWS.spectator;
    }
    if (type === "candidates") {
      if (tok !== "tok0") return candidates("r1", [], { situation: "waiting_for_player", empty_reason: "not_actor", coverage: { ...F1_CANDIDATES.response.coverage, offered_kinds: [], unverified_paths: [] } });
      return F1_CANDIDATES;
    }
    if (type === "inputs") return { ...F1_INPUTS, response: { ...F1_INPUTS.response, candidate: c.body?.candidate } };
    if (type === "check") return F1_CHECK;
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
const sendButton = (panel: HTMLElement) => within(panel).getByRole("button", { name: "送信" });

async function openAttack(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(item(ATTACK)).toBeTruthy());
  await user.click(within(item(ATTACK)!).getByRole("button", { name: "この操作を選ぶ" }));
  return within(viewerArea()).findByRole("region", { name: /^入力/ });
}

const radio = (panel: HTMLElement, name: string) => within(panel).getByRole("radio", { name: new RegExp(name) });

/** 本人の画面の GUI の文（エンジンの保証文の details を除く）。 */
function guiText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

describe("F-1（画面全体）", () => {
  it("本人: 候補は「未確認」、エンジンの保証文は説明の中。ワザを選び、形の check のあとに送る。送る前に受理・おもてにすることを予告しない", async () => {
    const transport = server();
    const { user } = await start(transport);
    expect(item(ATTACK)).toHaveTextContent("未確認");
    expect(item(ATTACK)!.querySelector("details")).toHaveTextContent("check が valid でも、エンジンの確かめを通したことを意味しない"); // エンジンの文（表示だけ）
    const panel = await openAttack(user);
    await user.click(radio(panel, "かたくなる"));
    expect(sendButton(panel)).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    expect(checks(transport).map((c) => c.body?.choices)).toEqual([["o2"]]);
    expect(await within(panel).findByText(/エンジンの形の検査を通りました/)).toHaveTextContent("必要なエネルギーが足りるか・ワザを使えるか・受理・完走の保証ではありません");
    expect(guiText(viewerArea())).not.toMatch(GUI_PROMISE);
    await user.click(sendButton(panel));
    expect(await within(viewerArea()).findByText(/受理: ワザを使う/)).toBeInTheDocument(); // 結果は応答のとおり
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([["o2"]]);
  });

  it("ワザを選び直すと check の答えを捨て、元の入力に戻しても、変える前に始めた遅れた check では送れない", async () => {
    const late = deferred<unknown>();
    let n = 0;
    const transport = server((c) => {
      if (c.body?.type !== "check") return undefined;
      n += 1;
      return n === 1 ? late.promise : undefined;
    });
    const { user } = await start(transport);
    const panel = await openAttack(user);
    await user.click(radio(panel, "いわおとし"));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await user.click(radio(panel, "かたくなる"));
    await user.click(radio(panel, "いわおとし")); // 元の入力に戻す
    late.resolve(F1_CHECK);
    await settle();
    expect(within(panel).queryByText(/形の検査を通りました/)).toBeNull();
    expect(sendButton(panel)).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(sendButton(panel)).toBeEnabled());
    await user.click(radio(panel, "かたくなる"));
    expect(sendButton(panel)).toBeDisabled();
    expect(submits(transport)).toHaveLength(0);
  });

  it("相手・観戦者: 本当のカード・ワザの名前・画像を補わず、本人のワザの候補もない。閲覧者の切り替えで遅れた check を置かない", async () => {
    const late = deferred<unknown>();
    const transport = server((c) => (c.body?.type === "check" ? late.promise : undefined));
    const { user, mock } = await start(transport);
    await waitFor(() => expect(viewerArea().textContent).toMatch(/あなたにだけ見えるカード: イワーク/)); // 本人の知識（real）
    const panel = await openAttack(user);
    await user.click(radio(panel, "いわおとし"));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    for (const seat of ["プレイヤー1", "観戦者"]) {
      const before = mock.calls.length;
      await user.click(screen.getByRole("radio", { name: seat }));
      if (seat === "プレイヤー1") late.resolve(F1_CHECK);
      await settle();
      expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
      expect(viewerArea().innerHTML).not.toMatch(/形の検査を通りました|あなただけが知る|あなたにだけ見える/);
      expect(viewerArea().textContent).not.toMatch(SECRETS);
      expect(item(ATTACK)).toBeUndefined();
      expect(within(viewerArea()).getAllByLabelText(/バトル場: 裏向きのポケモン/).length).toBeGreaterThan(0);
      expect(mock.calls.slice(before).some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false); // 本当のカードの画像を描かない
    }
    expect(submits(transport)).toHaveLength(0);
  });

  it("拒否: 診断は送った本人の画面だけ。自動で再送しない。相手・観戦者の画面に出ない", async () => {
    const transport = server((c) => (c.body?.type === "submit" ? REJECTED : undefined));
    const { user } = await start(transport);
    const panel = await openAttack(user);
    await user.click(radio(panel, "かたくなる"));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(sendButton(panel)).toBeEnabled());
    await user.click(sendButton(panel));
    await within(viewerArea()).findByText(/拒否（エンジン）: ワザを使う/);
    expect(viewerArea().textContent).toMatch(/送ったあなたにだけ表示しています/);
    await settle();
    expect(submits(transport)).toHaveLength(1);
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await user.click(screen.getByRole("radio", { name: seat }));
      await settle();
      expect(viewerArea().innerHTML).not.toMatch(/INSUFFICIENT_ENERGY|拒否（エンジン）|形の検査を通りました/);
    }
  });
});
