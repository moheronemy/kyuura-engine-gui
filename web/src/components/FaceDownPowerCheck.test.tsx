// 0.180.0 の追従の残り（docs/engine-contract.md 21 章）: 本人のうらのカードの特殊能力の check が valid のときの GUI の文。
// 前の文の「エンジンが送信のあとカードをおもてにしてから決めます」は、おもてになることの予告として読めた（拒否ならうらのまま・おもてにする前の拒否もある）。
// 表示の文だけを変え、表示の条件（候補の power・pokemon の face_down。カード名・ID・保証文の文字列では決めない）・送れるか・check の門は変えない。
// fixture は既存のものを再利用する（新しい構築盤面・実応答の取り直しはしない）:
// - test/r3a.ts（U-R3a の 2 段。実応答に合わせた模擬・保証文は短縮）、test/u75fg.ts の SPY（入力なし）
// - test/up5t.ts（UP-5t-C1 の実応答の写し。相手のうらのカードを読むため unverified の候補と、おもての対照。保証文は 0.180.0 の GUARANTEE_POWER と同じ）
// 画面全体（選び直し・閲覧者の切り替え・遅い check・拒否の表示・自動で再送しない）は AppR3a・AppU75fg・AppUP5tC1 の既存のテストのまま。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage } from "../api/types";
import * as V from "../api/validate";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { candidates, inputs, observation, player } from "../test/fixtures";
import { OWN_FACE_DOWN_BENCH, RC_POWER, RC_STAGES } from "../test/r3a";
import { COVERAGE_SPY, SPY } from "../test/u75fg";
import { UP5T_CANDIDATES_FACE_DOWN, UP5T_FACE_DOWN_POWER, UP5T_FACE_UP_POWER, UP5T_INPUTS_FACE_DOWN, UP5T_VIEWS_FACE_DOWN, UP5T_VIEWS_FACE_UP } from "../test/up5t";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

/** 固定先のエンジン 0.180.0（27ba35d）の kyuura_engine/legal_actions.py の GUARANTEE_FACE_DOWN_POWER（ソースの定数をそのまま写した。証跡の source/engine_guarantees.json。
 * sha256（JSON・キーの順・区切りの空白なし）ca68ce0feb610ea362ccac9fba844213e8de13dde65d51501e45c311f42c014d）。エンジンの文の中の「おもてにする」「トラッシュ」は GUI の誤表示として扱わない。 */
const ENGINE_FACE_DOWN_POWER = {
  preconditions:
    "番のプレイヤーの main の段階で、本人のうらのカード（マチスの秘策）の、本人が知る本当のカード（観測の real。本人の応答にだけ出す）の印刷の特殊能力のうち、登録があり、使用を宣言して UsePokemonPower で使う力（effects.power_by_command）。エンジンの確かめ（check_use_pokemon_power）は呼ばない。候補の作成でカードをおもてにしない・状態の複製の上でおもてにして試さない。入力は型ごとの宣言（effects.POWER_INPUT_STAGES）の段（0〜3 段）で、選べるものは宣言の場所（場の公開の値・ついているカード・本人の手札）の並び。どの段も数は 1。2〜3 段（v0.175）は前の段の選び方ごとの番号（options_by_choice・after）の構造の組で、受け付けるかで絞らない。入力の検査（check）は段の数・番号・前の段との依存だけを確かめる。宣言のない型・登録のない力・知らない場所の段・選べるもの（完成する組）のない段は入力を返さない（coverage の residual R-3）",
  acceptance:
    "保証しない。エンジンはコマンドの入口で、番・決定待ちでないことを確かめたあと、このポケモンをおもてにする（_reveal_for_action）。本当のカードが「たねポケモン」なら、おもてにしたあとふつうに確かめ（check_use_pokemon_power）、受け付けなければコマンドごと拒否する（状態・ログはもどり、おもてにしたことも公開されない）。「たねポケモン」でなければ、ついているカードといっしょにトラッシュし、コマンドを受け付けたことにする（特殊能力はおこらない）。最終の判定は apply_command",
  after_acceptance:
    "評価していない（受理のあと、おもてにしたカード・トラッシュしたことは全員に公開される。特殊能力のコイン・効果の決定は受理のあとの決定で、answer_decision の候補で答える。宣言の前に移さない）",
  supported_scope:
    "うらのカードの特殊能力の候補は unverified（候補の作成で確かめていない）。unverified は公開の許可ではない（入力は本人の知識だけで決まるものに限る）。うらのバトル場のポケモンのワザといっしょに選ぶもの（R-2）には広げない",
};

