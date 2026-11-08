// U7-5a〜d の模擬の応答。
// - 実応答の形（固定版のエンジン v0.170.0・0885d66。server/tests/test_u7_5.py と同じ固定例を new_game から進めて得た）:
//   TRAINER_*（ラッキースタジアム・錯乱ジムの手札）、STADIUM_NO_INPUT_*（ラッキースタジアム）、STADIUM_ENERGY_*（ヤマブキシティジム）、
//   REVEAL_STAGES（マチスの秘策）、DOLL_STAGES（ピッピ人形）、DISGUISE_STAGES（タケシのキュウコン）、ACCEPT_REQUEST_STAGES・
//   CHAOS_ACCEPTED_OTHER・REJECTED_BORROW（錯乱ジムの相手の決定と、使えない「使う」の拒否）
// - 実エンジンの通常の操作では届いていない（エンジンの docs/legal-actions-u7-5ab.md・u7-5c.md・u7-5d.md の JSON の例と legal_actions.py から作った）:
//   TRAINER_UNVERIFIED_STAGES（使うための条件を呼ばないトレーナー）、FD1_STAGES（本人のうらのカードをすてる）、
//   STADIUM_FACE_DOWN_HOLDER_STAGES（うらのポケモンについているエネルギー）、STADIUM_OPPONENT_OWNED（相手が出したスタジアム）
import type { InputStage } from "../api/types";
import { cand } from "./fixtures";
import { submit } from "./u74";

