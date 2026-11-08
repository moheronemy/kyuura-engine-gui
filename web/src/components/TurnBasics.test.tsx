// U7-3 の番の基本の操作の入力（模擬の応答。形は固定版のエンジンの実応答。実エンジンとの確認は e2e/turn-basics.spec.ts と server/tests）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InputStage, LegalActions } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { cand, candidates, inputs } from "../test/fixtures";
import { ATTACH_STAGES, COVERAGE_U73, EVOLVE_STAGES, PLAY_BASIC_STAGES, RETREAT_STAGES, retreatStages } from "../test/u73";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

const NAMES: Record<string, string> = {
  "PMCG1-058": "エビワラー",
  "PMCG1-029": "ニドラン♂",
  "PMCG1-030": "ニドリーノ",
  "PMCG1-102": "基本闘エネルギー",
  "PMCG1-096": "無色2個エネルギー",
};

function setup(kind: string, stages: InputStage[], opts: { processability?: string; check?: CheckResult | null } = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs(kind, stages));
  const selection = (check: CheckResult | null) => ({
    candidate: cand(kind, opts.processability ?? "supported", { input_stages: stages.map((s) => ({ stage: s.stage, input: s.input })) }),
    handle: { game: "g", revision: "r", candidate: "c2" },
    inputs: parsed,
    check,
  });
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={selection(check)}
      observation={null}
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

describe("実行時の検証（U7-3 の入力の形）", () => {
  it("実応答の形（ベンチ・エネルギー・進化・にげる）を受け付ける", () => {
    for (const [kind, stages] of [
      ["play_basic", PLAY_BASIC_STAGES],
      ["attach_energy", ATTACH_STAGES],
      ["evolve", EVOLVE_STAGES],
      ["retreat", RETREAT_STAGES],
    ] as const) {
      const parsed = V.inputsResponse(inputs(kind, stages));
      expect("stages" in parsed.response && parsed.response.stages.length).toBe(stages.length);
    }
  });

  const clone = (stages: InputStage[]) => JSON.parse(JSON.stringify(stages)) as Record<string, unknown>[];

  it.each([
    ["知らない段の項目（新しい制約かもしれない）", (s: Record<string, unknown>[]) => (s[1]!.max_units_per_card = 2)],
    ["depends_on_stage だけで options_by_choice がない", (s: Record<string, unknown>[]) => delete s[1]!.options_by_choice],
    ["組が 2 段目にない番号を指す", (s: Record<string, unknown>[]) => ((s[1]!.options_by_choice as Record<string, unknown[]>).o1 = [{ option: "o9", eligible: true, processability: "supported" }])],
    ["組のキーが 1 段目にない番号", (s: Record<string, unknown>[]) => ((s[1]!.options_by_choice as Record<string, unknown>).o7 = [])],
    ["組の知らない処理可能性", (s: Record<string, unknown>[]) => ((s[1]!.options_by_choice as Record<string, { processability: string }[]>).o1![0]!.processability = "maybe")],
    ["組の知らない項目", (s: Record<string, unknown>[]) => ((s[1]!.options_by_choice as Record<string, Record<string, unknown>[]>).o1![0]!.priority = 1)],
    ["段をまたいで番号が重なる", (s: Record<string, unknown>[]) => (((s[1]!.options as Record<string, unknown>[])[0]!.id = "o1"))],
    ["依存の先が後の段", (s: Record<string, unknown>[]) => (s[1]!.depends_on_stage = 2)],
  ])("2 段の入力の不正を止める: %s", (_, mutate) => {
    const stages = clone(ATTACH_STAGES);
    mutate(stages);
    expect(() => V.inputsResponse(inputs("attach_energy", stages as never))).toThrow(V.ProtocolError);
  });

  it.each([
    ["units のない選べるもの", (s: Record<string, unknown>[]) => delete (s[1]!.options as Record<string, unknown>[])[0]!.units],
    ["units が 0", (s: Record<string, unknown>[]) => ((s[1]!.options as Record<string, unknown>[])[0]!.units = 0)],
    ["total_units の min > max", (s: Record<string, unknown>[]) => (s[1]!.total_units = { min: 3, max: 2 })],
    ["confused が真偽でない", (s: Record<string, unknown>[]) => (s[1]!.confused = "yes")],
  ])("にげるの入力の不正を止める: %s", (_, mutate) => {
    const stages = clone(RETREAT_STAGES);
    mutate(stages);
    expect(() => V.inputsResponse(inputs("retreat", stages as never))).toThrow(V.ProtocolError);
  });

  it("うらのポケモンの選べるものにカード ID があれば止める（情報境界）", () => {
    const stages = clone(EVOLVE_STAGES);
    ((stages[1]!.options as Record<string, unknown>[])[1]!).card_id = "SECRET-1";
    expect(() => V.inputsResponse(inputs("evolve", stages as never))).toThrow(V.ProtocolError);
  });

  it("ベンチの数・上限の形", () => {
    const stages = clone(PLAY_BASIC_STAGES);
    stages[0]!.bench = { count: 6, limit: 5 };
    expect(() => V.inputsResponse(inputs("play_basic", stages as never))).toThrow(V.ProtocolError);
  });
});

