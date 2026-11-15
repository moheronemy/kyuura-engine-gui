// 0.180.0 の追従の残り（docs/engine-contract.md 22 章）: 送信の前に GUI が独自に書く、本人のうらのカードの公開・使用の説明。
// 前の文「送ると、エンジンがこのカード（ポケモン）をおもてにしてから決めます」は、おもてになることの予告として読めた。固定先のエンジン（27ba35d）は、入口で番・決定待ちを
// 確かめてからおもてにし（おもてにする前の拒否がある）、たねポケモンなら確かめて受理か拒否（拒否は rejected: 元の状態・乱数・ログを保つ）、たねでなければトラッシュして受理する。
// 変えたのは表示の文 2 つ（PowerInfo のうらの説明・うらのバトル場のにげるの説明 FaceDownRetreatInfo）だけ。表示の条件・送れるか・check の門は変えない。
// fixture は既存のものを再利用する（新しい構築盤面・実応答の取り直しはしない）:
// - test/u75fg.ts の SPY（入力なし）・test/r3a.ts（2 段）: 本人のうらの特殊能力
// - test/up5t.ts（UP-5t-C1 の実応答の写し）: 相手のうらのカードを読む候補（使うポケモンはおもて）と、おもての対照
// - test/p6.ts（P6 の実応答に合わせた形）・test/u73.ts（おもてのにげる）
// 検査は GUI 独自の説明の段落だけに当てる（エンジンの保証文の「おもて」「トラッシュ」は失敗にしない。画面全体で語を禁止しない）。
// 画面全体（選び直し・閲覧者の切り替え・遅い check・拒否の表示・自動で再送しない）は AppR3a・AppU75fg・AppP6 などの既存のテストのまま。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage } from "../api/types";
import * as V from "../api/validate";
import { KIND_LABELS } from "../labels";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { candidates, inputs, observation, player } from "../test/fixtures";
import { OWN_FACE_DOWN_ACTIVE, P6_RETREAT, P6_STAGES } from "../test/p6";
import { OWN_FACE_DOWN_BENCH, RC_POWER, RC_STAGES } from "../test/r3a";
import { RETREAT_STAGES } from "../test/u73";
import { COVERAGE_SPY, SPY } from "../test/u75fg";
import { UP5T_FACE_DOWN_POWER, UP5T_FACE_UP_POWER, UP5T_VIEWS_FACE_DOWN, UP5T_VIEWS_FACE_UP } from "../test/up5t";
import { DecisionPanel } from "./DecisionPanel";
import { CandidatesPanel } from "./Panels";

/** 新しい PowerInfo のうらの説明（GUI 独自の文）。 */
const POWER_TEXT =
  "この候補では、特殊能力を使えるか・どうなるかを確かめていません。送信のあとにエンジンが判定します（受理・拒否のほか、本当のカードがたねポケモンでなければ、特殊能力を使わずにトラッシュして受理されることもあります）。「未確認」は使える・受理されるという意味ではありません。拒否された場合は状態が送信の前のまま（うらのまま）で、処理の途中でおもてにしたことも相手・観戦者に知らされません。";
/** 新しい FaceDownRetreatInfo の 2 段落目（GUI 独自の文。JSX の改行は空白 1 つになる）。 */
const RETREAT_TEXT =
  "このにげるが受け付けられるか・どうなるかは、送信のあとにエンジンが判定します（ここでは予告しません）。結果は送信の応答と観測で表示します。拒否された場合は状態が送信の前のまま（うらのまま）で、 処理の途中でおもてにしたことも相手・観戦者には知らされません（結果はあなたにだけ表示します）。";
