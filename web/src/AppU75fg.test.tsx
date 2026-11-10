// 画面全体での U7-5f・g（模擬の応答・模擬の描画）: energy2 の遅れた check・閲覧者の切り替え・遅れた submit・FU2 の表示だけ・本人のうらのカードの特殊能力の主体。
// 形は test/u75fg.ts（固定版のエンジン 0.172.0 の実応答の形）。実エンジンとの確認は e2e/u75fg.spec.ts と server/tests/test_u7_5fg.py。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, commonRoutes, deferred, inputs, mockRenderer, mockTransport, observation, player, pokemon, view, type Call } from "./test/fixtures";
import { submit as envelope } from "./test/u74";
import { BLAINE_ATTACH, BLAINE_STAGES, COVERAGE_MAIN, COVERAGE_WAITING_R4, FACE_UP, FACE_UP_STAGES, SPY } from "./test/u75fg";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const VALID = { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };

function server(world: { revision: number }, override: (c: Call) => unknown = () => undefined) {
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
      const p0 = player(0, { handCards: viewer === 0 ? [] : null, active: pokemon(1, "カツラのガーディ", { card_id: "PMCG6-027" }) });
      // 本人の観測にだけ本当のカード（real）がある。相手・観戦者の観測はうらのまま
      p0.bench = [{ pokemon_id: 3, face_down: true, damage: 0, energy: [], ...(viewer === 0 ? { real: { card: 0, card_id: "PMCG2-028" } } : {}) } as never];
      return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), observation(viewer, [p0, player(1, { handCards: viewer === 1 ? [] : null })]));
    }
    if (type === "candidates") {
      if (tok !== "tok0") return candidates(rev, [], { situation: "waiting_for_player", empty_reason: "kinds_not_covered", coverage: COVERAGE_WAITING_R4 });
      const end = cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] });
      return candidates(rev, [end, BLAINE_ATTACH, SPY, FACE_UP], {
        coverage: { ...COVERAGE_MAIN, offered_kinds: ["end_turn", "attach_energy", "use_power", "check_face_up_deck"], unverified_paths: [{ reason: "face_down_reveal_not_evaluated", candidates: ["c5"] }] },
      });
    }
    if (type === "inputs") {
      const id = c.body?.candidate;
      if (id === "c3") return inputs("attach_energy", BLAINE_STAGES, { candidate: id });
      if (id === "c9") return inputs("check_face_up_deck", FACE_UP_STAGES, { candidate: id });
      return inputs("use_power", [], { candidate: id });
    }
    if (type === "check") return VALID;
    if (type === "submit") {
      world.revision += 1;
      return envelope("accepted", { next: [{ kind: "turn_action", player: 0 }] });
    }
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
}

async function start(transport: ReturnType<typeof mockTransport>) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mockRenderer().renderer} />);
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await within(viewerArea()).findByLabelText("プレイヤー0の手札");
  return user;
}

