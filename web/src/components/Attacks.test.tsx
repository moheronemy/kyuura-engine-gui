// U7-4 のワザの宣言の入力と、送信の結果の区別（模擬の応答。形は test/u74.ts。実エンジンとの確認は e2e/attacks.spec.ts と server/tests/test_attacks.py）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InputStage, SubmitResponse } from "../api/types";
import * as V from "../api/validate";
import { summarizeSubmit } from "../state/outcome";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { inputs, observation, player, pokemon } from "../test/fixtures";
import { ATTACH_STAGES, EVOLVE_STAGES } from "../test/u73";
import {
  ACCEPTED_AWAITING_OTHER,
  ACCEPTED_AWAITING_OWN,
  ACCEPTED_GAME_OVER,
  ACCEPTED_HALTED,
  ACCEPTED_TURN_MOVES,
  ADDON_STAGES,
  ATTACK_CANDIDATE,
  DRY_UP_STAGES,
  FACE_DOWN_ATTACK_STAGES,
  FAILED,
  JAB_STAGES,
  REFUSED_INVALID,
  REJECTED_HC1,
  ROUTE_STAGES,
} from "../test/u74";
import { DecisionPanel, costText } from "./DecisionPanel";

const NAMES: Record<string, string> = { "PMCG1-058": "エビワラー", "PMCG1-029": "ニドラン♂", "PMCG1-030": "ニドリーノ", "ES2-005": "ファイヤー", "PMCG5-076": "スタジアムX" };

const OBS = (() => {
  const p0 = player(0, { handCards: [], active: pokemon(1, "エビワラー", { card_id: "PMCG1-058" }) });
  p0.bench = [pokemon(3, "ニドラン♂", { card_id: "PMCG1-029" }) as never];
  return observation(0, [p0, player(1, { handCards: null, active: pokemon(2, "ゴース", { card_id: "PMCG1-050" }) })]);
})();

function setup(stages: InputStage[], opts: { check?: CheckResult | null } = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs("use_attack", stages));
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate: ATTACK_CANDIDATE, handle: { game: "g", revision: "r", candidate: "c3" }, inputs: parsed, check }}
      observation={OBS}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
  const view = render(ui(opts.check ?? null));
  return { onSubmit, onCheck, user: userEvent.setup(), rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)) };
}

const stage = (n: number) => screen.getAllByRole("group")[n - 1]!;
const send = () => screen.getByRole("button", { name: "送信" });
const valid = (choices: string[]): CheckResult => ({ choices: choicesKey(choices), response: { valid: true, refusal: null } });
const clone = (stages: InputStage[]) => JSON.parse(JSON.stringify(stages)) as Record<string, unknown>[];
const opts = (s: Record<string, unknown>[], n: number) => s[n]!.options as Record<string, unknown>[];