const FACE_DOWN_POWER_TEXT =
  "入力の検査（今の入力）: エンジンの形の検査を通りました（段の数・番号・前の段との組だけ。特殊能力を使えるか・受理されるか・処理が完了するかは保証しません。送信のあとエンジンが判定します）";
const GENERIC_TEXT = "入力の検査（今の入力）: エンジンの検査を通りました（受理・完走の保証ではありません。結果は送信の応答で決まります）";
/** GUI が独自に書く check の文に出てはいけない予告（おもてになる・使える・受理される・完走する・結果）。エンジンの保証文（details）には当てない。 */
const PROMISE = /おもてにしてから|おもてになります|おもてにします|使えます|受理されます|完走します|トラッシュされます|場に残ります/;
const VALID = { valid: true, refusal: null };
const NAMES: Record<string, string> = { "PMCG1-058": "エビワラー", "PMCG1-060": "コラッタ", "PMCG1-102": "基本闘エネルギー", "PMCG1-098": "基本炎エネルギー", "PMCG1-099": "基本水エネルギー" };

function ownObservation() {
  const p0 = player(0, { handCards: [] });
  p0.bench = [OWN_FACE_DOWN_BENCH as never];
  return observation(0, [p0, player(1, { handCards: null })]);
}

/** 入力の画面。actor・観測は経路ごと（本人のうら: プレイヤー 0 の構築の観測、UP-5t-C1: 実応答の使う人（プレイヤー 1）の観測）。 */
function setup(candidate: Candidate, stages: InputStage[], actor: 0 | 1, obs: ReturnType<typeof ownObservation>) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs(candidate.kind, stages, { candidate: candidate.id }));
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={actor}
      observation={obs}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
      onInputChange={() => undefined}
    />
  );
  const view = render(ui(null));
  return { onSubmit, onCheck, user: userEvent.setup(), rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)), unmount: view.unmount };
}

const send = () => screen.getByRole("button", { name: "送信" });
/** GUI 独自の check の文（`.check-result`）。特殊能力の常設の説明・エンジンの保証文は含めない。 */
const checkText = () => document.querySelector(".check-result")?.textContent ?? null;
const stage = (n: number) => screen.getAllByRole("group")[n - 1]!;
/** UP-5t-C1 の実応答の使う人（プレイヤー 1）の観測（うら・おもての 2 つの応答で型が違うので、検証を通してから使う）。 */
const up5tObs = (raw: unknown) => V.viewResponse(raw as never).observation as ReturnType<typeof ownObservation>;

async function rcValid() {
  const s = setup(RC_POWER, RC_STAGES, 0, ownObservation());
  await s.user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
  await s.user.click(within(stage(2)).getAllByRole("radio")[0]!);
  return s;
}

describe("本人のうらのカードの特殊能力: check が valid のときの GUI の文", () => {
  it("2 段（U-R3a）: 形の検査だけで、使えるか・受理・完了を保証せず、送信のあとエンジンが判定すると書く。おもてになることを予告しない", async () => {
    const { rerenderWithCheck } = await rcValid();
    expect(checkText()).toBeNull();
    expect(send()).toBeDisabled(); // check の前は送れない（変えていない）
    rerenderWithCheck({ choices: choicesKey(["o1", "o3"]), response: VALID });
    expect(checkText()).toBe(FACE_DOWN_POWER_TEXT);
    expect(checkText()).not.toMatch(PROMISE);
    expect(checkText()).not.toMatch(/おもて/);
    expect(send()).toBeEnabled();
  });

  it("入力なし（U7-5g-2 の［スパイ］）も同じ文（表示の条件は候補の power・pokemon の face_down）", async () => {
    const { user, onCheck, rerenderWithCheck } = setup(SPY, [], 0, ownObservation());
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith([]);
    rerenderWithCheck({ choices: choicesKey([]), response: VALID });
    expect(checkText()).toBe(FACE_DOWN_POWER_TEXT);
    expect(send()).toBeEnabled();
  });

  it("通らない check の文は変えない（拒否の理由の表示のまま）", async () => {
    const { rerenderWithCheck } = await rcValid();
    rerenderWithCheck({ choices: choicesKey(["o1", "o3"]), response: { valid: false, refusal: { code: "CANDIDATE_INPUT_INVALID", message: "入力が合わない" } } });
    expect(checkText()).toMatch(/^入力の検査（今の入力）: 通りません CANDIDATE_INPUT_INVALID/);
    expect(send()).toBeDisabled();
  });
});

