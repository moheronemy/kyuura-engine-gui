// 画面全体の振る舞い（模擬の応答。実エンジンとの確認は e2e/ と server/tests/）。
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { NetworkError } from "./api/transport";
import { candidates, cand, commonRoutes, deferred, inputs, mockRenderer, mockTransport, observation, player, pokemon, submitResult, view, type Call } from "./test/fixtures";

const HAND0 = [{ card: 2, card_id: "PMCG1-058" }];
const HAND1 = [{ card: 77, card_id: "SECRET-1" }];

function obsFor(viewer: 0 | 1 | null) {
  return observation(viewer, [
    player(0, { handCards: viewer === 0 ? HAND0 : null, active: pokemon(1, "エビワラー") }),
    player(1, { handCards: viewer === 1 ? HAND1 : null, active: { face_down: true } }),
  ]);
}

const tokenOf = (c: Call) => c.path.split("/")[3];

/** 既定の模擬の接続層。overrides で入口・種類ごとに差し替える。 */
function server(overrides: (c: Call) => unknown | undefined = () => undefined) {
  return mockTransport((c) => {
    const o = overrides(c);
    if (o !== undefined) return o;
    const common = commonRoutes(c);
    if (common !== undefined) return common;
    const type = c.body?.type;
    const tok = tokenOf(c);
    const viewer = tok === "tok0" ? 0 : tok === "tok1" ? 1 : null;
    if (type === "view") return view(tok === "tokS" ? "spectator" : tok === "tokH" ? "host" : (viewer as 0 | 1), obsFor(viewer));
    if (type === "candidates") return candidates("r1", tok === "tok0" ? [cand("end_turn", "may_stop_later", { input_disclosure: "no_input", input_stages: [] })] : []);
    if (type === "inputs") return inputs("end_turn", []);
    if (type === "submit") return submitResult("accepted");
    throw new Error(`想定外 ${c.path} ${String(type)}`);
  });
}

async function startGame(transport: ReturnType<typeof server>) {
  const user = userEvent.setup();
  render(<App transport={transport} cardRenderer={mockRenderer().renderer} />); // jsdom には Canvas 2D がないので模擬の描画
  const create = await screen.findByRole("button", { name: /対戦を作成/ });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await screen.findByRole("heading", { name: "表示する閲覧者（ローカルの切り替え）" });
  return user;
}

const viewerArea = () => document.querySelector(".viewer-area") as HTMLElement;
const hostArea = () => document.querySelector(".host-area") as HTMLElement;

describe("観測の表示", () => {
  it("自分の手札・相手の枚数・HP・ダメージ・状態・裏向き・未対応の操作", async () => {
    await startGame(server());
    const area = viewerArea();
    expect(await within(area).findByLabelText("プレイヤー0の手札")).toHaveTextContent("エビワラー");
    expect(within(area).getByText("50/70")).toBeInTheDocument();
    expect(within(area).getByText(/状態: poisoned/)).toBeInTheDocument();
    expect(within(area).getByText("裏向きのポケモン")).toBeInTheDocument();
    expect(within(area).getByText(/この閲覧者には中身が見えません/)).toBeInTheDocument();
    expect(within(area).getByText("山札 41")).toBeInTheDocument();
    // coverage: partial と未対応の種類。complete を「全合法手」とは書かない
    const unsupported = within(area).getByLabelText("未対応の操作");
    expect(unsupported).toHaveTextContent("ワザを使う");
    expect(unsupported).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(within(area).getByText(/部分実装です/)).toBeInTheDocument();
    // ホストの別枠は観戦者と同じ範囲（手札なし）で、プレイヤーの候補を出さない
    expect(within(hostArea()).queryByLabelText(/の手札$/)).toBeNull();
  });
});