describe("実行時の検証（U7-4 の入力の形）", () => {
  it("実応答の形（ジャブ・ドライアップ）と、文書の形（宣言といっしょに選ぶもの・持ち方・うらのポケモン）を受け付ける", () => {
    for (const stages of [JAB_STAGES, DRY_UP_STAGES, ADDON_STAGES, ROUTE_STAGES, FACE_DOWN_ATTACK_STAGES]) {
      const parsed = V.inputsResponse(inputs("use_attack", stages));
      expect("stages" in parsed.response && parsed.response.stages.length).toBe(2);
    }
  });

  it.each([
    ["ワザの知らない項目", (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.damage_after_weakness = "40")],
    ["知らない route", (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.route = "borrowed")],
    ["route がない（うらのポケモンでない）", (s: Record<string, unknown>[]) => delete opts(s, 0)[0]!.route],
    ["知らないエネルギーの値", (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.cost = ["fairy"])],
    ["damage の項目がない", (s: Record<string, unknown>[]) => delete opts(s, 0)[0]!.damage],
    ["damage が数", (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.damage = 20)],
    ["text_ja の項目がない", (s: Record<string, unknown>[]) => delete opts(s, 0)[0]!.text_ja],
    ["attack_index が負", (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.attack_index = -1)],
    ["grantors が数の並びでない", (s: Record<string, unknown>[]) => (opts(s, 0)[0]!.grantors = ["a"])],
    ["知らない addon", (s: Record<string, unknown>[]) => (opts(s, 1)[0]!.addon = "double_attack")],
    ["with_power に特殊能力の名前がない", (s: Record<string, unknown>[]) => delete opts(s, 1)[2]!.power],
    ["with_power でない addon に power", (s: Record<string, unknown>[]) => (opts(s, 1)[1]!.power = "X")],
    ["スタジアムのコインにカード ID がない", (s: Record<string, unknown>[]) => delete opts(s, 1)[0]!.card_id],
    ["宣言の知らない項目", (s: Record<string, unknown>[]) => (opts(s, 1)[0]!.coin_result = "heads")],
    ["組の表がないワザ", (s: Record<string, unknown>[]) => delete (s[1]!.options_by_choice as Record<string, unknown>).o2],
    ["段の role の並びが違う", (s: Record<string, unknown>[]) => ([s[0]!.role, s[1]!.role] = [s[1]!.role, s[0]!.role])],
    ["2 段目の role がない", (s: Record<string, unknown>[]) => delete s[1]!.role],
    ["ワザを 2 つ選ぶ段", (s: Record<string, unknown>[]) => (s[0]!.count = { min: 1, max: 2 })],
  ])("知らない形は操作を止める（推測しない）: %s", (_, mutate) => {
    const stages = clone(ADDON_STAGES);
    mutate(stages);
    expect(() => V.inputsResponse(inputs("use_attack", stages as never))).toThrow(V.ProtocolError);
  });

  it("段が 3 つあるワザの入力・ほかの種類の段のワザの role は止める", () => {
    const three = [...clone(JAB_STAGES), { stage: 3, input: "choose_option", role: "target", count: { min: 1, max: 1 }, options: [{ id: "o9", processability: "may_stop_later" }], order: "not_applicable" }];
    expect(() => V.inputsResponse(inputs("use_attack", three as never))).toThrow(V.ProtocolError);
    const evolve = clone(EVOLVE_STAGES);
    evolve[0]!.role = "attack";
    expect(() => V.inputsResponse(inputs("evolve", evolve as never))).toThrow(V.ProtocolError);
    expect(() => V.inputsResponse(inputs("attach_energy", ATTACH_STAGES))).not.toThrow();
  });

  it("うらのバトル場のポケモンのワザは本人の候補にカード ID がある（場のうらのポケモンの選べるものは今までどおりカード ID を許さない）", () => {
    expect(() => V.inputsResponse(inputs("use_attack", FACE_DOWN_ATTACK_STAGES))).not.toThrow();
    const field = clone(EVOLVE_STAGES);
    opts(field, 1)[1]!.card_id = "SECRET-1";
    expect(() => V.inputsResponse(inputs("evolve", field as never))).toThrow(V.ProtocolError);
  });

  it("送信の結果の状態・次の操作・停止の形を確かめる（知らない状態は止める）", () => {
    for (const r of [ACCEPTED_TURN_MOVES, ACCEPTED_AWAITING_OWN, ACCEPTED_HALTED, ACCEPTED_GAME_OVER, REJECTED_HC1, REFUSED_INVALID, FAILED]) expect(() => V.submitResponse(r)).not.toThrow();
    const unknownStatus = JSON.parse(JSON.stringify(ACCEPTED_TURN_MOVES));
    unknownStatus.result.status = "paused";
    expect(() => V.submitResponse(unknownStatus)).toThrow(V.ProtocolError);
    const badNext = JSON.parse(JSON.stringify(ACCEPTED_AWAITING_OWN));
    badNext.result.next = [{ kind: "answer_decision", player: 2 }];
    expect(() => V.submitResponse(badNext)).toThrow(V.ProtocolError);
  });
});