/** 送信の前の GUI の文に出てはいけない確約（おもてにしてから決める・おもてになる・使える・受理される・トラッシュされる）。GUI の説明の段落にだけ当てる。 */
const PROMISE = /おもてにしてから|おもてになります|おもてにします|使えます|受理されます|トラッシュされます|場に残ります/;
const VALID = { valid: true, refusal: null };
const NAMES: Record<string, string> = { "PMCG1-058": "エビワラー", "PMCG1-060": "コラッタ", "PMCG1-102": "基本闘エネルギー", "PMCG1-054": "イワーク", "PMCG1-033": "ニドリーノ" };

function panel(candidate: Candidate, stages: InputStage[], actor: 0 | 1, obs: unknown, kind = candidate.kind) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs(kind, stages, { candidate: candidate.id }));
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={actor}
      observation={obs as never}
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

function ownBenchObservation() {
  const p0 = player(0, { handCards: [] });
  p0.bench = [OWN_FACE_DOWN_BENCH as never];
  return observation(0, [p0, player(1, { handCards: null })]);
}
const ownActiveObservation = () => observation(0, [player(0, { handCards: [], active: OWN_FACE_DOWN_ACTIVE as never }), player(1, { handCards: null })]);
const up5tObs = (raw: unknown) => V.viewResponse(raw as never).observation;
const send = () => screen.getByRole("button", { name: "送信" });
const stage = (n: number) => screen.getAllByRole("group")[n - 1]!;
/** PowerInfo のうらの説明の段落（GUI 独自の文だけ。印刷の説明・エンジンの保証文は含めない）。 */
const powerWarn = () => screen.getByLabelText("特殊能力").querySelector(".warn")?.textContent ?? null;
/** FaceDownRetreatInfo の段落（GUI 独自の文だけ）。 */
const retreatParagraphs = () => [...screen.getByRole("note", { name: "うらのバトル場のポケモンのにげる" }).querySelectorAll("p")].map((p) => p.textContent);

describe("PowerInfo: 本人のうらのカードの特殊能力の送信の前の説明", () => {
  it("入力なし（［スパイ］）: 確かめていない・送信のあとエンジンが判定すると書き、おもてになること・使えること・受理を確約しない", () => {
    panel(SPY, [], 0, ownBenchObservation());
    expect(powerWarn()).toBe(POWER_TEXT);
    expect(powerWarn()).not.toMatch(PROMISE);
    expect(powerWarn()).not.toMatch(/^送ると、エンジンがこのカードをおもてに/);
  });

  it("受理・拒否・トラッシュ（たねでないとき特殊能力を使わない）の区別と、拒否なら送信の前のまま（rejected は元の状態を保つ）を残す", () => {
    panel(SPY, [], 0, ownBenchObservation());
    const t = powerWarn()!;
    expect(t).toContain("受理・拒否のほか");
    expect(t).toContain("特殊能力を使わずにトラッシュして受理されることもあります");
    expect(t).toContain("拒否された場合は状態が送信の前のまま（うらのまま）");
    expect(t).toContain("「未確認」は使える・受理されるという意味ではありません"); // 既存の U75fg・e2e u75fg の期待と同じ文
  });

  it("2 段（U-R3a）も同じ文（表示の条件は候補の power・pokemon の face_down のまま）", () => {
    panel(RC_POWER, RC_STAGES, 0, ownBenchObservation());
    expect(powerWarn()).toBe(POWER_TEXT);
  });

  it("対照: 相手のうらのカードを読む候補（UP-5t-C1 の実応答。使うポケモンはおもて）とおもての特殊能力には、この説明を出さない（変えていない）", () => {
    for (const [candidate, views] of [[UP5T_FACE_DOWN_POWER, UP5T_VIEWS_FACE_DOWN], [UP5T_FACE_UP_POWER, UP5T_VIEWS_FACE_UP]] as const) {
      const s = panel(candidate, [], 1, up5tObs(views[1]));
      const info = screen.getByLabelText("特殊能力");
      expect(info.classList.contains("face-down-power")).toBe(false);
      expect(info.querySelector(".warn")).toBeNull();
      s.unmount();
    }
  });

  it("check の門は変えない: check の前は送れず、valid のあとだけ送れる。送信は 1 回だけ呼ぶ（自動で再送しない）", async () => {
    const { user, onCheck, onSubmit, rerenderWithCheck } = panel(SPY, [], 0, ownBenchObservation());
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenLastCalledWith([]);
    rerenderWithCheck({ choices: choicesKey([]), response: VALID });
    expect(send()).toBeEnabled();
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([]);
    expect(powerWarn()).toBe(POWER_TEXT); // check のあとも同じ説明
  });

  it("保証文を入れかえても（fixture の文・相手のうらの候補の文・おもての文）、説明と check の前後の送れるかは同じ（文字列で判定しない）", () => {
    const results = [];
    for (const guarantees of [SPY.guarantees, UP5T_FACE_DOWN_POWER.guarantees, UP5T_FACE_UP_POWER.guarantees]) {
      const s = panel({ ...SPY, guarantees } as Candidate, [], 0, ownBenchObservation());
      const before = send().hasAttribute("disabled");
      s.rerenderWithCheck({ choices: choicesKey([]), response: VALID });
      results.push([before, send().hasAttribute("disabled"), powerWarn()]);
      s.unmount();
    }
    expect(results).toEqual(Array(3).fill([true, false, POWER_TEXT]));
  });

  it("エンジンの保証文は候補の一覧の details にそのまま出る（語の「おもて」「トラッシュ」があっても GUI の誤表示にしない）", () => {
    render(<CandidatesPanel legal={V.candidatesResponse(candidates("r1", [SPY], { coverage: COVERAGE_SPY })).response} selectedId={null} disabled={false} onSelect={() => undefined} />);
    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("スパイ"))!;
    expect([...item.querySelectorAll("details dd")].map((dd) => dd.textContent)).toEqual(Object.values(SPY.guarantees));
  });
});