describe("処理可能性の表示", () => {
  it("区分ごとの表示と、未裁定・未実装を禁止と書かないこと", async () => {
    const kinds = ["supported", "may_stop_later", "unresolved_ruling", "not_implemented", "technical_limit", "unverified"];
    const list = kinds.map((p, i) => cand("answer_decision", p, { id: `c${i + 1}` }));
    await startGame(server((c) => (c.body?.type === "candidates" && tokenOf(c) === "tok0" ? candidates("r1", list) : undefined)));
    const panel = await within(viewerArea()).findByRole("region", { name: "操作候補" });
    for (const label of ["対応", "送れる（後で止まりうる）", "未裁定", "未実装", "技術上の制限", "未確認"]) {
      expect(within(panel).getAllByText(label, { selector: ".badge-label" }).length).toBeGreaterThan(0);
    }
    expect(panel.textContent).not.toMatch(/ルール上禁止/);
    expect(within(panel).getAllByText(/完走は保証されません/).length).toBe(kinds.length);
  });

  it("入力非公開の候補を区別して表示する", async () => {
    await startGame(
      server((c) =>
        c.body?.type === "candidates" && tokenOf(c) === "tok0" ? candidates("r1", [cand("answer_decision", "may_stop_later", { input_disclosure: "unconfirmed" })]) : undefined,
      ),
    );
    expect(await within(viewerArea()).findByText("入力非公開")).toBeInTheDocument();
  });
});

describe("古い候補と再取得", () => {
  it("refetch_required の拒否で候補を取り直し、受理のあとも古い候補を捨てて取り直す", async () => {
    let revision = 1;
    let submits = 0;
    const transport = server((c) => {
      if (tokenOf(c) !== "tok0") return undefined;
      if (c.body?.type === "candidates") return candidates(`r${revision}`, [cand("end_turn", "may_stop_later", { input_disclosure: "no_input", input_stages: [] })]);
      if (c.body?.type === "submit") {
        submits += 1;
        if (submits === 1) {
          revision = 2;
          return submitResult("refused", { refusal: { code: "CANDIDATES_STALE", message: "古い" }, refetch: true });
        }
        revision = 3;
        return submitResult("accepted");
      }
      return undefined;
    });
    const user = await startGame(transport);
    const area = viewerArea();
    await user.click(await within(area).findByRole("button", { name: "この操作を選ぶ" }));
    await user.click(await within(area).findByRole("button", { name: "送信" }));
    expect(await within(area).findByText(/CANDIDATES_STALE/)).toBeInTheDocument();
    await waitFor(() => expect(transport.calls.filter((c) => c.body?.type === "candidates" && tokenOf(c) === "tok0").length).toBeGreaterThanOrEqual(2));
    // 取り直した候補（r2）で送る
    await user.click(await within(area).findByRole("button", { name: "この操作を選ぶ" }));
    await user.click(await within(area).findByRole("button", { name: "送信" }));
    const sent = transport.calls.filter((c) => c.body?.type === "submit");
    expect(sent.map((c) => c.body?.revision)).toEqual(["r1", "r2"]);
    expect(await within(area).findByText(/^受理/)).toBeInTheDocument();
    await waitFor(() => expect(transport.calls.filter((c) => c.body?.type === "candidates" && tokenOf(c) === "tok0").at(-1)).toBeDefined());
    expect(within(area).queryByRole("region", { name: /^入力/ })).toBeNull();
    // operation_id は送るたびに違う（自動の再送はしない）
    expect(new Set(sent.map((c) => c.body?.operation_id)).size).toBe(2);
  });
});