const item = (label: string) =>
  within(viewerArea())
    .getAllByRole("listitem")
    .find((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head")?.textContent?.includes(label))!;
const groups = (panel: HTMLElement) => within(panel).getAllByRole("group");

describe("U7-5f・g（画面全体）", () => {
  it("energy2: 上流を変える前に始めた check の遅れた答えは、元の入力に戻しても使わない", async () => {
    const world = { revision: 1 };
    const late = deferred<unknown>();
    let checks = 0;
    const transport = server(world, (c) => {
      if (c.body?.type !== "check") return undefined;
      checks += 1;
      return checks === 1 ? late.promise : undefined;
    });
    const user = await start(transport);
    await waitFor(() => expect(item("エネルギーをつける")).toBeTruthy());
    await user.click(within(item("エネルギーをつける")).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    const pickAll = async (first: number) => {
      await user.click(within(groups(panel)[0]!).getAllByRole("radio")[first]!);
      await user.click(within(groups(panel)[1]!).getByRole("radio", { name: /PMCG6-027/ }));
      await user.click(within(groups(panel)[2]!).getByRole("radio", { name: /PMCG1-098/ }));
    };
    await pickAll(0); // [o1, o3, o6]
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // 遅れる
    await user.click(within(groups(panel)[0]!).getAllByRole("radio")[1]!); // 1 段目を変える → 2・3 段目と検査の結果を捨てる
    late.resolve(VALID);
    await settle();
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    await user.click(within(groups(panel)[0]!).getAllByRole("radio")[0]!);
    await user.click(within(groups(panel)[1]!).getByRole("radio", { name: /PMCG6-027/ }));
    await user.click(within(groups(panel)[2]!).getByRole("radio", { name: /PMCG1-098/ })); // 元の入力 [o1, o3, o6] に戻す
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull(); // 変える前に始めた答えは使わない
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled(); // 改めて check が要る（GUI の方針）
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    expect(await within(panel).findByText(/エンジンの検査を通りました/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeEnabled();
    expect(transport.calls.filter((c) => c.body?.type === "check").map((c) => c.body?.choices)).toEqual([["o1", "o3", "o6"], ["o1", "o3", "o6"]]);
    expect(transport.calls.filter((c) => c.body?.type === "submit")).toHaveLength(0);
  });

  it("遅れた check・submit の答えは、閲覧者を切り替えたあとの画面に出ない。相手の画面には本人のうらのカードの特殊能力・本人の残りがない", async () => {
    const world = { revision: 1 };
    const lateCheck = deferred<unknown>();
    const lateSubmit = deferred<unknown>();
    const transport = server(world, (c) => (c.body?.type === "check" ? lateCheck.promise : c.body?.type === "submit" ? lateSubmit.promise : undefined));
    const user = await start(transport);
    await waitFor(() => expect(item("特殊能力を使う")).toHaveTextContent("裏向きのポケモン（ベンチ1）・あなただけが知るカード PMCG2-028"));
    await user.click(within(item("特殊能力を使う")).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // choices []（遅れる）
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    lateCheck.resolve(VALID);
    await settle();
    const area = viewerArea();
    expect(await within(area).findByText(/候補がなくても「操作がない」とは言えません/)).toBeInTheDocument();
    expect(within(area).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(area.innerHTML).not.toMatch(/スパイ|PMCG2-028|あなただけが知る|エンジンの検査を通りました/);
    expect(within(area).getByLabelText("当てはまる残り")).toHaveTextContent("R-4（API の対象範囲外・公開の状態から）");
    expect(within(area).getByLabelText("当てはまる残り")).not.toHaveTextContent("R-3");
    // 本人の画面に戻ると、前の選択・検査の答えは残っていない（作り直した）
    await user.click(screen.getByRole("radio", { name: "プレイヤー0" }));
    await waitFor(() => expect(item("特殊能力を使う")).toBeTruthy());
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    // 送信の途中で閲覧者を切り替える: 遅れた受理は相手の画面に出ない
    await user.click(within(item("特殊能力を使う")).getByRole("button", { name: "この操作を選ぶ" }));
    const again = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    const check = transport.calls.filter((c) => c.body?.type === "check").length;
    lateCheck.resolve(VALID);
    await user.click(within(again).getByRole("button", { name: "入力を検査" }));
    await waitFor(() => expect(transport.calls.filter((c) => c.body?.type === "check")).toHaveLength(check + 1));
    await user.click(await within(again).findByRole("button", { name: "送信" }));
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    lateSubmit.resolve(envelope("accepted", { next: [{ kind: "turn_action", player: 0 }] }));
    await settle();
    expect(within(viewerArea()).queryByText(/受理: 特殊能力を使う/)).toBeNull();
    expect(transport.calls.filter((c) => c.body?.type === "submit")).toHaveLength(1); // 自動で送り直さない
  });

  it("FU2: 位置を表示するだけで、check・submit を呼ばない", async () => {
    const transport = server({ revision: 1 });
    const user = await start(transport);
    await waitFor(() => expect(item("表向きの山札のカードを確かめる")).toHaveTextContent("表示だけ（送れません）"));
    await user.click(within(item("表向きの山札のカードを確かめる")).getByRole("button", { name: "位置を表示する（表示だけ）" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^表示だけ/ });
    expect(within(panel).getAllByRole("listitem").map((li) => li.textContent)).toEqual([2, 3, 4, 5].map((n) => expect.stringContaining(`上から ${n} 枚目`)));
    expect(within(panel).queryByRole("button", { name: /送信|入力を検査/ })).toBeNull();
    expect(transport.calls.filter((c) => c.body?.type === "inputs").map((c) => c.body?.candidate)).toEqual(["c9"]);
    expect(transport.calls.filter((c) => c.body?.type === "check" || c.body?.type === "submit")).toHaveLength(0);
    await user.click(within(panel).getByRole("button", { name: "閉じる" }));
    expect(within(viewerArea()).queryByRole("region", { name: /^表示だけ/ })).toBeNull();
  });
});
