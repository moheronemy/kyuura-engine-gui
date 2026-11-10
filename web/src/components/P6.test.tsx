// 0.174.0（P6。本人のうらのバトル場のポケモンのにげる）の入力の検証・表示・送る前の check（模擬の応答。形は test/p6.ts）。
// 実エンジンとの確認は server/tests/test_p6.py（構築盤面）と e2e/p6.spec.ts。おもてのにげるの表示は TurnBasics.test.tsx（変えていない）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InputStage } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { inputs, observation, player } from "../test/fixtures";
import { OWN_FACE_DOWN_ACTIVE, P6_RETREAT, P6_STAGES, p6Stages } from "../test/p6";
import { ATTACH_STAGES, RETREAT_STAGES } from "../test/u73";
import { DecisionPanel } from "./DecisionPanel";

const NAMES: Record<string, string> = { "PMCG1-058": "エビワラー", "PMCG1-102": "基本闘エネルギー", "PMCG1-054": "イワーク" };
type Raw = Record<string, unknown>;
const clone = (stages: InputStage[]) => JSON.parse(JSON.stringify(stages)) as Raw[];
const opts = (s: Raw) => s.options as Raw[];
const parse = (kind: string, stages: unknown) => V.inputsResponse(inputs(kind, stages as never));

function setup(stages: InputStage[] = P6_STAGES) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const onInputChange = vi.fn();
  const parsed = V.inputsResponse(inputs("retreat", stages, { candidate: "c2" }));
  const obs = observation(0, [player(0, { handCards: [], active: OWN_FACE_DOWN_ACTIVE as never }), player(1, { handCards: null })]);
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate: P6_RETREAT, handle: { game: "g", revision: "r", candidate: "c2" }, inputs: parsed, check }}
      actor={0}
      observation={obs}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
      onInputChange={onInputChange}
    />
  );
  const view = render(ui(null));
  return { onSubmit, onCheck, onInputChange, user: userEvent.setup(), rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)) };
}

const stage = (n: number) => screen.getAllByRole("group")[n - 1]!;
const send = () => screen.getByRole("button", { name: "送信" });
const VALID = { valid: true, refusal: null };

describe("cost_evaluation の契約（実行時の検証）", () => {
  it("P6 の実応答の形と、おもてのにげるの形を受け付ける", () => {
    expect(() => parse("retreat", P6_STAGES)).not.toThrow();
    expect(() => parse("retreat", p6Stages([]))).not.toThrow(); // ついているカードがない（0〜0 枚）
    expect(() => parse("retreat", RETREAT_STAGES)).not.toThrow(); // おもて（total_units・units）は今までどおり
    expect(() => parse("retreat", [])).not.toThrow(); // 宣言の確かめが止める候補（段なし）
  });

  it.each<[string, (s: Raw[]) => void]>([
    ["total_units と併存", (s) => (s[1]!.total_units = { min: 0, max: 0 })],
    ["省いたはずの units がある（1 枚だけ）", (s) => (opts(s[1]!)[0]!.units = 1)],
    ["cost_evaluation も total_units もない（費用 0 と見なさない）", (s) => delete s[1]!.cost_evaluation],
    ["知らない status", (s) => ((s[1]!.cost_evaluation as Raw).status = "evaluated")],
    ["知らない reason", (s) => ((s[1]!.cost_evaluation as Raw).reason = "other_reason")],
    ["知らない項目", (s) => ((s[1]!.cost_evaluation as Raw).hint = 2)],
    ["項目の欠落（reason）", (s) => delete (s[1]!.cost_evaluation as Raw).reason],
    ["omitted が違う（units だけ）", (s) => ((s[1]!.cost_evaluation as Raw).omitted = ["units"])],
    ["omitted の並びが違う", (s) => ((s[1]!.cost_evaluation as Raw).omitted = ["units", "total_units"])],
    ["omitted が文字列", (s) => ((s[1]!.cost_evaluation as Raw).omitted = "total_units,units")],
    ["cost_evaluation がオブジェクトでない", (s) => (s[1]!.cost_evaluation = "not_evaluated")],
    ["控えの段に cost_evaluation", (s) => (s[0]!.cost_evaluation = s[1]!.cost_evaluation)],
    ["トラッシュの段の知らない選べるものの項目", (s) => (opts(s[1]!)[0]!.energy_type = "fighting")],
    ["控えの段の知らない項目", (s) => (opts(s[0]!)[0]!.retreat_cost = 3)],
    ["枚数の範囲が選べるものの数と違う", (s) => (s[1]!.count = { min: 0, max: 5 })],
    ["重なりなしでない", (s) => (s[1]!.distinct = false)],
    ["並びが significant でない", (s) => (s[1]!.order = "not_significant")],
    ["段の並びが違う", (s) => s.reverse()],
  ])("矛盾・未知・欠落を止める: %s", (_, mutate) => {
    const stages = clone(P6_STAGES);
    mutate(stages);
    expect(() => parse("retreat", stages)).toThrow(V.ProtocolError);
  });

  it("cost_evaluation・total_units・units は retreat のトラッシュの段だけ（ほかの種類・値の段では止める）", () => {
    const attach = clone(ATTACH_STAGES);
    attach[1]!.cost_evaluation = { ...clone(P6_STAGES)[1]!.cost_evaluation as Raw };
    expect(() => parse("attach_energy", attach)).toThrow(V.ProtocolError);
    const attachUnits = clone(ATTACH_STAGES);
    attachUnits[1]!.total_units = { min: 1, max: 1 };
    expect(() => parse("attach_energy", attachUnits)).toThrow(V.ProtocolError);
    const value = [{ stage: 1, input: "choose_value", meaning: "count", range: { min: 0, max: 3 }, count: { min: 1, max: 1 }, order: "not_applicable", cost_evaluation: clone(P6_STAGES)[1]!.cost_evaluation }];
    expect(() => parse("answer_decision", value)).toThrow(V.ProtocolError);
  });

  it("おもてのにげる: total_units のある段の一部の選べるものに units がなければ止める（今までどおり）", () => {
    const stages = clone(RETREAT_STAGES);
    delete opts(stages[1]!)[0]!.units;
    expect(() => parse("retreat", stages)).toThrow(V.ProtocolError);
  });
});

