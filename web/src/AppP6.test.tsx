// 画面全体での P6（エンジン 0.174.0。本人のうらのバトル場のポケモンのにげる。模擬の応答・模擬の描画）。
// 拒否は本人だけに表示・盤面はうらのまま・自動で再送しない、受理のあとは応答と観測から続きの決定へ、閲覧者の切り替えで遅れた応答と古い Canvas を捨てる。
// 形は test/p6.ts（固定版のエンジンの実応答の形）。実エンジンとの確認は server/tests/test_p6.py（構築盤面）と e2e/p6.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, commonRoutes, deferred, inputs, mockRenderer, mockTransport, observation, player, pokemon, view, type Call } from "./test/fixtures";
import { OTHERS_FACE_DOWN_ACTIVE, OWN_FACE_DOWN_ACTIVE, P6_RETREAT, P6_STAGES } from "./test/p6";
import { COVERAGE_MAIN } from "./test/u75fg";
import { submit as envelope } from "./test/u74";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const VALID = { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
const REAL = "PMCG1-054"; // 本人だけが知る本当のカード（イワーク）
const REJECTED = envelope("rejected", { status: "in_progress", diagnostic_id: "diag-p6", category: "invalid_input", message: "にげるのエネルギーが足りない" });

interface World {
  revision: number;
  /** 受理のあと、バトル場が空いて本人の決定待ち（模擬。GUI は応答と観測のまま表示する）。 */
  promote: boolean;
}

function server(world: World, override: (c: Call) => unknown = () => undefined) {
  return mockTransport((c) => {
    const o = override(c);
    if (o !== undefined) return o;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
    const rev = `r${world.revision}`;
    if (type === "view") {
      const p0 = player(0, { handCards: viewer === 0 ? [] : null, active: (world.promote ? null : viewer === 0 ? OWN_FACE_DOWN_ACTIVE : OTHERS_FACE_DOWN_ACTIVE) as never });
      p0.bench = [pokemon(1, "エビワラー", { card_id: "PMCG1-058" }) as never];
      return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), observation(viewer, [p0, player(1, { handCards: viewer === 1 ? [] : null })]));
    }
    if (type === "candidates") {
      if (tok !== "tok0") return candidates(rev, [], { situation: "waiting_for_player", empty_reason: "not_actor", coverage: { ...COVERAGE_MAIN, offered_kinds: [] } });
      if (world.promote) {
        const promote = cand("promote_active", "supported", { id: "c1" });
        return candidates(rev, [promote], { situation: "actor_to_act", coverage: { ...COVERAGE_MAIN, offered_kinds: ["promote_active"] } });
      }
      const end = cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] });
      return candidates(rev, [end, P6_RETREAT], {
        coverage: { ...COVERAGE_MAIN, offered_kinds: ["end_turn", "retreat"], unverified_paths: [{ reason: "face_down_reveal_not_evaluated", candidates: ["c2"] }] },
      });
    }
    if (type === "inputs") return inputs("retreat", P6_STAGES, { candidate: c.body?.candidate });
    if (type === "check") return VALID;
    if (type === "submit") {
      world.revision += 1;
      world.promote = true;
      return envelope("accepted", { status: "awaiting_decision", next: [{ kind: "answer_decision", player: 0 }] });
    }
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
    .getAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head")?.textContent?.includes(label))!;
const groups = (panel: HTMLElement) => within(panel).getAllByRole("group");
const submits = (t: ReturnType<typeof mockTransport>) => t.calls.filter((c) => c.body?.type === "submit");

async function openRetreat(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(item("にげる")).toBeTruthy());
  await user.click(within(item("にげる")).getByRole("button", { name: "この操作を選ぶ" }));
  const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  await user.click(within(groups(panel)[0]!).getByRole("radio", { name: /エビワラー/ }));
  return panel;
}