describe("対照: 同じ条件でない特殊能力の check の文は変えない", () => {
  it("相手のうらのカードを読むため unverified の候補（UP-5t-C1 の実応答）: 使うポケモンはおもてなので汎用の文。本人のカードがおもてになるとは書かない", async () => {
    const { rerenderWithCheck } = setup(UP5T_FACE_DOWN_POWER, [], 1, up5tObs(UP5T_VIEWS_FACE_DOWN[1]));
    expect(UP5T_FACE_DOWN_POWER.processability).toBe("unverified"); // unverified でも本人のうらと同じ状況として扱わない
    rerenderWithCheck({ choices: choicesKey([]), response: VALID });
    expect(checkText()).toBe(GENERIC_TEXT);
    expect(checkText()).not.toMatch(/おもて|形の検査/);
    expect(send()).toBeEnabled();
  });

  it("おもての対照（UP-5t-C1 の実応答・may_stop_later）: 汎用の文のまま", async () => {
    const { rerenderWithCheck } = setup(UP5T_FACE_UP_POWER, [], 1, up5tObs(UP5T_VIEWS_FACE_UP[1]));
    rerenderWithCheck({ choices: choicesKey([]), response: VALID });
    expect(checkText()).toBe(GENERIC_TEXT);
  });
});

describe("エンジンの保証文と GUI の文を分ける", () => {
  it("エンジンの保証文（0.180.0 の GUARANTEE_FACE_DOWN_POWER）は候補の一覧の details にそのまま出る。エンジンの文の語（おもてにする・トラッシュ）は禁止しない", () => {
    const spy = { ...SPY, guarantees: ENGINE_FACE_DOWN_POWER } as Candidate;
    render(<CandidatesPanel legal={V.candidatesResponse(candidates("r1", [spy], { coverage: COVERAGE_SPY })).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("スパイ"))!;
    const shown = [...item.querySelectorAll("details dd")].map((dd) => dd.textContent);
    expect(shown).toEqual(Object.values(ENGINE_FACE_DOWN_POWER));
    expect(shown.join("")).toMatch(/おもてにする/);
    expect(shown.join("")).toMatch(/トラッシュ/);
  });

  it("UP-5t-C1 の実応答の保証文も、そのまま出る", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(UP5T_CANDIDATES_FACE_DOWN).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("くさいかふん"))!;
    expect([...item.querySelectorAll("details dd")].map((dd) => dd.textContent)).toEqual(Object.values(UP5T_FACE_DOWN_POWER.guarantees));
  });

  it("保証文を入れかえても（fixture の短い文・0.180.0 の文・おもての特殊能力の文）、check の前後の送れるかと GUI の文は同じ（文字列で判定しない）", async () => {
    const results = [];
    for (const guarantees of [RC_POWER.guarantees, ENGINE_FACE_DOWN_POWER, UP5T_FACE_UP_POWER.guarantees]) {
      const s = setup({ ...RC_POWER, guarantees } as Candidate, RC_STAGES, 0, ownObservation());
      await s.user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
      await s.user.click(within(stage(2)).getAllByRole("radio")[0]!);
      const before = send().hasAttribute("disabled");
      s.rerenderWithCheck({ choices: choicesKey(["o1", "o3"]), response: VALID });
      results.push([before, send().hasAttribute("disabled"), checkText()]);
      s.unmount();
    }
    expect(results).toEqual(Array(3).fill([true, false, FACE_DOWN_POWER_TEXT]));
  });
});