describe("ワザの選択（1 段目）", () => {
  it("名前・必要なエネルギー・印刷のダメージの表示（予測ではない）・説明・出どころを表示し、宣言といっしょに選ぶものがなければ入力を求めない", async () => {
    const { onCheck, onSubmit, user, rerenderWithCheck } = setup(JAB_STAGES);
    const jab = within(stage(1)).getByRole("radio", { name: /［ジャブ］/ });
    const item = jab.closest("li")!;
    expect(item).toHaveTextContent("必要なエネルギー: 闘 1 個（計 1 個）");
    expect(item).toHaveTextContent("ダメージの表示（印刷）: 20");
    expect(item).toHaveTextContent("弱点・抵抗力・効果を含めた与えるダメージではありません");
    expect(item).toHaveTextContent("説明なし");
    expect(item).toHaveTextContent("出どころ: 今の姿のカードのワザ");
    expect(item).toHaveTextContent("送れる（後で止まりうる）");
    expect(item).toHaveTextContent("宣言の前の先読み");
    expect(within(stage(2)).getByText(/宣言といっしょに選べるものはありません/)).toBeInTheDocument();
    expect(within(stage(2)).queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText(/ワザの対象・トラッシュするエネルギー・山札から選ぶカード・写すワザは、受理のあとに/)).toBeInTheDocument();
    await user.click(jab);
    // 送る前に今の入力の check が要る（受理・完走の保証ではない）
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith(["o1"]);
    rerenderWithCheck(valid(["o1"]));
    expect(screen.getByText(/受理・完走の保証ではありません/)).toBeInTheDocument();
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(["o1"]);
  });

  it("ダメージの表示のないワザ・エネルギー 0 個のワザも、そのまま表示する（GUI で計算しない）", () => {
    setup(DRY_UP_STAGES);
    const item = within(stage(1)).getByRole("radio", { name: /［ドライアップ］/ }).closest("li")!;
    expect(item).toHaveTextContent("ダメージの表示（印刷）: なし");
    expect(item).toHaveTextContent("炎 2 個（計 2 個）");
    expect(item).toHaveTextContent("コインを投げ続け");
    expect(costText([])).toBe("なし（0 個）");
    expect(costText(["lightning", "colorless", "colorless"])).toBe("雷 1 個・無色 2 個（計 3 個）");
  });

  it("コピー・許可の持ち方は、エンジンが返した route・provider・payer・grantors を表示する。選ぶと止めるワザは禁止と書かない", () => {
    setup(ROUTE_STAGES);
    const link = within(stage(1)).getByRole("radio", { name: /［ワザC］/ }).closest("li")!;
    expect(link).toHaveTextContent("［サイコリンク］で持つ、自分の場のポケモンのワザ");
    expect(link).toHaveTextContent("ワザを持つポケモン: ニドラン♂（プレイヤー0・ベンチ1）");
    const puppet = within(stage(1)).getByRole("radio", { name: /［ワザD］/ }).closest("li")!;
    expect(puppet).toHaveTextContent("エネルギーを払うポケモン: ニドラン♂（プレイヤー0・ベンチ1）");
    expect(puppet).toHaveTextContent("許可を与えるポケモン: ニドラン♂");
    const recall = within(stage(1)).getByRole("radio", { name: /［ワザE］/ });
    expect(recall).toBeDisabled();
    expect(recall.closest("li")).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(recall.closest("li")!.textContent).not.toMatch(/ルール上禁止/);
  });

  it("本人のうらのバトル場のポケモンのワザは未確認として示し、宣言といっしょに選ぶものを出さない", () => {
    setup(FACE_DOWN_ATTACK_STAGES);
    const item = within(stage(1)).getByRole("radio", { name: /［ひみつのワザ］/ }).closest("li")!;
    expect(item).toHaveTextContent("未確認");
    expect(item).toHaveTextContent("うらのバトル場のポケモン（本人だけが知るカード）");
    expect(item).not.toHaveTextContent("出どころ:");
    expect(within(stage(2)).getByText(/宣言といっしょに選べるものはありません/)).toBeInTheDocument();
  });
});

describe("宣言といっしょに選ぶもの（2 段目・options_by_choice）", () => {
  it("1 段目のワザの組だけを示し、0 個・複数（選んだ順のまま）で送れる", async () => {
    const { onSubmit, user, rerenderWithCheck } = setup(ADDON_STAGES);
    expect(within(stage(2)).getByText(/段 1 を選ぶと/)).toBeInTheDocument();
    await user.click(within(stage(1)).getByRole("radio", { name: /［ワザA］/ }));
    const boxes = within(stage(2)).getAllByRole("checkbox");
    expect(boxes).toHaveLength(2); // o3・o5（o4 はワザA の組にない）
    expect(within(stage(2)).getByRole("checkbox", { name: /場のスタジアムのコインを投げる（スタジアムX）/ })).toBeInTheDocument();
    expect(within(stage(2)).getByRole("checkbox", { name: /［XXXXX］ — 自分の場のポケモンの.*ニドラン♂（プレイヤー0・ベンチ1）/ })).toBeInTheDocument();
    // 0 個
    rerenderWithCheck(valid(["o1"]));
    expect(send()).toBeEnabled();
    // 複数: 選んだ順（o5 → o3）のまま送る。並べ替えない
    await user.click(within(stage(2)).getByRole("checkbox", { name: /XXXXX/ }));
    await user.click(within(stage(2)).getByRole("checkbox", { name: /コイン/ }));
    expect(screen.getByText(/選んだ順（送る順）/)).toBeInTheDocument();
    expect(send()).toBeDisabled(); // 入力が変わったので前の check（["o1"]）は使わない
    expect(screen.getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
    rerenderWithCheck(valid(["o1", "o5", "o3"]));
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1", "o5", "o3"]);
  });

  it("ワザを変えたら、宣言といっしょに選んだものと check の答えを捨てる", async () => {
    const { user, rerenderWithCheck } = setup(ADDON_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /［ワザA］/ }));
    await user.click(within(stage(2)).getByRole("checkbox", { name: /XXXXX/ }));
    rerenderWithCheck(valid(["o1", "o5"]));
    expect(send()).toBeEnabled();
    await user.click(within(stage(1)).getByRole("radio", { name: /［ワザB］/ }));
    expect(within(stage(2)).getAllByRole("checkbox").every((b) => !(b as HTMLInputElement).checked)).toBe(true);
    expect(screen.queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(send()).toBeDisabled();
    // ワザB とコインの組は未裁定: 選べないが、禁止とは書かない
    const coin = within(stage(2)).getByRole("checkbox", { name: /コイン/ });
    expect(coin).toBeDisabled();
    expect(coin.closest("li")).toHaveTextContent("未裁定");
    expect(coin.closest("li")).toHaveTextContent("ゲーム上の禁止ではありません");
    // 重なり・併用の可否は GUI で決めない（組にあるものは全部選べる。組み合わせは check が確かめる）
    expect(within(stage(2)).getByRole("checkbox", { name: /ワザを使うポケモン自身/ })).toBeEnabled();
    expect(within(stage(2)).getByRole("checkbox", { name: /XXXXX/ })).toBeEnabled();
  });

  it("check の拒否（組み合わせ）を理由とともに示し、送れない", async () => {
    const { user, rerenderWithCheck } = setup(ADDON_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /［ワザB］/ }));
    await user.click(within(stage(2)).getByRole("checkbox", { name: /ワザを使うポケモン自身/ }));
    await user.click(within(stage(2)).getByRole("checkbox", { name: /XXXXX/ }));
    rerenderWithCheck({ choices: choicesKey(["o2", "o4", "o5"]), response: { valid: false, refusal: { code: "CANDIDATE_INPUT_INVALID", message: "x" } } });
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/通りません CANDIDATE_INPUT_INVALID/);
    expect(send()).toBeDisabled();
  });
});