describe("FaceDownRetreatInfo: 本人のうらのバトル場のポケモンのにげるの送信の前の説明（同じ種類の文）", () => {
  it("送信のあとエンジンが判定すると書き、おもてにしてから決めるとは確約しない。ほかの段落（費用を評価していない・check の範囲）は変えない", () => {
    panel(P6_RETREAT, P6_STAGES, 0, ownActiveObservation());
    const [first, second, third] = retreatParagraphs();
    expect(second).toBe(RETREAT_TEXT);
    expect(second).not.toMatch(PROMISE);
    expect(second).toContain("拒否された場合は状態が送信の前のまま（うらのまま）");
    expect(first).toContain("エンジンが評価していません");
    expect(third).toContain("費用が足りるか・受理されるかは保証しません。");
  });

  it("check の門は変えない（check の前は送れず、valid のあと送れる）", async () => {
    const { user, onSubmit, rerenderWithCheck } = panel(P6_RETREAT, P6_STAGES, 0, ownActiveObservation());
    await user.click(within(stage(1)).getByRole("radio", { name: /エビワラー/ }));
    expect(send()).toBeDisabled();
    rerenderWithCheck({ choices: choicesKey(["o1"]), response: VALID });
    expect(send()).toBeEnabled();
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("対照: おもてのにげるにはこの説明を出さない", () => {
    const obs = observation(0, [player(0, { handCards: [] }), player(1, { handCards: null })]);
    panel({ ...P6_RETREAT, processability: "may_stop_later", reasons: [] } as Candidate, RETREAT_STAGES, 0, obs, "retreat");
    expect(screen.queryByRole("note", { name: "うらのバトル場のポケモンのにげる" })).toBeNull();
  });
});

describe("操作名は変えない", () => {
  it("種類のラベル（受理のあとのログ・結果の表示にも使う）", () => {
    expect([KIND_LABELS.use_power, KIND_LABELS.retreat, KIND_LABELS.reveal_face_down]).toEqual(["特殊能力を使う", "にげる", "うらのカードをおもてにする"]);
  });
});
