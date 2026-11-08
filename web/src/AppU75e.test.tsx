// 画面全体での U7-5e の特殊能力（模擬の応答・模擬の描画）: 同じ種類の候補を id で選ぶ・公開カード定義の説明・遅れた check・主体の切り替え・受理のあとの取り直し。
// 形は test/u75e.ts（固定版のエンジン 0.171.0 の実応答の形）。実エンジンとの確認は e2e/u75e.spec.ts と server/tests/test_u7_5e.py。
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { cand, candidates, cardDefinitions, commonRoutes, deferred, inputs, mockRenderer, mockTransport, observation, player, pokemon, pokemonRecord, view, type Call } from "./test/fixtures";
import { submit as envelope } from "./test/u74";
import { TRANS, TRANS_TWO_SOURCES_STAGES, power } from "./test/u75e";

const tokenOf = (c: Call) => c.path.split("/")[3];
const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const BENCH_POWER = power("c7", "エナジートランス", { pokemon: 2, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-011" }, 3);
const TEXT = "自分の番に何回でも、自分の場のポケモンについている草エネルギーを 1 枚、別の自分のポケモンにつけかえてよい。";

function server(world: { accepted: boolean; revision: number }, override: (c: Call) => unknown = () => undefined) {
  return mockTransport((c) => {
    if (c.path === "/api/card-definitions") {
      return cardDefinitions([pokemonRecord("PMCG1-011", "フシギバナ", { powers: [{ kind: "pokemon_power", name: { ja: "エナジートランス", en: null }, text: { ja: TEXT, en: null } }] }), pokemonRecord("PMCG1-001", "フシギダネ")]);
    }
    const o = override(c);
    if (o !== undefined) return o;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
    const rev = `r${world.revision}`;
    if (type === "view") {
      const p0 = player(0, { handCards: viewer === 0 ? [] : null, active: pokemon(1, "フシギバナ", { card_id: "PMCG1-011" }) });
      p0.bench = [pokemon(2, "フシギダネ", { card_id: "PMCG1-001" }) as never];
      return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), observation(viewer, [p0, player(1, { handCards: viewer === 1 ? [] : null })]));
    }
    if (type === "candidates") {
      if (tok !== "tok0") return candidates(rev, [], { situation: "waiting_for_player", empty_reason: "not_actor" });
      const end = cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] });
      return candidates(rev, world.accepted ? [end] : [end, TRANS, BENCH_POWER]);
    }
    if (type === "inputs") return inputs("use_power", TRANS_TWO_SOURCES_STAGES, { candidate: c.body?.candidate });
    if (type === "check") return { contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false };
    if (type === "submit") {
      world.revision += 1;
      world.accepted = true;
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

const powerItems = () =>
  within(viewerArea())
    .getAllByRole("listitem")
    .filter((li) => li.closest(".candidate-list") && li.querySelector(".candidate-head")?.textContent?.includes("特殊能力を使う"));

describe("U7-5e の特殊能力（画面全体）", () => {
  it("同じ種類の 2 つの候補から id で選び、説明は公開カード定義から。3 段を選んで check → 送信 → 受理で取り直す", async () => {
    const world = { accepted: false, revision: 1 };
    const transport = server(world);
    const user = await start(transport);
    await waitFor(() => expect(powerItems()).toHaveLength(2));
    await user.click(within(powerItems()[1]!).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    expect(transport.calls.filter((c) => c.body?.type === "inputs").map((c) => c.body?.candidate)).toEqual(["c7"]); // 種類でなく候補の id
    await waitFor(() => expect(within(panel).getByLabelText("特殊能力")).toHaveTextContent(TEXT));
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-011（自分のバトル場）/ }));
    await user.click(within(panel).getAllByRole("radio", { name: /草エネルギー|PMCG1-097/ })[0]!);
    await user.click(within(within(panel).getAllByRole("group")[2]!).getByRole("radio", { name: /PMCG1-001（自分のベンチ1）/ }));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" }));
    await user.click(await within(panel).findByRole("button", { name: "送信" }));
    expect(transport.calls.filter((c) => c.body?.type === "submit").map((c) => [c.body?.candidate, c.body?.choices])).toEqual([["c7", ["o1", "o3", "o6"]]]);
    expect(await within(viewerArea()).findByText("受理: 特殊能力を使う")).toBeInTheDocument();
    await waitFor(() => expect(powerItems()).toHaveLength(0)); // 取り直した候補（エンジンが出さなければ出ない）
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
  });

  it("遅れて届いた check は、前の段を変えたあとの入力に使わない。閲覧者を切り替えると入力は残らない", async () => {
    const world = { accepted: false, revision: 1 };
    const late = deferred<unknown>();
    let checks = 0;
    const transport = server(world, (c) => {
      if (c.body?.type !== "check") return undefined;
      checks += 1;
      return checks === 1 ? late.promise : undefined;
    });
    const user = await start(transport);
    await waitFor(() => expect(powerItems()).toHaveLength(2));
    await user.click(within(powerItems()[0]!).getByRole("button", { name: "この操作を選ぶ" }));
    const panel = await within(viewerArea()).findByRole("region", { name: /^入力/ });
    await user.click(within(panel).getByRole("radio", { name: /PMCG1-011（自分のバトル場）/ }));
    await user.click(within(panel).getAllByRole("radio", { name: /PMCG1-097/ })[0]!);
    await user.click(within(within(panel).getAllByRole("group")[2]!).getByRole("radio", { name: /PMCG1-001（自分のベンチ1）/ }));
    await user.click(within(panel).getByRole("button", { name: "入力を検査" })); // [o1, o3, o6]（遅れる）
    await user.click(within(panel).getAllByRole("radio", { name: /PMCG1-097/ })[1]!); // 2 段目を変える → 3 段目は捨てる
    late.resolve({ contract: "kyuura-client-api", format: 1, type: "check", ok: true, response: { valid: true, refusal: null }, refetch_required: false });
    await settle();
    expect(within(panel).queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(within(panel).getByRole("button", { name: "送信" })).toBeDisabled();
    // 相手の画面: 候補・入力・特殊能力の入力は出ない
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    expect(await within(viewerArea()).findByText(/ほかのプレイヤーの操作待ち/)).toBeInTheDocument();
    expect(within(viewerArea()).queryByRole("region", { name: /^入力/ })).toBeNull();
    expect(viewerArea().innerHTML).not.toMatch(/エナジートランス|元のポケモン/);
    expect(transport.calls.filter((c) => c.body?.type === "submit")).toHaveLength(0);
  });
});