describe("ベンチに出す", () => {
  it("候補の選べるものだけを選び、ID をそのまま送る。ベンチの数・上限は表示だけ", async () => {
    const { onSubmit, user } = setup("play_basic", PLAY_BASIC_STAGES);
    expect(screen.getByText(/ベンチ: 0\/5/)).toBeInTheDocument();
    expect(screen.getByText(/段 1: ベンチに出すたねポケモン（手札）/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await user.click(screen.getAllByRole("radio")[1]!);
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o2"]);
  });
});

describe("エネルギーをつける（2 段・options_by_choice）", () => {
  it("1 段目を選ぶまで 2 段目は選べず、選んだら組だけを組ごとの区分で示す", async () => {
    const { onSubmit, user, rerenderWithCheck } = setup("attach_energy", ATTACH_STAGES);
    expect(within(stage(2)).queryAllByRole("radio")).toHaveLength(0);
    expect(within(stage(2)).getByText(/段 1 を選ぶと/)).toBeInTheDocument();
    await user.click(within(stage(1)).getByRole("radio", { name: /基本闘エネルギー/ }));
    expect(within(stage(2)).getAllByRole("radio")).toHaveLength(2);
    await user.click(within(stage(2)).getByRole("radio", { name: /ニドラン♂.*ベンチ1/ }));
    expect(send()).toBeDisabled(); // 2 段の 1 枚でも、check の前は送れない（GUI の方針。エンジンは check なしの submit も受け付ける）
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    rerenderWithCheck({ choices: choicesKey(["o1", "o4"]), response: { valid: true, refusal: null } });
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1", "o4"]); // 段の順（エネルギー → つける先）
  });

  it("1 段目を変えると 2 段目の選択を捨て、組ごとの eligible・processability に従う（未裁定を禁止と書かない）", async () => {
    const { user, rerenderWithCheck } = setup("attach_energy", ATTACH_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /基本闘エネルギー/ }));
    await user.click(within(stage(2)).getByRole("radio", { name: /ニドラン♂/ }));
    expect(send()).toBeDisabled(); // check の前
    rerenderWithCheck({ choices: choicesKey(["o1", "o4"]), response: { valid: true, refusal: null } });
    expect(send()).toBeEnabled();
    await user.click(within(stage(1)).getByRole("radio", { name: /無色2個エネルギー/ }));
    expect(within(stage(2)).getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(send()).toBeDisabled();
    const bench = within(stage(2)).getByRole("radio", { name: /ニドラン♂/ });
    expect(bench).toBeDisabled();
    const item = bench.closest("li")!;
    expect(item).toHaveTextContent("未裁定");
    expect(item).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(item.textContent).not.toMatch(/ルール上禁止|できません。$/);
    expect(item).toHaveTextContent("エンジンが受け付ける前に止める");
    const active = within(stage(2)).getByRole("radio", { name: /エビワラー/ });
    expect(active).toBeEnabled();
    expect(active.closest("li")).toHaveTextContent("送れる（後で止まりうる）");
    expect(within(stage(1)).getByRole("radio", { name: /無色2個エネルギー/ }).closest("li")).toHaveTextContent("特殊エネルギー");
  });

  it("check の答えは今の入力への答えだけを表示し、入力を変えたら使わない", async () => {
    const { onCheck, user, rerenderWithCheck } = setup("attach_energy", ATTACH_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /基本闘エネルギー/ }));
    await user.click(within(stage(2)).getByRole("radio", { name: /エビワラー/ }));
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith(["o1", "o3"]);
    rerenderWithCheck({ choices: choicesKey(["o1", "o3"]), response: { valid: true, refusal: null } });
    expect(screen.getByText(/エンジンの検査を通りました/)).toBeInTheDocument();
    expect(screen.getByText(/受理・完走の保証ではありません/)).toBeInTheDocument();
    await user.click(within(stage(2)).getByRole("radio", { name: /ニドラン♂/ }));
    expect(screen.queryByText(/エンジンの検査を通りました/)).toBeNull();
    expect(screen.getByText(/前の検査の結果は使いません/)).toBeInTheDocument();
  });
});