describe("送信の結果の区別（state/outcome.ts）", () => {
  const summary = (r: unknown, actor: 0 | 1 = 0) => summarizeSubmit(V.submitResponse(r) as SubmitResponse, "use_attack", actor);

  it("refused: ホストの段で止めた（エンジンに渡していない）", () => {
    const s = summary(REFUSED_INVALID);
    expect(s.title).toMatch(/^送らなかった（ホストの段の拒否）: ワザを使う/);
    expect(s.lines.join("\n")).toMatch(/エンジンには渡していません（状態は変わりません）/);
    expect(s.lines.join("\n")).toMatch(/CANDIDATE_INPUT_INVALID: 入力が候補の制約に合いません/);
  });

  it("rejected: エンジンが受け付けなかった（状態は変わらない。未裁定はゲーム上の禁止ではない）", () => {
    const s = summary(REJECTED_HC1);
    expect(s.title).toMatch(/^拒否（エンジン）: ワザを使う/);
    expect(s.lines.join("\n")).toMatch(/状態は変わりません/);
    expect(s.lines.join("\n")).toMatch(/区分: 未裁定（ゲーム上の禁止ではありません）/);
    expect(s.title).not.toMatch(/受理/);
  });

  it("accepted と、そのあとの番の移り・決定待ち（本人・相手）・停止・終局を分ける", () => {
    expect(summary(ACCEPTED_TURN_MOVES).title).toBe("受理: ワザを使う");
    expect(summary(ACCEPTED_TURN_MOVES).lines).toContain("次: プレイヤー1の番の操作");
    const own = summary(ACCEPTED_AWAITING_OWN);
    expect(own.title).toBe("受理（決定待ち）: ワザを使う");
    expect(own.lines).toContain("次: あなた（プレイヤー0）の決定への回答");
    expect(summary(ACCEPTED_AWAITING_OTHER).lines).toContain("次: プレイヤー1の決定への回答");
    const halted = summary(ACCEPTED_HALTED);
    expect(halted.title).toBe("受理（そのあと停止）: ワザを使う");
    expect(halted.tone).toBe("warn");
    expect(halted.lines.join("\n")).toMatch(/宣言の拒否ではありません/);
    expect(halted.lines.join("\n")).toMatch(/区分: 未裁定（ゲーム上の禁止ではありません）/);
    expect(halted.lines.join("\n")).toMatch(/停止: この場面の扱いは/);
    expect(summary(ACCEPTED_GAME_OVER).title).toBe("受理（対戦が終わりました）: ワザを使う");
  });

  it("failed: 処理できない結果（内部エラーなど）", () => {
    const s = summary(FAILED);
    expect(s.tone).toBe("error");
    expect(s.title).toMatch(/^処理できない結果: ワザを使う/);
  });
});
