// 画面全体での U-R3a（エンジン 0.175.0。本人のうらのカードの 2〜3 段の特殊能力。模擬の応答・模擬の描画）。
// 候補・入力・診断は本人の画面だけ、拒否は自動で再送しない・盤面はうらのまま、受理（使った・トラッシュ）は結果を予告せず応答と観測で表示し、
// おもてにしたカードの画像は観測の card_id が来てから描く。閲覧者の切り替えで遅れた応答と古い Canvas を捨てる。
// 形は test/r3a.ts（固定版のエンジンの実応答の形）。実エンジンとの確認は server/tests/test_r3a.py（構築盤面）と e2e/u-r3a.spec.ts。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type { Candidate, InputStage } from "./api/types";
import { cand, candidates, cardDefinitions, commonRoutes, deferred, ENERGY_RECORD, inputs, mockRenderer, mockTransport, observation, player, pokemon, pokemonRecord, view, type Call } from "./test/fixtures";
import { OTHERS_FACE_DOWN_BENCH, OWN_FACE_DOWN_BENCH, RC_POWER, RC_STAGES, VENUSAUR_POWER, VENUSAUR_STAGES } from "./test/r3a";
import { COVERAGE_MAIN } from "./test/u75fg";
import { submit as envelope } from "./test/u74";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const VALID = { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
const RC = "PMCG4-012";
const VENUSAUR = "PMCG1-011";
const REJECTED = envelope("rejected", { status: "in_progress", diagnostic_id: "WRONG_ENERGY_TYPE", category: "invalid_input", message: "この操作は、今の対戦の状態ではルール上できません。" });
const DEFINITIONS = cardDefinitions([pokemonRecord("PMCG1-058", "エビワラー"), pokemonRecord("PMCG1-060", "コラッタ"), pokemonRecord(RC, "ヒトカゲ"), pokemonRecord(VENUSAUR, "フシギバナ"), ENERGY_RECORD]);

type After = "none" | "used" | "trashed";
interface World {
  revision: number;
  after: After;
  power: Candidate;
  stages: InputStage[];
}

/** 観測（模擬）。受理のあとは、エンジンの実応答と同じ向きの変化（使った: うらのカードがおもてになり炎エネルギーが移る。トラッシュ: うらのカードがいなくなりトラッシュに入る）。 */
function p0Of(world: World, viewer: 0 | 1 | null) {
  const p0 = player(0, { handCards: viewer === 0 ? [] : null, active: pokemon(1, "エビワラー", { card: 0, card_id: "PMCG1-058", energy: [{ card: 1, card_id: "PMCG1-102" }, { card: 2, card_id: "PMCG1-102" }] }) });
  const rattata = (energy: { card: number; card_id: string }[]) => pokemon(2, "コラッタ", { card: 3, card_id: "PMCG1-060", energy });
  if (world.after === "used") {
    p0.bench = [rattata([{ card: 5, card_id: "PMCG1-099" }]), pokemon(4, "ヒトカゲ", { card: 7, card_id: RC, energy: [{ card: 4, card_id: "PMCG1-098" }] })] as never;
  } else if (world.after === "trashed") {
    p0.bench = [rattata([{ card: 4, card_id: "PMCG1-098" }, { card: 5, card_id: "PMCG1-099" }])] as never;
    p0.discard = [{ card: 7, card_id: VENUSAUR }] as never;
  } else {
    const fd = viewer === 0 ? { ...OWN_FACE_DOWN_BENCH, real: { ...OWN_FACE_DOWN_BENCH.real, card_id: world.power.power!.card_id } } : OTHERS_FACE_DOWN_BENCH;
    p0.bench = [rattata([{ card: 4, card_id: "PMCG1-098" }, { card: 5, card_id: "PMCG1-099" }]), fd] as never;
  }
  return p0;
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
    const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
    const rev = `r${world.revision}`;
    if (type === "view") {
      return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), observation(viewer, [p0Of(world, viewer), player(1, { handCards: viewer === 1 ? [] : null })]));
    }
    if (type === "candidates") {
      if (tok !== "tok0") return candidates(rev, [], { situation: "waiting_for_player", empty_reason: "not_actor", coverage: { ...COVERAGE_MAIN, offered_kinds: [] } });
      const end = cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] });
      const list = world.after === "none" ? [end, world.power] : [end];
      return candidates(rev, list, {
        coverage: { ...COVERAGE_MAIN, offered_kinds: list.map((x) => x.kind), unverified_paths: world.after === "none" ? [{ reason: "face_down_reveal_not_evaluated", candidates: ["c4"] }] : [] },
      });
    }
    if (type === "inputs") return inputs("use_power", world.stages, { candidate: c.body?.candidate });
    if (type === "check") return VALID;
    if (type === "submit") {
      world.revision += 1;
      world.after = world.power === RC_POWER ? "used" : "trashed";
      return envelope("accepted", { status: "in_progress", next: [{ kind: "turn_action", player: 0 }] });
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

/** 候補の一覧の項目（特殊能力の名前は項目の本文にある。見出しは「特殊能力を使う」）。 */
const item = (label: string) =>
  within(viewerArea())
    .getAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head") && li.textContent?.includes(label));
const groups = (panel: HTMLElement) => within(panel).getAllByRole("group");
const submits = (t: ReturnType<typeof mockTransport>) => t.calls.filter((c) => c.body?.type === "submit");

/** 本人の画面で特殊能力を選び、段を順に選ぶ（picks は段ごとのラジオの位置）。 */
async function openPower(user: ReturnType<typeof userEvent.setup>, name: string, picks: number[]) {
  await waitFor(() => expect(item(name)).toBeTruthy());
  await user.click(within(item(name)!).getByRole("button", { name: "この操作を選ぶ" }));
  const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
  for (const [i, n] of picks.entries()) await user.click(within(groups(panel)[i]!).getAllByRole("radio")[n]!);
  return panel;
}

describe("U-R3a（画面全体）", () => {
  it("拒否: 診断は本人の画面だけ。盤面はうらのまま・自動で再送しない。相手・観戦者の画面に候補・入力・診断・本当のカードが出ない", async () => {
    const world: World = { revision: 1, after: "none", power: RC_POWER, stages: RC_STAGES };
    const transport = server(world, (c) => (c.body?.type === "submit" ? REJECTED : undefined));
    const { user, mock } = await start(transport);
    expect(within(viewerArea()).getByLabelText(/ベンチ2: 裏向きのポケモン/)).toBeInTheDocument();
    const panel = await openPower(user, "ほのおをもらう", [0, 0]); // エビワラー → 闘エネルギー（形は合う）
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    await within(viewerArea()).findByText(/拒否（エンジン）: 特殊能力を使う/);
    expect(viewerArea().textContent).toMatch(/送ったあなたにだけ表示しています/);
    expect(viewerArea().textContent).toMatch(/WRONG_ENERGY_TYPE/);
    await settle();
    expect(submits(transport)).toHaveLength(1); // 自動で再送しない
    expect(within(viewerArea()).getByLabelText(/ベンチ2: 裏向きのポケモン/)).toBeInTheDocument(); // うらのまま（観測から）
    expect(mock.calls.some((call) => call.cardId === RC)).toBe(false); // 本人の real も画像にしない
    for (const seat of ["プレイヤー1", "観戦者"]) {
      await user.click(screen.getByRole("radio", { name: seat }));
      await settle();
      expect(viewerArea().innerHTML).not.toMatch(/WRONG_ENERGY_TYPE|拒否（エンジン）|ほのおをもらう|ヒトカゲ|PMCG4-012|形の検査を通りました/);
      expect(within(viewerArea()).getByLabelText(/ベンチ2: 裏向きのポケモン/)).toBeInTheDocument();
    }
  });

  it("受理（使った）: 結果を予告せず、応答と観測でおもてのカード・移ったエネルギーを表示し、そのとき初めて画像を描く", async () => {
    const world: World = { revision: 1, after: "none", power: RC_POWER, stages: RC_STAGES };
    const transport = server(world);
    const { user, mock } = await start(transport);
    const panel = await openPower(user, "ほのおをもらう", [1, 0]); // コラッタ → 炎エネルギー
    expect(panel.textContent).not.toMatch(/受理されます|トラッシュされます|使えます/);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    expect(await within(panel).findByText(/特殊能力を使えるか・受理されるか・処理が完了するかは保証しません。送信のあとエンジンが判定します/)).toBeInTheDocument(); // おもてになることを予告しない（21 章）
    expect(mock.calls.some((call) => call.cardId === RC)).toBe(false);
    await user.click(within(panel).getByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理: 特殊能力を使う/)).toBeInTheDocument();
    await waitFor(() => expect(within(viewerArea()).getByLabelText("ベンチ2: ヒトカゲ")).toBeInTheDocument());
    expect(within(viewerArea()).queryByLabelText(/裏向きのポケモン/)).toBeNull();
    await waitFor(() => expect(mock.calls.some((call) => call.cardId === RC)).toBe(true)); // 観測の card_id から描く
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull(); // 古い入力は捨てる
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([["o2", "o5"]]);
  });

  it("受理（トラッシュ）: 3 段を送って受理。観測でうらのポケモンがいなくなりトラッシュにフシギバナ（うらの数の変化で決めず、観測のカードで表示）", async () => {
    const world: World = { revision: 1, after: "none", power: VENUSAUR_POWER, stages: VENUSAUR_STAGES };
    const transport = server(world);
    const { user } = await start(transport);
    const panel = await openPower(user, "エナジートランス", [0, 0, 0]);
    expect(panel.textContent).not.toMatch(/トラッシュされます|たねでない/);
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(await within(viewerArea()).findByText(/受理: 特殊能力を使う/)).toBeInTheDocument();
    await waitFor(() => expect(within(viewerArea()).queryByLabelText(/裏向きのポケモン/)).toBeNull());
    expect(submits(transport).map((c) => c.body?.choices)).toEqual([["o1", "o3", "o7"]]);
    await user.click(screen.getByRole("radio", { name: "観戦者" })); // 公開: 観戦者の観測のトラッシュ
    await waitFor(() => expect(viewerArea().textContent).toMatch(/フシギバナ|PMCG1-011/));
  });

  it("閲覧者の切り替え: 遅れた check・submit の答えは他の画面に出ず、前の閲覧者の Canvas は消える。戻っても入力・検査は残らない", async () => {
    const world: World = { revision: 1, after: "none", power: RC_POWER, stages: RC_STAGES };
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
    let panel = await openPower(user, "ほのおをもらう", [1, 0]);
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
    expect(area.innerHTML).not.toMatch(/形の検査を通りました|ほのおをもらう|PMCG4-012/);
    await user.click(screen.getByRole("radio", { name: "プレイヤー0" }));
    await waitFor(() => expect(item("ほのおをもらう")).toBeTruthy());
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull(); // 作り直した
    panel = await openPower(user, "ほのおをもらう", [1, 0]);
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled(); // 前の閲覧者のときの check は使わない
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    lateSubmit.resolve(REJECTED);
    await settle();
    expect(viewerArea().innerHTML).not.toMatch(/WRONG_ENERGY_TYPE|拒否（エンジン）/);
    expect(submits(transport)).toHaveLength(1);
  });
});
