// 画面全体での 0.181.0（E12 の修正。答えで指定しておもてにした相手のうらのカードが［KEEP］を持つとき、エネルギー・リムーブは内部の例外でなく既存の KP1
// UNRESOLVED_KEEP_PROTECTED_TARGET の通常の拒否になる。模擬の接続層・模擬の描画。応答は test/keep.ts の実応答）。製品のコードは変えていない（既存の拒否の表示・check の門）。
// - KP1 は通常の拒否（未裁定。ゲーム上の禁止ではない）として示し、通信の失敗・処理できない結果（内部エラー）と取り違えない。診断は送った本人の画面だけ。自動で再送しない
// - check の valid を受理の保証として書かない。拒否のあとも同じ決定に答えられ、選び直した入力には前の check の答えを使わない（answer_decision は既存の GUI の決まりで
//   check_before_submit_kinds の外。送信の門は変えていない）
// - 選び直し・遅れた check・閲覧者の切り替えで古い答えを使わない。本人・観戦者の画面に相手のうらの本当のカードの名前・ID・画像を補わない
// 実エンジンとの確かめ（双子・状態・乱数・ログ・決定が変わらないこと・更新）は server/tests/test_keep.py と e2e/keep.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type { SubmitResponse } from "./api/types";
import { needsCheckBeforeSubmit } from "./state/checkGate";
import { summarizeSubmit } from "./state/outcome";
import { cardDefinitions, commonRoutes, deferred, ENERGY_RECORD, mockRenderer, mockTransport, pokemonRecord, TRAINER_RECORD, type Call } from "./test/fixtures";
import {
  KEEP_ACCEPTED,
  KEEP_CANDIDATES,
  KEEP_CANDIDATES_AFTER,
  KEEP_CANDIDATES_AFTER_REJECT,
  KEEP_CHECK_FACE_DOWN,
  KEEP_CHECK_FACE_UP,
  KEEP_FACE_DOWN_OPTION,
  KEEP_FACE_UP_OPTION,
  KEEP_INPUTS,
  KEEP_REAL,
  KEEP_REJECTED,
  KEEP_VIEWS,
  KEEP_VIEWS_AFTER,
} from "./test/keep";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const REAL_IDS = Object.keys(KEEP_REAL);
const SECRETS = new RegExp(Object.entries(KEEP_REAL).flat().join("|"));
// カード定義は相手のうらの本当のカードも含む（定義を知っていても、観測にないものを補わないことを確かめる）
const DEFINITIONS = cardDefinitions([
  pokemonRecord("PMCG1-058", "エビワラー"),
  ...Object.entries(KEEP_REAL).map(([id, name]) => pokemonRecord(id, name)),
  ENERGY_RECORD,
  { ...TRAINER_RECORD, id: "PMCG1-070" },
  { ...TRAINER_RECORD, id: "PMCG5-093" },
]);
const ANSWER = "決定に答える";
const KP1 = "UNRESOLVED_KEEP_PROTECTED_TARGET";
const GUI_PROMISE = /受理されます|受理を保証|完走します|トラッシュされます|おもてになります|場に残ります/;
const MISREAD = /処理できない結果|内部エラー|INTERNAL_ERROR|通信できませんでした|送信の結果が分かりません/;

type Phase = "decision" | "rejected" | "after";

function server(override: (c: Call) => unknown = () => undefined) {
  const world: { phase: Phase } = { phase: "decision" };
  const transport = mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    if (c.path === "/api/card-definitions") return DEFINITIONS;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const views = world.phase === "after" ? KEEP_VIEWS_AFTER : KEEP_VIEWS;
    if (type === "view") {
      if (tok === "tok0") return views[0];
      if (tok === "tok1") return views[1];
      if (tok === "tokH") return { ...views.spectator, viewer: "host" };
      return views.spectator;
    }
    if (type === "candidates") {
      if (tok !== "tok0") return { ...KEEP_CANDIDATES, response: { ...KEEP_CANDIDATES.response, actor: tok === "tok1" ? 1 : null, situation: "waiting_for_player", empty_reason: "not_actor", candidates: [] } };
      return world.phase === "decision" ? KEEP_CANDIDATES : world.phase === "rejected" ? KEEP_CANDIDATES_AFTER_REJECT : KEEP_CANDIDATES_AFTER;
    }
    if (type === "inputs") return { ...KEEP_INPUTS, response: { ...KEEP_INPUTS.response, candidate: c.body?.candidate } };
    if (type === "check") {
      const choices = c.body?.choices as string[];
      return choices[0] === KEEP_FACE_DOWN_OPTION ? KEEP_CHECK_FACE_DOWN : KEEP_CHECK_FACE_UP;
    }
    if (type === "submit") {
      const choices = c.body?.choices as string[];
      if (choices[0] === KEEP_FACE_DOWN_OPTION) {
        world.phase = "rejected"; // 拒否: 状態は変わらない（候補は取り直すと新しい取っ手になる。エンジンの実応答のとおり）
        return KEEP_REJECTED;
      }
      world.phase = "after";
      return KEEP_ACCEPTED;
    }
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
  return transport;
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
const radio = (panel: HTMLElement, id: string) => within(panel).getByRole("radio", { name: new RegExp(`${id}#\\d+$`) }); // ラベルは「カード ID・選べるものの id・#カードの番号」が続く

async function openAnswer(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(item(ANSWER)).toBeTruthy());
  await user.click(within(item(ANSWER)!).getByRole("button", { name: "この操作を選ぶ" }));
  return within(viewerArea()).findByRole("region", { name: /^入力/ });
}

