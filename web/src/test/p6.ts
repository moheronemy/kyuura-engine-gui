// 0.174.0（P6。本人のうらのバトル場のポケモンのにげる）の模擬の応答。形は固定版のエンジン（f7bf450）の実応答（server/tests/p6_boards.py の構築盤面。
// new_game からではない）に合わせた。実応答のトラッシュの段は闘エネルギー 1 枚だが、並び・重なりを確かめるため 2 枚目（同じ形）を加えた。
import type { Candidate, InputStage } from "../api/types";
import { cand } from "./fixtures";

const REASON = "face_down_reveal_not_evaluated";

export const P6_COST = { status: "not_evaluated", reason: REASON, omitted: ["total_units", "units"] } as const;

/** 実応答の候補（processability unverified・input_disclosure confirmed・2 段）。 */
export const P6_RETREAT: Candidate = cand("retreat", "unverified", {
  id: "c2",
  reasons: [REASON],
  guarantees: {
    preconditions: "番のプレイヤーの main の段階で、本人のバトル場のポケモンがうら（マチスの秘策）で、控えがいる。",
    acceptance: "保証しない。入力の検査は形（選べるものの番号・段の並び・重なり）だけ。",
    after_acceptance: "評価していない",
  },
  choices_format: "[入れ替える控えの番号, トラッシュするエネルギーの番号, ...]（エネルギーは選んだ順）",
  input_stages: [
    { stage: 1, input: "choose_option" },
    { stage: 2, input: "choose_option" },
  ],
});

/** 実応答の段。energies はトラッシュの段の選べるもの（id と card_id。units はない）。 */
export function p6Stages(energies: { id: string; card_id: string; special?: boolean }[] = P6_ENERGIES, extra: Record<string, unknown> = {}): InputStage[] {
  return [
    {
      stage: 1,
      input: "choose_option",
      role: "new_active",
      meaning: "pokemon",
      count: { min: 1, max: 1 },
      options: [{ id: "o1", pokemon: 1, card: 0, zone: "bench", bench_index: 0, card_id: "PMCG1-058", eligible: true, processability: "unverified", reasons: [REASON] }],
      order: "not_applicable",
    },
    {
      stage: 2,
      input: "choose_option",
      role: "discard",
      meaning: "card",
      count: { min: 0, max: energies.length },
      options: energies.map((e, i) => ({ id: e.id, card: 5 + i, card_id: e.card_id, special: e.special ?? false, eligible: true, processability: "unverified", reasons: [REASON] })),
      distinct: true,
      order: "significant",
      order_preserved: true,
      cost_evaluation: { ...P6_COST, omitted: [...P6_COST.omitted] },
      note: "うらのバトル場のポケモン: にげるエネルギーとカードごとのエネルギーの個数は評価していない（cost_evaluation。total_units・units を省いた。0 と見なさない・本当のカードから求めない）。トラッシュの並びは選んだ順。足りるか・余るかは、エンジンがおもてにしてから確かめる",
      ...extra,
    } as InputStage,
  ];
}

export const P6_ENERGIES = [
  { id: "o2", card_id: "PMCG1-102" },
  { id: "o3", card_id: "PMCG1-102" },
];
export const P6_STAGES = p6Stages();

/** 本人の観測のうらのバトル場のポケモン（real は本人にだけ。GUI は費用・個数の計算に使わない）。 */
export const OWN_FACE_DOWN_ACTIVE = {
  pokemon_id: 3,
  face_down: true,
  damage: 0,
  energy: [
    { card: 5, card_id: "PMCG1-102" },
    { card: 6, card_id: "PMCG1-102" },
  ],
  trainers: [],
  special_conditions: [],
  persistent_effects: [],
  markers: [],
  real: { card: 4, card_id: "PMCG1-054", name_ja: "イワーク" },
};
/** 相手・観戦者の観測（real がない）。 */
export const OTHERS_FACE_DOWN_ACTIVE = (({ real: _real, ...rest }) => rest)(OWN_FACE_DOWN_ACTIVE);