describe("P6（画面全体）", () => {
  it("拒否: 診断は本人の画面だけ。盤面はうらのまま・自動で再送しない。相手の画面に本人の候補・診断・real が出ない", async () => {
    const world = { revision: 1, promote: false };
    const transport = server(world, (c) => (c.body?.type === "submit" ? REJECTED : undefined));
    const { user, mock } = await start(transport);
    expect(within(viewerArea()).getByLabelText(/バトル場: 裏向きのポケモン/)).toBeInTheDocument(); // 盤面は裏面（real は文字だけ。画像を描かない）
    const panel = await openRetreat(user);
    await user.click(within(groups(panel)[1]!).getAllByRole("checkbox")[0]!);
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    await within(viewerArea()).findByText(/拒否（エンジン）: にげる/);
    expect(viewerArea().textContent).toMatch(/送ったあなたにだけ表示しています/);
    expect(viewerArea().textContent).toMatch(/diag-p6/);
    await settle();
    expect(submits(transport)).toHaveLength(1); // 自動で再送しない
    expect(within(viewerArea()).getByLabelText(/バトル場: 裏向きのポケモン/)).toBeInTheDocument(); // 状態はうらのまま（観測から）
    expect(mock.calls.some((call) => call.cardId === REAL)).toBe(false); // 本人の real も画像にしない
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    await within(viewerArea()).findByLabelText("プレイヤー1の手札");
    await settle();
    expect(viewerArea().innerHTML).not.toMatch(/diag-p6|拒否（エンジン）|イワーク|PMCG1-054|評価していません|うらのバトル場のポケモンのにげる/);
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    await within(viewerArea()).findByText(/観戦者は観測と公開の更新だけ/);
    expect(viewerArea().innerHTML).not.toMatch(/diag-p6|イワーク|PMCG1-054/);
  });

  it("受理: 結果を予告せず、応答と観測から続きの決定（バトル場に出す）へ。古い候補・入力は捨てる", async () => {
    const world = { revision: 1, promote: false };
    const transport = server(world);
    const { user } = await start(transport);
    const panel = await openRetreat(user);
    expect(panel.textContent).not.toMatch(/トラッシュされます|受理されます|バトル場に出す決定/);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理（決定待ち）: にげる/)).toBeInTheDocument();
    expect(viewerArea().textContent).toMatch(/次: あなた（プレイヤー0）の決定への回答/);
    await waitFor(() => expect(item("バトル場に出す")).toBeTruthy());
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(transport.calls.filter((c) => c.body?.type === "submit").map((c) => c.body?.choices)).toEqual([["o1"]]);
  });

  it("閲覧者の切り替え: 遅れた check・submit の答えは相手の画面に出ず、前の閲覧者の Canvas は消える。戻っても入力・検査は残らない", async () => {
    const world = { revision: 1, promote: false };
    const lateCheck = deferred<unknown>();
    const lateSubmit = deferred<unknown>();
    let checks = 0;
    const transport = server(world, (c) => {
      if (c.body?.type === "check") {
        checks += 1;
        return checks === 1 ? lateCheck.promise : undefined;
      }
      return c.body?.type === "submit" ? lateSubmit.promise : undefined;
    });
    const { user, mock } = await start(transport);
    let panel = await openRetreat(user);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await settle();
    const before = mock.calls.slice();
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    for (const call of before) expect(mock.cancelled).toContain(call.canvas);
    lateCheck.resolve(VALID);
    for (const call of before) await act(async () => call.resolve(true));
    await settle();
    const area = viewerArea();
    expect(Array.from(area.querySelectorAll("canvas")).every((c) => !before.some((b) => b.canvas === c))).toBe(true);
    expect(within(area).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(area.innerHTML).not.toMatch(/形の検査を通りました|評価していません|イワーク|PMCG1-054/);
    await user.click(screen.getByRole("radio", { name: "プレイヤー0" }));
    await waitFor(() => expect(item("にげる")).toBeTruthy());
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull(); // 作り直した
    panel = await openRetreat(user);
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled(); // 前の閲覧者のときの check は使わない
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    lateSubmit.resolve(REJECTED);
    await settle();
    expect(viewerArea().innerHTML).not.toMatch(/diag-p6|拒否（エンジン）/);
    expect(submits(transport)).toHaveLength(1);
  });
});
