// U7-3（番の基本の操作）の模擬の応答。形は固定版のエンジン（v0.165.0・b4e62d9）の実際の応答（seed を固定した new_game）に合わせている。
import type { InputStage } from "../api/types";

export const PLAY_BASIC_STAGES: InputStage[] = [
  {
    stage: 1,
    input: "choose_option",
    role: "bench",
    meaning: "card",
    count: { min: 1, max: 1 },
    options: [
      { id: "o1", card: 7, card_id: "PMCG1-029", eligible: true, processability: "supported" },
      { id: "o2", card: 6, card_id: "PMCG1-029", eligible: true, processability: "supported" },
    ],
    order: "not_applicable",
    bench: { count: 0, limit: 5 },
  },
];

export const ATTACH_STAGES: InputStage[] = [
  {
    stage: 1,
    input: "choose_option",
    role: "energy",
    meaning: "card",
    count: { min: 1, max: 1 },
    options: [
      { id: "o1", card: 42, card_id: "PMCG1-102", special: false, eligible: true, processability: "supported" },
      { id: "o2", card: 50, card_id: "PMCG1-096", special: true, eligible: true, processability: "may_stop_later", reasons: ["reactions_not_evaluated"] },
    ],
    order: "not_applicable",
  },
  {
    stage: 2,
    input: "choose_option",
    role: "target",
    meaning: "pokemon",
    count: { min: 1, max: 1 },
    options: [
      { id: "o3", pokemon: 1, card: 1, zone: "active", card_id: "PMCG1-058", eligible: true, processability: "supported" },
      { id: "o4", pokemon: 3, card: 7, zone: "bench", bench_index: 0, card_id: "PMCG1-029", eligible: true, processability: "supported" },
    ],
    order: "not_applicable",
    depends_on_stage: 1,
    options_by_choice: {
      o1: [
        { option: "o3", eligible: true, processability: "supported" },
        { option: "o4", eligible: true, processability: "supported" },
      ],
      // 特殊エネルギーはバトル場だけ・ベンチは未裁定（組ごとの区分。ゲーム上の禁止ではない）
      o2: [
        { option: "o3", eligible: true, processability: "may_stop_later", reasons: ["reactions_not_evaluated"] },
        { option: "o4", eligible: false, processability: "unresolved_ruling", reasons: ["stops_before_acceptance"] },
      ],
    },
    note: "選べる組は options_by_choice（1 段目の番号ごと）。options は組のどれかにある場のポケモン",
  },
];

export const EVOLVE_STAGES: InputStage[] = [
  {
    stage: 1,
    input: "choose_option",
    role: "evolution_card",
    meaning: "card",
    count: { min: 1, max: 1 },
    options: [{ id: "o1", card: 8, card_id: "PMCG1-030", eligible: true, processability: "supported" }],
    order: "not_applicable",
  },
  {
    stage: 2,
    input: "choose_option",
    role: "target",
    meaning: "pokemon",
    count: { min: 1, max: 1 },
    options: [
      { id: "o2", pokemon: 3, card: 7, zone: "bench", bench_index: 0, card_id: "PMCG1-029", eligible: true, processability: "supported" },
      { id: "o3", pokemon: 4, card: 9, zone: "bench", bench_index: 1, face_down: true, eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] },
    ],
    order: "not_applicable",
    depends_on_stage: 1,
    options_by_choice: {
      o1: [
        { option: "o2", eligible: true, processability: "supported" },
        { option: "o3", eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] },
      ],
    },
  },
];

/** にげる（実応答の形）。energies で 2 段目の選べるものを差し替える（無色2個エネルギー・特殊エネルギー・0 個）。 */
export function retreatStages(
  totalUnits: { min: number; max: number },
  energies: { id: string; card_id: string; units: number; special: boolean }[],
  extra: Record<string, unknown> = {},
): InputStage[] {
  return [
    {
      stage: 1,
      input: "choose_option",
      role: "new_active",
      meaning: "pokemon",
      count: { min: 1, max: 1 },
      options: [{ id: "o1", pokemon: 3, card: 8, zone: "bench", bench_index: 0, card_id: "PMCG1-030", eligible: true, processability: "supported" }],
      order: "not_applicable",
    },
    {
      stage: 2,
      input: "choose_option",
      role: "discard",
      meaning: "card",
      count: { min: 0, max: energies.length },
      options: energies.map((e, i) => ({ id: e.id, card: 40 + i, card_id: e.card_id, special: e.special, units: e.units, processability: "supported" })),
      distinct: true,
      order: "significant",
      order_preserved: true,
      total_units: totalUnits,
      note: "トラッシュするカードの出すエネルギーの個数（units。カードの枚数ではない）の合計が total_units の範囲。",
      ...extra,
    } as InputStage,
  ];
}

export const RETREAT_STAGES = retreatStages({ min: 2, max: 2 }, [
  { id: "o2", card_id: "PMCG1-102", units: 1, special: false },
  { id: "o3", card_id: "PMCG1-102", units: 1, special: false },
]);

export const COVERAGE_U73 = {
  implemented_kinds: ["take_prize", "promote_active", "answer_decision", "end_turn", "place_starting", "mulligan_draw", "play_basic", "attach_energy", "evolve", "retreat", "report_janken", "start_sudden_death"],
  scope_kinds: ["end_turn", "play_basic", "attach_energy", "evolve", "retreat", "use_attack", "play_trainer", "use_power", "use_stadium", "remove_disguise", "discard_from_play", "reveal_face_down", "check_face_up_deck"],
  offered_kinds: ["end_turn", "play_basic", "attach_energy"],
  not_covered_kinds: ["use_attack", "play_trainer", "use_power", "use_stadium", "remove_disguise", "discard_from_play", "reveal_face_down", "check_face_up_deck"],
  withheld_input_candidates: [],
  completeness: "partial",
  completeness_scope: "scope_kinds（この応答に明示した種類だけ。全コマンドの合法手ではない）",
};