describe("P6 の入力と表示", () => {
  it("費用と個数は「評価していません」。枚数は数えるが、足りるとは書かず、本人の real から費用・個数を求めない", async () => {
    const { user } = setup();
    const panel = screen.getByRole("region", { name: /^入力/ });
    expect(within(panel).getByRole("note", { name: "うらのバトル場のポケモンのにげる" })).toHaveTextContent("エンジンが評価していません");
    const units = () => screen.getByRole("status", { name: "エネルギーの個数" });
    expect(units()).toHaveTextContent("必要なエネルギーの個数（費用）: 評価していません");
    expect(units()).toHaveTextContent("カードごとのエネルギーの個数: 評価していません");
    expect(units()).toHaveTextContent("選んでいるカード: 0 枚");
    expect(within(stage(2)).getAllByText("個数: 評価していない")).toHaveLength(2);
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    await user.click(within(stage(2)).getAllByRole("checkbox")[0]!);
    expect(units()).toHaveTextContent("選んでいるカード: 1 枚（カードの枚数です。エネルギーの個数ではなく、費用が足りるという意味でもありません）");
    const text = panel.textContent ?? "";
    expect(text).not.toMatch(/total_units）|個数は範囲内|個数が範囲外|選んでいる合計|0 個のまま|にげる 3|イワーク|PMCG1-054/); // 費用 0・real・印刷の値を使わない
    expect(text).not.toMatch(/受理されます|拒否されます|トラッシュされます/); // 結果を予告しない
  });

  it("エンジンが返した控えとエネルギーカードだけ。うらの候補を GUI で使用不可にしない。選んだ順に送り、並べ替え・外すも入力の変更", async () => {
    const { onCheck, onInputChange, user } = setup();
    expect(within(stage(1)).getAllByRole("radio")).toHaveLength(1);
    expect(within(stage(2)).getAllByRole("checkbox")).toHaveLength(2);
    for (const input of [...within(stage(1)).getAllByRole("radio"), ...within(stage(2)).getAllByRole("checkbox")]) expect(input).toBeEnabled();
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    await user.click(within(stage(2)).getAllByRole("checkbox")[1]!); // o3 を先に
    await user.click(within(stage(2)).getAllByRole("checkbox")[0]!);
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o1", "o3", "o2"]);
    const changes = onInputChange.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "o2 を前へ" }));
    expect(onInputChange.mock.calls.length).toBe(changes + 1); // 並べ替え
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o1", "o2", "o3"]);
    await user.click(screen.getByRole("button", { name: "o3 を外す" }));
    expect(onInputChange.mock.calls.length).toBe(changes + 2); // 解除
  });

  it("check の前は送れない。今の入力への形の検査が通ったときだけ送れ、その表示は費用・受理を保証しない", async () => {
    const { onSubmit, user, rerenderWithCheck } = setup();
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    expect(send()).toBeDisabled(); // total_units はないが、retreat は check が要る（種類で決める）
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    rerenderWithCheck({ choices: choicesKey(["o1", "o2"]), response: VALID }); // 別の入力への答え
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
    expect(send()).toBeEnabled();
    const result = screen.getByText(/エンジンの形の検査を通りました/);
    expect(result).toHaveTextContent("費用が足りるか・受理されるかは保証しません");
    expect(screen.getByRole("note", { name: "うらのバトル場のポケモンのにげる" })).toHaveTextContent(
      "選んだ控え・カードが候補にあるか、枚数、重なり、段の順序などの形です。費用が足りるか・受理されるかは保証しません。",
    );
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1"]); // 0 枚（足りるかはエンジンが決める）
  });
});

describe("おもてのにげるの回帰（0.174.0 でも total_units・units の表示のまま）", () => {
  it("個数と枚数を分けて示し、評価していない旨は出さない。check の前は送れない", async () => {
    const parsed = V.inputsResponse(inputs("retreat", RETREAT_STAGES));
    const onSubmit = vi.fn();
    render(
      <DecisionPanel
        selection={{ candidate: { ...P6_RETREAT, processability: "supported", reasons: [] }, handle: { game: "g", revision: "r", candidate: "c2" }, inputs: parsed, check: null }}
        observation={null}
        names={(id) => ({ "PMCG1-030": "ニドリーノ", "PMCG1-102": "基本闘エネルギー" })[id]}
        busy={false}
        blocked={false}
        onCheck={() => undefined}
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole("status", { name: "エネルギーの個数" })).toHaveTextContent("必要なエネルギーの個数（total_units）: 2 個");
    expect(screen.queryByRole("note", { name: "うらのバトル場のポケモンのにげる" })).toBeNull();
    expect(screen.queryByText(/評価していません/)).toBeNull();
    await userEvent.setup().click(within(stage(1)).getByRole("radio", { name: /ニドリーノ/ }));
    expect(send()).toBeDisabled();
  });
});