describe("閲覧者の切り替え", () => {
  it("切り替えると前の閲覧者の手札・候補・診断が画面から消える", async () => {
    const user = await startGame(server());
    const area = viewerArea();
    await within(area).findByLabelText("プレイヤー0の手札");
    await user.click(await within(area).findByRole("button", { name: "この操作を選ぶ" }));
    await user.click(await within(area).findByRole("button", { name: "送信" }));
    expect(await within(area).findByText(/^受理/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    expect(await within(area).findByLabelText("プレイヤー1の手札")).toHaveTextContent("SECRET-1");
    expect(within(area).queryByLabelText("プレイヤー0の手札")).toBeNull();
    expect(within(area).queryByText(/^受理/)).toBeNull();
    expect(within(area).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
    expect(area.textContent).not.toContain("PMCG1-058（");
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    await within(area).findByText(/観戦者は観測と公開の更新だけ/);
    expect(within(area).queryByLabelText(/の手札$/)).toBeNull();
    expect(area.textContent).not.toContain("SECRET-1");
  });

  it("切り替え前の遅れた応答を新しい閲覧者の画面に反映しない", async () => {
    const late = deferred<unknown>();
    let first = true;
    const transport = server((c) => {
      if (c.body?.type === "view" && tokenOf(c) === "tok1" && first) {
        first = false;
        return late.promise; // プレイヤー1の観測が遅れて届く
      }
      return undefined;
    });
    const user = await startGame(transport);
    await within(viewerArea()).findByLabelText("プレイヤー0の手札");
    await user.click(screen.getByRole("radio", { name: "プレイヤー1" }));
    await user.click(screen.getByRole("radio", { name: "観戦者" }));
    await within(viewerArea()).findByText(/観戦者は観測と公開の更新だけ/);
    late.resolve(view(1, obsFor(1)));
    await new Promise((r) => setTimeout(r, 30));
    expect(viewerArea().textContent).not.toContain("SECRET-1");
    expect(within(viewerArea()).queryByLabelText("プレイヤー1の手札")).toBeNull();
  });
});

describe("未知の形式・通信失敗", () => {
  it("知らない形式の版は「不明な応答」として操作を止める", async () => {
    await startGame(server((c) => (c.body?.type === "view" && tokenOf(c) === "tok0" ? { ...view(0, obsFor(0)), format: 2 } : undefined)));
    const alert = await within(viewerArea()).findByText("不明な応答");
    expect(alert.parentElement).toHaveTextContent("操作を止めました");
    expect(within(viewerArea()).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
  });

  it("知らない処理可能性の値も操作を止める", async () => {
    await startGame(server((c) => (c.body?.type === "candidates" && tokenOf(c) === "tok0" ? candidates("r1", [cand("end_turn", "maybe")]) : undefined)));
    expect(await within(viewerArea()).findByText("不明な応答")).toBeInTheDocument();
    expect(within(viewerArea()).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
  });

  it("送信の通信失敗は結果不明と表示し、自動で再送せず、観測を取り直す", async () => {
    const transport = server((c) => (c.body?.type === "submit" ? new NetworkError() : undefined));
    const user = await startGame(transport);
    const area = viewerArea();
    await user.click(await within(area).findByRole("button", { name: "この操作を選ぶ" }));
    const viewsBefore = transport.calls.filter((c) => c.body?.type === "view" && tokenOf(c) === "tok0").length;
    await user.click(await within(area).findByRole("button", { name: "送信" }));
    expect(await within(area).findByText("送信の結果が分かりません")).toBeInTheDocument();
    expect(within(area).getByText(/自動では送り直しません/)).toBeInTheDocument();
    await waitFor(() => expect(transport.calls.filter((c) => c.body?.type === "view" && tokenOf(c) === "tok0").length).toBeGreaterThan(viewsBefore));
    expect(transport.calls.filter((c) => c.body?.type === "submit")).toHaveLength(1);
  });

  it("二重クリックしても送信は 1 回", async () => {
    const slow = deferred<unknown>();
    const transport = server((c) => (c.body?.type === "submit" ? slow.promise : undefined));
    const user = await startGame(transport);
    const area = viewerArea();
    await user.click(await within(area).findByRole("button", { name: "この操作を選ぶ" }));
    const send = await within(area).findByRole("button", { name: "送信" });
    await user.dblClick(send);
    expect(within(area).getByRole("button", { name: "送信中…" })).toBeDisabled();
    slow.resolve(submitResult("accepted"));
    await within(area).findByText(/^受理/);
    expect(transport.calls.filter((c) => c.body?.type === "submit")).toHaveLength(1);
  });
});