const MAY_TRAINER = { eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated", "preflight_not_evaluated"] } as const;

function one(role: string, meaning: string, options: unknown[]): InputStage {
  return { stage: 1, input: "choose_option", role, meaning, count: { min: 1, max: 1 }, options, order: "not_applicable" } as InputStage;
}

export const TRAINER_CANDIDATE = cand("play_trainer", "may_stop_later", {
  id: "c3",
  reasons: ["continuation_not_evaluated", "preflight_not_evaluated"],
  input_disclosure: "confirmed",
  choices_format: "[手札のカードの番号]",
  input_stages: [{ stage: 1, input: "choose_option" }],
});

/** ラッキースタジアム（手札から出すスタジアム。実応答）。 */
export const TRAINER_LUCKY_STAGES: InputStage[] = [one("trainer", "card", [{ id: "o1", card: 59, card_id: "PRN-015", ...MAY_TRAINER }])];

/** 錯乱ジム・ポケモン交換おじさん 2 枚（実応答）。 */
export const TRAINER_CHAOS_STAGES: InputStage[] = [
  one("trainer", "card", [
    { id: "o1", card: 6, card_id: "PMCG1-093", ...MAY_TRAINER },
    { id: "o2", card: 3, card_id: "PMCG5-087", ...MAY_TRAINER },
    { id: "o3", card: 4, card_id: "PMCG1-093", ...MAY_TRAINER },
  ]),
];

/** 使うための条件をエンジンが前もって呼ばないトレーナー（文書の形。unverified でも送れる）と、未登録のトレーナー（実行できない）。 */
export const TRAINER_UNVERIFIED_STAGES: InputStage[] = [
  one("trainer", "card", [
    { id: "o1", card: 7, card_id: "PMCG2-076", eligible: true, processability: "unverified", reasons: ["continuation_not_evaluated", "preflight_not_evaluated", "use_condition_not_evaluated"] },
    { id: "o2", card: 8, card_id: "PMCG1-074", eligible: false, processability: "not_implemented", reasons: ["stops_before_acceptance"] },
  ]),
];

/** 選ばせるもののない場のスタジアム（ラッキースタジアム。実応答）。段がない。 */
export const STADIUM_NO_INPUT_CANDIDATE = cand("use_stadium", "may_stop_later", {
  id: "c3",
  reasons: ["continuation_not_evaluated"],
  choices_format: "[]",
  stadium: { card: 59, card_id: "PRN-015", owner: 0 },
  input_disclosure: "no_input",
  input_stages: [],
});

/** エネルギーを選ばせる場のスタジアム（ヤマブキシティジム。実応答）。 */
export const STADIUM_ENERGY_CANDIDATE = cand("use_stadium", "may_stop_later", {
  id: "c3",
  reasons: ["continuation_not_evaluated"],
  choices_format: "[エネルギーカードの番号]",
  stadium: { card: 5, card_id: "PMCG6-090", owner: 0 },
  input_disclosure: "confirmed",
  input_stages: [{ stage: 1, input: "choose_option" }],
});
export const STADIUM_ENERGY_STAGES: InputStage[] = [
  one("energy", "card", [
    { id: "o1", card: 26, card_id: "PMCG1-101", holder: { pokemon: 1, card: 2, zone: "active", card_id: "PMCG6-043" }, eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated"] },
  ]),
];
/** うらのポケモン（マチスの秘策）についているエネルギー（文書の形: holder は face_down でカード ID なし）。 */
export const STADIUM_FACE_DOWN_HOLDER_STAGES: InputStage[] = [
  one("energy", "card", [
    { id: "o1", card: 30, card_id: "PMCG1-101", holder: { pokemon: 4, card: 12, zone: "bench", bench_index: 0, face_down: true }, eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated"] },
  ]),
];
/** 相手（プレイヤー1）が出したスタジアムを、番のプレイヤー0が使う（文書の形）。 */
export const STADIUM_OPPONENT_OWNED = cand("use_stadium", "may_stop_later", { ...STADIUM_NO_INPUT_CANDIDATE, stadium: { card: 70, card_id: "PRN-015", owner: 1 } });

/** うらのカードをおもてにする（マチスの秘策でうらにしたヒトカゲ。実応答）。カード ID・名前はない。 */
export const REVEAL_STAGES: InputStage[] = [
  one("face_down", "pokemon", [{ id: "o1", pokemon: 3, card: 6, zone: "bench", bench_index: 0, face_down: true, eligible: true, processability: "may_stop_later", reasons: ["face_down_reveal_not_evaluated"] }]),
];
/** ベンチのピッピ人形をすてる（実応答）。 */
export const DOLL_STAGES: InputStage[] = [
  one("discard", "pokemon", [{ id: "o1", pokemon: 3, card: 59, zone: "bench", bench_index: 0, card_id: "PMCG1-091", eligible: true, processability: "supported" }]),
];
/** 本人のうらのカードをすてる（FD1。文書の形: 実行できない区分。ゲーム上の禁止ではない）とピッピ人形。 */
export const FD1_STAGES: InputStage[] = [
  one("discard", "pokemon", [
    { id: "o1", pokemon: 3, card: 4, zone: "bench", bench_index: 0, face_down: true, eligible: false, processability: "unresolved_ruling", reasons: ["stops_before_acceptance"] },
    { id: "o2", pokemon: 5, card: 59, zone: "bench", bench_index: 1, card_id: "PMCG1-091", eligible: true, processability: "supported" },
  ]),
];
/** 「ばける」でリザードをのせたタケシのキュウコン（実応答）。 */
export const DISGUISE_STAGES: InputStage[] = [
  one("disguised", "pokemon", [{ id: "o1", pokemon: 1, card: 4, zone: "active", card_id: "PMCG5-019", eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated"] }]),
];

/** 錯乱ジムの「うら」のあと、相手が答える決定（実応答）。「使う」（o1）か、何も選ばない（使わない）。 */
export const ACCEPT_REQUEST_STAGES: InputStage[] = [
  {
    stage: 1,
    input: "choose_option",
    decision_kind: "accept_request",
    meaning: "number",
    count: { min: 0, max: 1 },
    distinct: true,
    order: "not_applicable",
    order_preserved: true,
    decline: true,
    options: [{ id: "o1", value: 1, processability: "may_stop_later" }],
  } as InputStage,
];
export const ANSWER_CANDIDATE = cand("answer_decision", "may_stop_later", {
  id: "c1",
  reasons: ["continuation_not_evaluated"],
  input_disclosure: "confirmed",
  input_stages: [{ stage: 1, input: "choose_option" }],
});
/** 交換おじさんの宣言は受理され、相手（プレイヤー1）が答える（実応答の形）。 */
export const CHAOS_ACCEPTED_OTHER = submit("accepted", { status: "awaiting_decision", next: [{ kind: "answer_decision", player: 1 }] });
/** 相手の手札にポケモンがないときの「使う」（実応答の形。相手にだけ返る。状態は変わらない・取っ手は失効しない）。 */
export const REJECTED_BORROW = submit(
  "rejected",
  {
    viewer: 1,
    outcome: "rejected",
    status: "awaiting_decision",
    stage: "decision_answer",
    next: [{ kind: "answer_decision", player: 1 }],
    diagnostic_id: "NO_POKEMON_CARD_IN_HAND",
    category: "invalid_input",
    message: "この入力は、待っている決定に対して受け付けられません。",
  },
  { refetch_required: false },
);
/** 「使わない」（何も選ばない）は受理され、使ったプレイヤーの番にもどる（実応答の形）。 */
export const DECLINED_BACK_TO_TURN = submit("accepted", { viewer: 1, stage: "decision_answer", next: [{ kind: "turn_action", player: 0 }] });