describe("進化（2 段）", () => {
  it("組と区分のとおりに選ぶ。本人のうらのポケモンは裏面でカード ID を出さず、unverified を示す", async () => {
    const { onSubmit, user } = setup("evolve", EVOLVE_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /ニドリーノ/ }));
    const faceDown = within(stage(2)).getByRole("radio", { name: /裏向きのポケモン（ベンチ2）/ });
    expect(faceDown).toBeEnabled();
    expect(faceDown.closest("li")).toHaveTextContent("未確認");
    expect(faceDown.closest("label")!.querySelector("canvas")).toBeNull();
    expect(within(faceDown.closest("label")!).getByRole("img", { name: "裏向きのポケモン" })).toBeInTheDocument();
    await user.click(within(stage(2)).getByRole("radio", { name: /ニドラン♂/ }));
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1", "o2"]);
  });
});

describe("にげる（units・total_units・check）", () => {
  it("枚数と個数を分けて示し、今の入力の check が通るまで送れない。選んだ順に送る", async () => {
    const { onCheck, onSubmit, user, rerenderWithCheck } = setup("retreat", RETREAT_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /ニドリーノ/ }));
    const units = () => screen.getByRole("status", { name: "エネルギーの個数" });
    expect(units()).toHaveTextContent("必要なエネルギーの個数（total_units）: 2 個");
    await user.click(within(stage(2)).getAllByRole("checkbox")[1]!); // o3 を先に
    expect(units()).toHaveTextContent("選んでいる合計: 1 個（1 枚）・個数が範囲外");
    await user.click(within(stage(2)).getAllByRole("checkbox")[0]!);
    expect(units()).toHaveTextContent("選んでいる合計: 2 個（2 枚）・個数は範囲内");
    expect(send()).toBeDisabled(); // 個数の表示だけで合法と決めない
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o1", "o3", "o2"]); // 選んだ順
    rerenderWithCheck({ choices: choicesKey(["o1", "o3", "o2"]), response: { valid: true, refusal: null } });
    expect(send()).toBeEnabled();
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1", "o3", "o2"]);
  });

  it("check の拒否は理由を示して送れない（個数不足・未裁定を区別）", async () => {
    const { user, rerenderWithCheck } = setup("retreat", RETREAT_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /ニドリーノ/ }));
    await user.click(within(stage(2)).getAllByRole("checkbox")[0]!);
    rerenderWithCheck({ choices: choicesKey(["o1", "o2"]), response: { valid: false, refusal: { code: "CANDIDATE_INPUT_INVALID", message: "m" } } });
    expect(screen.getByText(/CANDIDATE_INPUT_INVALID（入力が候補の制約に合いません）/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1", "o2"]), response: { valid: false, refusal: { code: "CANDIDATE_NOT_EXECUTABLE", message: "m" } } });
    expect(screen.getByText(/ゲーム上の禁止ではありません/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    // 入力を変えたあとの（古い入力への）valid は送信の条件に使わない
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: { valid: true, refusal: null } });
    expect(send()).toBeDisabled();
  });

  it("0 個（にげるエネルギーがない）: エネルギーを選ばずに送れる（check のあと）", async () => {
    const stages = retreatStages({ min: 0, max: 0 }, []);
    const { onSubmit, user, rerenderWithCheck } = setup("retreat", stages);
    await user.click(within(stage(1)).getByRole("radio", { name: /ニドリーノ/ }));
    expect(screen.getByRole("status", { name: "エネルギーの個数" })).toHaveTextContent("必要なエネルギーの個数（total_units）: 0 個");
    expect(within(stage(2)).getByText(/0 個のまま送れます/)).toBeInTheDocument();
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: { valid: true, refusal: null } });
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1"]);
  });

  it("1 枚で 2 個のカード・特殊エネルギー・こんらんを示す", async () => {
    const stages = retreatStages(
      { min: 2, max: 2 },
      [
        { id: "o2", card_id: "PMCG1-096", units: 2, special: true },
        { id: "o3", card_id: "PMCG1-102", units: 1, special: false },
      ],
      { confused: true },
    );
    const { user } = setup("retreat", stages);
    expect(screen.getByText(/こんらん: 受理のあとにコインを投げます/)).toBeInTheDocument();
    const dce = within(stage(2)).getByRole("checkbox", { name: /無色2個エネルギー/ });
    expect(dce.closest("li")).toHaveTextContent("2 個");
    expect(dce.closest("li")).toHaveTextContent("特殊エネルギー");
    await user.click(within(stage(1)).getByRole("radio", { name: /ニドリーノ/ }));
    await user.click(dce);
    expect(screen.getByRole("status", { name: "エネルギーの個数" })).toHaveTextContent("選んでいる合計: 2 個（1 枚）・個数は範囲内");
  });
});