async function checkAndWait(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement) {
  await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
  await within(panel).findByText(/エンジンの検査を通りました/);
}

/** 本人の画面の GUI の文（エンジンの保証文の details を除く）。 */
function guiText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

describe("0.181.0 の KP1（実応答の表示の区分）", () => {
  it("KP1 の拒否は通常の拒否（未裁定・ゲーム上の禁止ではない・本人だけ）で、処理できない結果・通信の失敗の文にならない", () => {
    const summary = summarizeSubmit(KEEP_REJECTED as unknown as SubmitResponse, "answer_decision", 0);
    expect(summary.tone).toBe("warn");
    expect(summary.title).toBe("拒否（エンジン）: 決定に答える");
    const text = summary.lines.join("\n");
    expect(text).toContain("エンジンが受け付けませんでした（状態は変わりません）。");
    expect(text).toContain("送ったあなたにだけ表示しています");
    expect(text).toContain("区分: 未裁定（ゲーム上の禁止ではありません）");
    expect(text).toContain(`診断: ${KP1}`);
    expect(text).toContain(KEEP_REJECTED.result.message); // エンジンの文をそのまま（本当のカードを書かない）
    expect(`${summary.title}\n${text}`).not.toMatch(MISREAD);
    expect(text).not.toMatch(SECRETS);
  });

  it("answer_decision は既存の GUI の決まりで check_before_submit_kinds の外（送信は check で止めない）。0.181.0 でも変えない（KP1 は check の valid で予告できない）", () => {
    const answer = KEEP_CANDIDATES.response.candidates.find((c) => c.kind === "answer_decision")!;
    expect(needsCheckBeforeSubmit(answer as Parameters<typeof needsCheckBeforeSubmit>[0])).toBe(false);
    expect(answer.guarantees.acceptance).toMatch(/^保証しない/); // エンジンの保証文: 候補・check は受理の保証ではない
  });
});

