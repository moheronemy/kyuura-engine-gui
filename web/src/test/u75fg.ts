// U7-5f・g（v0.172）の模擬の応答。
// - 実応答の形（固定版のエンジン v0.172.0・e26df79。server/tests/test_u7_5fg.py と同じ固定例から得た値を、選べるものの数だけ減らした）:
//   BLAINE_*（カツラの効果の番の attach_energy。3 段目 energy2 は path_stages [1, 2]・options_by_path。1 段目と同じカードは別の番号で、その組には出ない）、
//   FACE_UP_*（check_face_up_deck の表示だけの候補。owner・position だけ）、SPY（本人のうらのマンキーの［スパイ］。入力なし・unverified）、
//   WITHHELD_FACE_DOWN（本人のうらのロケット団のヒトカゲの［ほのおをもらう］。入力を返さない・R-3。0.175.0 からは組が完成しない場面だけ。2〜3 段の入力は test/r3a.ts）、COVERAGE_*（MAIN・番でない主体・決定の回答者の coverage）
// - 実エンジンの通常の操作では届いていない形（エンジンの docs/legal-actions-u7-5fg.md 3 章の例から）: BLAINE_BENCH の「鍵がない組」（ベンチのつけ先には 2 枚目がない）
import type { Candidate, InputStage } from "../api/types";
import { cand, COVERAGE_V172_EXTRA, RESIDUAL_CLASSES_V172 } from "./fixtures";

const MAY = { eligible: true, processability: "may_stop_later", reasons: ["reactions_not_evaluated"] } as const;
const MAIN_SCOPE = ["end_turn", "play_basic", "attach_energy", "evolve", "retreat", "use_attack", "play_trainer", "use_power", "use_stadium", "remove_disguise", "discard_from_play", "reveal_face_down", "check_face_up_deck"];
const IMPLEMENTED = ["take_prize", "promote_active", "answer_decision", "end_turn", "place_starting", "mulligan_draw", "play_basic", "attach_energy", "evolve", "retreat", "use_attack", "remove_disguise", "discard_from_play", "reveal_face_down", "play_trainer", "use_stadium", "use_power", "check_face_up_deck", "report_janken", "start_sudden_death"];

function coverage(extra: Record<string, unknown>) {
  return {
    implemented_kinds: IMPLEMENTED,
    scope_kinds: MAIN_SCOPE,
    offered_kinds: ["end_turn", "attach_energy"],
    not_covered_kinds: [] as string[],
    withheld_input_candidates: [] as string[],
    completeness: "partial",
    completeness_scope: "scope_kinds（この応答に明示した種類だけ。全コマンドの合法手ではない）",
    ...COVERAGE_V172_EXTRA,
    display_only_kinds: ["check_face_up_deck"],
    ...extra,
  };
}

/** 番のプレイヤーの MAIN（R-2 の示さない経路が残るので partial。not_covered_kinds は空）。 */
export const COVERAGE_MAIN = coverage({});
/** 番でないプレイヤー（相手の山札のおもてが 2 枚以上: R-4 で partial。候補はない）。 */
export const COVERAGE_WAITING_R4 = coverage({
  scope_kinds: ["check_face_up_deck"],
  offered_kinds: [],
  not_covered_kinds: ["check_face_up_deck"],
  display_only_kinds: [],
  partial_residual: [],
  residual: { classes: RESIDUAL_CLASSES_V172, present: [{ id: "R-4", scope: "public" }] },
});

export const BLAINE_ATTACH = cand("attach_energy", "may_stop_later", {
  id: "c3",
  reasons: ["reactions_not_evaluated"],
  choices_format: "[エネルギーカードの番号, つける場のポケモンの番号(, 2 枚目のエネルギーカードの番号)]（2 枚目は任意）",
  input_stages: [1, 2, 3].map((stage) => ({ stage, input: "choose_option" })),
});

