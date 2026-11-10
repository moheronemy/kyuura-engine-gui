// 0.175.0（U-R3a。本人のうらのカードの、宣言の段が 2〜3 段の特殊能力）の入力の検証・表示・送る前の check（模擬の応答。形は test/r3a.ts）。
// 入力の形はおもての特殊能力（U7-5e）と同じで、GUI は既存の扱い（options_by_choice・downstreamOf・check の門）を使う。実エンジンとの確認は server/tests/test_r3a.py と e2e/u-r3a.spec.ts。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { candidates, inputs, observation, player } from "../test/fixtures";
import { OWN_FACE_DOWN_BENCH, RC_POWER, RC_STAGES, VENUSAUR_POWER, VENUSAUR_STAGES } from "../test/r3a";
import { WITHHELD_FACE_DOWN } from "../test/u75fg";
import { DecisionPanel } from "./DecisionPanel";

const NAMES: Record<string, string> = {
  "PMCG1-058": "エビワラー",
  "PMCG1-060": "コラッタ",
  "PMCG1-102": "基本闘エネルギー",
  "PMCG1-098": "基本炎エネルギー",
  "PMCG1-099": "基本水エネルギー",
  "PMCG4-012": "ロケット団のヒトカゲ",
  "PMCG1-011": "フシギバナ",
};
type Raw = Record<string, unknown>;
const clone = (stages: InputStage[]) => JSON.parse(JSON.stringify(stages)) as Raw[];
const opts = (s: Raw) => s.options as Raw[];
const parse = (stages: unknown) => V.inputsResponse(inputs("use_power", stages as never, { candidate: "c4" }));
const VALID = { valid: true, refusal: null };

function setup(candidate: Candidate = RC_POWER, stages: InputStage[] = RC_STAGES, extra: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const onInputChange = vi.fn();
  const parsed = V.inputsResponse(inputs("use_power", stages, { candidate: candidate.id, ...extra }));
  const p0 = player(0, { handCards: [] });
  p0.bench = [OWN_FACE_DOWN_BENCH as never];
  const obs = observation(0, [p0, player(1, { handCards: null })]);
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
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
const radios = (n: number) => within(stage(n)).queryAllByRole("radio");
const send = () => screen.getByRole("button", { name: "送信" });

describe("U-R3a の入力の検証（既存の依存の形。新しい項目はない）", () => {
  it("実応答の 2 段・3 段と候補（power・pokemon の face_down）を受け付ける", () => {
    expect(() => parse(RC_STAGES)).not.toThrow();
    expect(() => parse(VENUSAUR_STAGES)).not.toThrow();
    expect(() => V.candidatesResponse(candidates("r1", [RC_POWER]))).not.toThrow();
    expect(() => V.candidatesResponse(candidates("r1", [VENUSAUR_POWER]))).not.toThrow();
  });

  it.each<[string, (s: Raw[]) => void]>([
    ["after が options_by_choice の鍵と合わない（別の経路）", (s) => (opts(s[1]!)[2]!.after = "o1")],
    ["options_by_choice に別の経路の番号", (s) => ((s[1]!.options_by_choice as Record<string, Raw[]>).o1!.push({ option: "o5", eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] }))],
    ["3 段目の upstream_stages が前のすべての段でない", (s) => (s[2]!.upstream_stages = [2])],
    ["3 段目の depends_on_stage が直前の段でない", (s) => (s[2]!.depends_on_stage = 1)],
    ["2 段目に depends_on_stage がない", (s) => delete s[1]!.depends_on_stage],
    ["うらのポケモンの選べるものにカード ID", (s) => (opts(s[2]!).find((o) => o.face_down)!.card_id = "PMCG1-011")],
    ["知らない選べるものの項目", (s) => (opts(s[1]!)[0]!.energy_type = "fighting")],
    ["知らない段の項目", (s) => (s[0]!.reveal_outcome = "trash")],
    ["段の並びが契約の表にない", (s) => s.reverse()],
    ["1 段目が依存する", (s) => (opts(s[0]!)[0]!.after = "o2")],
  ])("矛盾・未知の形を止める: %s", (_, mutate) => {
    const stages = clone(VENUSAUR_STAGES);
    mutate(stages);
    expect(() => parse(stages)).toThrow(V.ProtocolError);
  });

  it("候補の pokemon・power の face_down が合わない・うらの pokemon にカード ID があれば止める（今までどおり）", () => {
    const { face_down: _faceDown, ...plainPower } = RC_POWER.power!;
    const half = { ...RC_POWER, power: plainPower } as Candidate; // pokemon だけ face_down
    expect(() => V.candidatesResponse(candidates("r1", [half]))).toThrow(V.ProtocolError);
    const leaked = { ...RC_POWER, pokemon: { ...RC_POWER.pokemon!, card_id: "PMCG4-012" } } as Candidate;
    expect(() => V.candidatesResponse(candidates("r1", [leaked]))).toThrow(V.ProtocolError);
  });
});