describe("候補と coverage（U7-3）", () => {
  function legal(list = [cand("end_turn", "may_stop_later", { id: "c1", input_disclosure: "no_input", input_stages: [] })]): LegalActions {
    return V.candidatesResponse(candidates("r1", list, { coverage: COVERAGE_U73 })).response;
  }

  it("評価した種類・候補に出した種類・未対応の種類を分けて示す", () => {
    render(<CandidatesPanel legal={legal()} selectedId={null} disabled={false} onSelect={() => undefined} />);
    expect(screen.getByLabelText("評価して候補に出さなかった種類")).toHaveTextContent("進化させる・にげる");
    const unsupported = screen.getByLabelText("未対応の操作");
    expect(unsupported).toHaveTextContent("ワザを使う");
    expect(unsupported).not.toHaveTextContent("にげる");
    expect(unsupported).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(screen.getByText(/^一部です/)).toBeInTheDocument();
  });

  it("候補の番号・並びでなく kind で表示し、GUI が入力の画面を持たない種類は選べない", async () => {
    const onSelect = vi.fn();
    const list = [
      cand("future_kind", "may_stop_later", { id: "c1" }), // 将来の種類（この GUI に入力の画面がない。U7-5f の check_face_up_deck は表示だけの種類になった）
      cand("retreat", "supported", { id: "c9", reasons: ["reactions_not_evaluated"] }),
    ];
    render(<CandidatesPanel legal={legal(list)} selectedId={null} disabled={false} onSelect={onSelect} />);
    const items = screen.getAllByRole("listitem").filter((li) => li.closest(".candidate-list"));
    const attack = items.find((li) => li.textContent?.includes("future_kind"))!;
    expect(within(attack).queryByRole("button", { name: "この操作を選ぶ" })).toBeNull();
    expect(attack).toHaveTextContent("入力の画面を持っていません");
    const retreat = items.find((li) => li.textContent?.includes("にげる"))!;
    expect(retreat).toHaveTextContent("受理のあとの反応・決定・停止を評価していない");
    await userEvent.setup().click(within(retreat).getByRole("button", { name: "この操作を選ぶ" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c9", kind: "retreat" }));
  });
});