/** カツラの効果の番（1 段目 o1・o2 は炎エネルギー、2 段目 o3 はカツラのガーディ、o4 はベンチのポケモン。3 段目 o5 は o1 と、o6 は o2 と同じカード）。 */
export const BLAINE_STAGES: InputStage[] = [
  {
    stage: 1, input: "choose_option", role: "energy", meaning: "card", count: { min: 1, max: 1 }, order: "not_applicable",
    options: [{ id: "o1", card: 26, card_id: "PMCG1-098", special: false, ...MAY }, { id: "o2", card: 59, card_id: "PMCG1-098", special: false, ...MAY }],
  },
  {
    stage: 2, input: "choose_option", role: "target", meaning: "pokemon", count: { min: 1, max: 1 }, order: "not_applicable", depends_on_stage: 1,
    options: [{ id: "o3", pokemon: 1, card: 2, zone: "active", card_id: "PMCG6-027", ...MAY }, { id: "o4", pokemon: 3, card: 7, zone: "bench", bench_index: 0, card_id: "PMCG1-014", ...MAY }],
    options_by_choice: { o1: [{ option: "o3", ...MAY }, { option: "o4", ...MAY }], o2: [{ option: "o3", ...MAY }, { option: "o4", ...MAY }] },
  },
  {
    stage: 3, input: "choose_option", role: "energy2", meaning: "card", count: { min: 0, max: 1 }, order: "not_applicable", decline: true, path_stages: [1, 2],
    options: [{ id: "o5", card: 26, card_id: "PMCG1-098", special: false, ...MAY }, { id: "o6", card: 59, card_id: "PMCG1-098", special: false, ...MAY }],
    options_by_path: { "o1/o3": [{ option: "o6", ...MAY }], "o2/o3": [{ option: "o5", ...MAY }] },
    note: "任意（省けば 1 枚だけつける）。選べるのは options_by_path（1・2 段目の選ぶものの番号を / でつないだ鍵ごと）。鍵がない組では選べない。1 段目か 2 段目を変えたら、この段の選び方と入力の検査の結果は無効",
  },
] as unknown as InputStage[];

export const FACE_UP = cand("check_face_up_deck", "unresolved_ruling", {
  id: "c9",
  reasons: ["stops_before_acceptance"],
  choices_format: "[位置の番号]",
});
const STOP = { eligible: false, processability: "unresolved_ruling", reasons: ["stops_before_acceptance"] } as const;
export const FACE_UP_STAGES: InputStage[] = [
  {
    stage: 1, input: "choose_option", role: "face_up_position", meaning: "deck_position", count: { min: 1, max: 1 }, order: "not_applicable",
    options: [1, 2, 3, 4].map((position, i) => ({ id: `o${i + 1}`, owner: 1, position, ...STOP })),
    note: "相手の山札の上からの位置（0 がいちばん上）。表示だけで送れない（未裁定）",
  },
] as unknown as InputStage[];

const FACE_DOWN_POKEMON = { pokemon: 3, card: 0, zone: "bench", bench_index: 0, face_down: true } as const;
export const SPY: Candidate = cand("use_power", "unverified", {
  id: "c5",
  reasons: ["face_down_reveal_not_evaluated"],
  pokemon: FACE_DOWN_POKEMON as never,
  power: { index: 0, name_ja: "スパイ", card: 0, card_id: "PMCG2-028", face_down: true },
  choices_format: "[]",
  input_disclosure: "no_input",
  input_stages: [],
});
export const WITHHELD_FACE_DOWN: Candidate = cand("use_power", "not_implemented", {
  id: "c5",
  reasons: ["face_down_reveal_not_evaluated", "input_boundary_unconfirmed"],
  pokemon: { ...FACE_DOWN_POKEMON, card: 4 } as never,
  power: { index: 0, name_ja: "ほのおをもらう", card: 4, card_id: "PMCG4-012", face_down: true },
  input_disclosure: "unconfirmed",
  input_stages: [],
});
export const COVERAGE_SPY = coverage({ unverified_paths: [{ reason: "face_down_reveal_not_evaluated", candidates: ["c5"] }] });
export const COVERAGE_WITHHELD = coverage({
  withheld_input_candidates: ["c5"],
  residual: { classes: RESIDUAL_CLASSES_V172, present: [{ id: "R-3", scope: "actor", candidate: "c5" }] },
});
