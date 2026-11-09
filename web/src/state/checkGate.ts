// 送る前の check の門（GUI の方針。エンジンの要求ではない）。
// - エンジンは check なしの submit も受け付ける。GUI は、ここで決めた種類・段の操作を、今の取っ手・今の候補・今の入力への check が通ってから送る
// - 「今の入力への答え」は、選択（Selection。取っ手・候補ごとに作り直す）が持つ check のうち、入力の鍵（choicesKey）が今の入力と同じものだけ。
//   入力を変えると session が答えを捨て、変える前に始めた check の遅れた答えも置かない（useEndpointSession の checkEpoch）。元の入力に戻しても、改めて check が要る
// - 画面のボタンの可否（DecisionPanel）と、送信の入口（useEndpointSession の submit）が同じ関数で確かめる
// - 条件は 1 つ:「今の主体・取っ手・候補・入力への check が通っている場合だけ送信できる」。主体は閲覧者ごとに作り直す session、取っ手と候補は選択（Selection）、
//   入力は choicesKey で表す。check が通っても費用・受理の保証ではない（P6 の check は参照・数・重なり・段の並びの形だけ）
import { CHECK_BEFORE_SUBMIT_KINDS } from "../api/contract";
import type { Candidate, CheckResponse, Choice } from "../api/types";
import type { Selection } from "./useEndpointSession";

/** check の結果と比べる入力の鍵（並びを変えない）。 */
export function choicesKey(choices: Choice[]): string {
  return JSON.stringify(choices);
}

/**
 * 送る前に check が要る操作か（check_before_submit_kinds の種類）。種類だけで決め、段の項目（total_units の有無など）では決めない。
 * 0.174.0 から retreat を種類として含む: 本人のうらのバトル場のポケモンのにげる（P6）の段には total_units がないが、おもてのにげると同じく check が要る。
 */
export function needsCheckBeforeSubmit(candidate: Candidate): boolean {
  return CHECK_BEFORE_SUBMIT_KINDS.has(candidate.kind);
}

/** 今の入力への check の答え（入力の鍵が違えば null。前の入力・別の入力への答えは使わない）。 */
export function currentCheck(selection: Selection, choices: Choice[]): CheckResponse["response"] | null {
  return selection.check && selection.check.choices === choicesKey(choices) ? selection.check.response : null;
}

/** check の門を通るか: check が要らない操作か、今の入力への check が通っている。 */
export function checkGatePassed(selection: Selection, choices: Choice[]): boolean {
  return !needsCheckBeforeSubmit(selection.candidate) || currentCheck(selection, choices)?.valid === true;
}