describe("0.181.0 の KP1（画面全体）", () => {
  it("check valid → KP1 の拒否（本人だけ・自動で再送しない）→ 同じ決定で選び直し → その入力の check → 受理", async () => {
    const transport = server();
    const { user } = await start(transport);
    let panel = await openAnswer(user);
    await user.click(radio(panel, KEEP_FACE_DOWN_OPTION));
    expect(checks(transport)).toHaveLength(0); // check を自動で呼ばない
    await checkAndWait(user, panel);
    expect(within(panel).getByText(/エンジンの検査を通りました/)).toHaveTextContent("受理・完走の保証ではありません"); // 既存の文（受理の保証として書かない）
    expect(guiText(viewerArea())).not.toMatch(GUI_PROMISE);
    await user.click(sendButton(panel));
    const notice = (await within(viewerArea()).findByText("拒否（エンジン）: 決定に答える")).closest("[role]") ?? viewerArea();
    expect(viewerArea().textContent).toMatch(/送ったあなたにだけ表示しています/);
    expect(viewerArea().textContent).toContain(`診断: ${KP1}`);
    expect(viewerArea().textContent).toContain("区分: 未裁定（ゲーム上の禁止ではありません）");
    expect(notice.textContent ?? "").not.toMatch(MISREAD);
    await settle();
    expect(submits(transport)).toHaveLength(1); // 自動で再送しない
    // 拒否のあとも同じ決定に答えられる（取り直した候補は新しい取っ手なので、前の選択・check は使わない）
    panel = await openAnswer(user);
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull(); // 前の取っ手・入力の check の答えを置かない
    await user.click(radio(panel, KEEP_FACE_UP_OPTION));
    await checkAndWait(user, panel); // 選び直した入力への check
    expect(checks(transport).map((c) => c.body?.choices)).toEqual([[KEEP_FACE_DOWN_OPTION], [KEEP_FACE_UP_OPTION]]);
    await user.click(sendButton(panel));
    expect(await within(viewerArea()).findByText(/受理: 決定に答える/)).toBeInTheDocument();
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([[KEEP_FACE_DOWN_OPTION], [KEEP_FACE_UP_OPTION]]);
    expect(viewerArea().textContent).not.toMatch(SECRETS);
  });

  it("選び直すと check の答えを捨て、元の入力に戻しても、変える前に始めた遅れた check の答えを置かない。別の選択には前の答えを使わない", async () => {
    const late = deferred<unknown>();
    let n = 0;
    const transport = server((c) => {
      if (c.body?.type !== "check") return undefined;
      n += 1;
      return n === 1 ? late.promise : undefined;
    });
    const { user } = await start(transport);
    const panel = await openAnswer(user);
    await user.click(radio(panel, KEEP_FACE_DOWN_OPTION));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await user.click(radio(panel, KEEP_FACE_UP_OPTION));
    await user.click(radio(panel, KEEP_FACE_DOWN_OPTION)); // 元の入力に戻す
    late.resolve(KEEP_CHECK_FACE_DOWN);
    await settle();
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull(); // 遅れた答えは今の入力に使わない
    await checkAndWait(user, panel);
    expect(checks(transport).map((c) => c.body?.choices)).toEqual([[KEEP_FACE_DOWN_OPTION], [KEEP_FACE_DOWN_OPTION]]);
    await user.click(radio(panel, KEEP_FACE_UP_OPTION)); // 別の選択: 前の入力への答えを捨てる（その入力の check は改めて呼ぶ）
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    await checkAndWait(user, panel);
    expect(checks(transport).at(-1)?.body?.choices).toEqual([KEEP_FACE_UP_OPTION]);
    expect(submits(transport)).toHaveLength(0); // check で送信しない
  });

  it("相手・観戦者: 本人の診断・入力・遅れた check を出さない。本人・観戦者の画面に相手のうらの本当のカードの名前・ID・画像を補わない", async () => {
    const late = deferred<unknown>();
    const transport = server((c) => (c.body?.type === "check" ? late.promise : undefined));
    const { user, mock } = await start(transport);
    expect(viewerArea().textContent).not.toMatch(SECRETS);
    expect(within(viewerArea()).getAllByLabelText(/裏向きのポケモン/).length).toBeGreaterThan(0);
    expect(mock.calls.some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false);
    const panel = await openAnswer(user);
    await user.click(radio(panel, KEEP_FACE_DOWN_OPTION));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    for (const seat of ["プレイヤー1", "観戦者"]) {
      const before = mock.calls.length;
      await user.click(screen.getByRole("radio", { name: seat }));
      if (seat === "プレイヤー1") late.resolve(KEEP_CHECK_FACE_DOWN);
      await settle();
      expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
      expect(viewerArea().innerHTML).not.toMatch(/検査を通りました|UNRESOLVED_KEEP_PROTECTED_TARGET|拒否（エンジン）/);
      expect(item(ANSWER)).toBeUndefined();
      if (seat === "観戦者") {
        expect(viewerArea().textContent).not.toMatch(SECRETS);
        expect(mock.calls.slice(before).some((call) => call.cardId !== null && REAL_IDS.includes(call.cardId))).toBe(false);
      }
    }
    expect(submits(transport)).toHaveLength(0);
  });

  it("拒否の診断は相手・観戦者の画面に出ない（拒否で更新を作らない）", async () => {
    const transport = server();
    const { user } = await start(transport);
    const panel = await openAnswer(user);
    await user.click(radio(panel, KEEP_FACE_DOWN_OPTION));
    await checkAndWait(user, panel);
    await user.click(sendButton(panel));
    await within(viewerArea()).findByText("拒否（エンジン）: 決定に答える");
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await user.click(screen.getByRole("radio", { name: seat }));
      await settle();
      expect(viewerArea().innerHTML).not.toMatch(/UNRESOLVED_KEEP_PROTECTED_TARGET|拒否（エンジン）|検査を通りました/);
    }
    expect(submits(transport)).toHaveLength(1);
  });
});