describe("U-R3a の入力と表示", () => {
  it("後の段は今の上流の選び方の組だけ（別の経路の番号は出さない）。本人だけの本当のカードは盤面と分けて文字で示し、結果を予告しない", async () => {
    const { user } = setup();
    expect(radios(2)).toHaveLength(0); // 1 段目を選ぶまで 2 段目は選べない
    expect(stage(2)).toHaveTextContent("段 1 を選ぶと");
    await user.click(within(stage(1)).getByRole("radio", { name: /コラッタ/ }));
    expect(radios(2).map((r) => r.closest("label")?.textContent ?? "")).toEqual([expect.stringMatching(/PMCG1-098/), expect.stringMatching(/PMCG1-099/)]);
    expect(stage(2).textContent).not.toMatch(/PMCG1-102/);
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    expect(radios(2)).toHaveLength(2);
    expect(stage(2).textContent).not.toMatch(/PMCG1-098|PMCG1-099/);
    const panel = screen.getByRole("region", { name: /^入力/ });
    const info = within(panel).getByLabelText("特殊能力");
    expect(info).toHaveTextContent("自分の裏向きのポケモン（ベンチ2。盤面ではうらのまま）");
    expect(info).toHaveTextContent("あなただけが知る本当のカード（印刷の情報）: ロケット団のヒトカゲ");
    expect(stage(1)).toHaveTextContent("組は構造だけで、受け付けるかは確かめていない"); // エンジンの 1 段目の note
    expect(panel.textContent).not.toMatch(/受理されます|拒否されます|トラッシュされます|使えます/);
  });

  it("3 段: 3 段目は (1 段目, 2 段目) の組の 3 匹だけ。うらのポケモンはカード ID・名前なしで裏向きと示す", async () => {
    const { user, onCheck } = setup(VENUSAUR_POWER, VENUSAUR_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    expect(radios(3)).toHaveLength(0);
    await user.click(radios(2)[0]!); // o3
    expect(radios(3)).toHaveLength(3); // 12 のうち after が o3 の 3 つ
    const labels = radios(3).map((r) => r.closest("label")?.textContent ?? "");
    expect(labels[2]).toMatch(/裏向きのポケモン/);
    expect(labels[2]).not.toMatch(/フシギバナ|PMCG1-011|ヒトカゲ/);
    await user.click(radios(3)[0]!);
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith(["o1", "o3", "o7"]);
  });

  it("上流を変えると、依存するすべての段の選択と check の答えを捨てる（2 段目を変えても 3 段目を捨てる）", async () => {
    const { user, onCheck, onInputChange, rerenderWithCheck } = setup(VENUSAUR_POWER, VENUSAUR_STAGES);
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    await user.click(radios(2)[0]!);
    await user.click(radios(3)[0]!);
    rerenderWithCheck({ choices: choicesKey(["o1", "o3", "o7"]), response: VALID });
    expect(send()).toBeEnabled();
    const changes = onInputChange.mock.calls.length;
    await user.click(radios(2)[1]!); // 2 段目を o4 に
    expect(onInputChange.mock.calls.length).toBe(changes + 1);
    expect(radios(3).some((r) => (r as HTMLInputElement).checked)).toBe(false);
    expect(send()).toBeDisabled();
    expect(screen.getByText("入力を変えたので、前の検査の結果は使いません。")).toBeInTheDocument();
    await user.click(within(stage(1)).getByRole("radio", { name: /コラッタ/ })); // 1 段目を変える
    expect(radios(2).some((r) => (r as HTMLInputElement).checked)).toBe(false);
    expect(radios(3)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).not.toHaveBeenLastCalledWith(expect.arrayContaining(["o3"]));
  });

  it("check の前・別の入力への check では送れない。今の入力への check が通ったときだけ送れ、その表示は形の検査で使えること・受理・完走を保証しない", async () => {
    const { user, onSubmit, rerenderWithCheck } = setup();
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    await user.click(radios(2)[0]!);
    expect(send()).toBeDisabled();
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    rerenderWithCheck({ choices: choicesKey(["o2", "o5"]), response: VALID });
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1", "o3"]), response: VALID });
    expect(send()).toBeEnabled();
    const result = screen.getByText(/エンジンの形の検査を通りました/);
    expect(result).toHaveTextContent("段の数・番号・前の段との組だけ。特殊能力を使えること・受理・完走の保証ではありません");
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1", "o3"]); // 闘エネルギーの組（形は合う。受け付けるかはエンジンが決める）
  });

  it("完成する入力がない候補（入力非公開・R-3）は、選べるもの・検査の入口を出さず送れない", () => {
    setup(WITHHELD_FACE_DOWN, [], { withheld: { code: "INPUT_BOUNDARY_UNCONFIRMED", message: "入力の境界を確かめていない" } });
    expect(screen.getAllByRole("status").some((s) => s.textContent?.includes("入力非公開") && s.textContent.includes("INPUT_BOUNDARY_UNCONFIRMED"))).toBe(true);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "入力を検査" })).toBeNull();
    expect(send()).toBeDisabled();
  });
});
