// U7-5e（特殊能力）の模擬の応答。
// - 実応答の形（固定版のエンジン v0.171.0・74c8e1f。server/tests/test_u7_5e.py と同じ固定例から得た）:
//   ROCKET_*（［ほのおをもらう］2 段。元は 2 匹）、TRANS_*（［エナジートランス］3 段。元は 1 匹・エネルギー 3 枚）、KADABRA_*（［ぶっしつこうかん］入力なし）、
//   DISCARD_DECISION_STAGES（受理のあとの手札のカードを選ぶ決定）
// - 実エンジンの通常の操作では届いていない（エンジンの docs/legal-actions-u7-5e.md 7.1 の JSON の例と legal_actions.py の _power_candidate・_public_pokemon から作った）:
//   TRANS_TWO_SOURCES_STAGES（元が 2 匹の 3 段）、CURSE_*（相手の場の元と先。相手のうらのカードは位置と face_down だけ）、WITHHELD_POWER（宣言のない型。入力非公開）
import type { Candidate, InputStage } from "../api/types";
import { cand } from "./fixtures";

const MAY = { eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated"] } as const;
const NOTE = "選べるものは options_by_choice（前の段の選ぶものの番号ごと）。番号は前のすべての段の選び方ごとに別（after が前の段の番号）。前の段を変えたら、この段とあとの段の選び方・入力の検査の結果は無効";

function stages(n: number): { stage: number; input: string }[] {
  return Array.from({ length: n }, (_, i) => ({ stage: i + 1, input: "choose_option" }));
}

export function power(id: string, nameJa: string, pokemon: Record<string, unknown>, n: number, extra: Partial<Candidate> = {}): Candidate {
  return cand("use_power", "may_stop_later", {
    id,
    reasons: ["continuation_not_evaluated"],
    pokemon: pokemon as never,
    power: { index: 0, name_ja: nameJa, card: pokemon.card as number, card_id: pokemon.card_id as string },
    choices_format: n === 0 ? "[]" : "[段の順]",
    input_disclosure: n === 0 ? "no_input" : "confirmed",
    input_stages: stages(n),
    ...extra,
  });
}

function first(role: string, meaning: string, options: unknown[]): InputStage {
  return { stage: 1, input: "choose_option", role, meaning, count: { min: 1, max: 1 }, options, order: "not_applicable" } as InputStage;
}

function chained(stage: number, role: string, meaning: string, options: Record<string, unknown>[]): InputStage {
  const byChoice: Record<string, unknown[]> = {};
  for (const o of options) (byChoice[o.after as string] ??= []).push({ option: o.id, ...MAY });
  return {
    stage,
    input: "choose_option",
    role,
    meaning,
    count: { min: 1, max: 1 },
    options: options.map((o) => ({ ...o, ...MAY })),
    order: "not_applicable",
    depends_on_stage: stage - 1,
    upstream_stages: Array.from({ length: stage - 1 }, (_, i) => i + 1),
    options_by_choice: byChoice,
    note: NOTE,
  } as unknown as InputStage;
}

/** ロケット団のヒトカゲの［ほのおをもらう］（実応答の形。番 3 に炎エネルギーのついたポニータ・コラッタがいる）。 */
export const ROCKET = power("c4", "ほのおをもらう", { pokemon: 3, card: 2, zone: "bench", bench_index: 0, card_id: "PMCG4-012" }, 2);
export const ROCKET_STAGES: InputStage[] = [
  first("source", "pokemon", [
    { id: "o1", pokemon: 1, card: 9, zone: "active", card_id: "PMCG1-016", ...MAY },
    { id: "o2", pokemon: 4, card: 12, zone: "bench", bench_index: 1, card_id: "PMCG1-060", ...MAY },
  ]),
  chained(2, "energy", "card", [
    { id: "o3", card: 26, card_id: "PMCG1-098", after: "o1" },
    { id: "o4", card: 31, card_id: "PMCG1-098", after: "o2" },
  ]),
];

/** フシギバナの［エナジートランス］（実応答の形。元はフシギバナ 1 匹、エネルギー 3 枚、先はベンチのフシギダネ）。 */
export const TRANS = power("c3", "エナジートランス", { pokemon: 1, card: 9, zone: "active", card_id: "PMCG1-011" }, 3);
export const TRANS_STAGES: InputStage[] = [
  first("source", "pokemon", [{ id: "o1", pokemon: 1, card: 9, zone: "active", card_id: "PMCG1-011", ...MAY }]),
  chained(2, "energy", "card", [
    { id: "o2", card: 26, card_id: "PMCG1-097", after: "o1" },
    { id: "o3", card: 59, card_id: "PMCG1-097", after: "o1" },
    { id: "o4", card: 23, card_id: "PMCG1-097", after: "o1" },
  ]),
  chained(3, "target", "pokemon", [
    { id: "o5", pokemon: 3, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-001", after: "o2" },
    { id: "o6", pokemon: 3, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-001", after: "o3" },
    { id: "o7", pokemon: 3, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-001", after: "o4" },
  ]),
];

/** 元が 2 匹の 3 段（文書の 7.1 の形: 元ごと・エネルギーごとに別の番号）。 */
export const TRANS_TWO_SOURCES_STAGES: InputStage[] = [
  first("source", "pokemon", [
    { id: "o1", pokemon: 1, card: 9, zone: "active", card_id: "PMCG1-011", ...MAY },
    { id: "o2", pokemon: 2, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-001", ...MAY },
  ]),
  chained(2, "energy", "card", [
    { id: "o3", card: 26, card_id: "PMCG1-097", after: "o1" },
    { id: "o4", card: 27, card_id: "PMCG1-097", after: "o1" },
    { id: "o5", card: 40, card_id: "PMCG1-097", after: "o2" },
  ]),
  chained(3, "target", "pokemon", [
    { id: "o6", pokemon: 2, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-001", after: "o3" },
    { id: "o7", pokemon: 2, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-001", after: "o4" },
    { id: "o8", pokemon: 1, card: 9, zone: "active", card_id: "PMCG1-011", after: "o5" },
  ]),
];

/** ダークユンゲラーの［ぶっしつこうかん］（実応答の形。入力なし）。 */
export const KADABRA = power("c4", "ぶっしつこうかん", { pokemon: 1, card: 5, zone: "active", card_id: "PMCG4-034" }, 0);
/** 受理のあとの決定（実応答の形。手札のカードを 1 枚選ぶ。辞退できない）。 */
export const DISCARD_DECISION_STAGES: InputStage[] = [
  {
    stage: 1,
    input: "choose_option",
    decision_kind: "discard_from_hand",
    meaning: "card",
    count: { min: 1, max: 1 },
    distinct: true,
    order: "not_applicable",
    order_preserved: true,
    decline: false,
    options: [
      { id: "o1", card: 23, card_id: "PMCG1-101", processability: "may_stop_later" },
      { id: "o2", card: 9, card_id: "PMCG1-101", processability: "may_stop_later" },
    ],
  } as InputStage,
];

/** ゲンガーの［のろい］の形（文書の S(opp)+T(opp)）: 相手のうらのベンチは位置と face_down だけ。うらのカードを含む組は unverified。 */
export const CURSE = power("c5", "のろい", { pokemon: 1, card: 7, zone: "active", card_id: "PMCG3-005" }, 2);
export const CURSE_STAGES: InputStage[] = [
  first("source", "pokemon", [
    { id: "o1", pokemon: 20, card: 70, zone: "active", card_id: "PMCG1-050", ...MAY },
    { id: "o2", pokemon: 21, zone: "bench", bench_index: 0, face_down: true, eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] },
  ]),
  {
    ...(chained(2, "target", "pokemon", [{ id: "o3", pokemon: 21, zone: "bench", bench_index: 0, face_down: true, after: "o1" }]) as object),
    options: [{ id: "o3", pokemon: 21, zone: "bench", bench_index: 0, face_down: true, after: "o1", eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] }],
    options_by_choice: { o1: [{ option: "o3", eligible: true, processability: "unverified", reasons: ["face_down_reveal_not_evaluated"] }] },
  } as unknown as InputStage,
];

/** 宣言のない型（文書の形）: 入力の形を推測せず、入力を返さない。 */
export const WITHHELD_POWER = power("c6", "ふしぎなちから", { pokemon: 2, card: 8, zone: "bench", bench_index: 0, card_id: "PMCG2-001" }, 0, {
  processability: "not_implemented",
  reasons: ["input_boundary_unconfirmed"],
  input_disclosure: "unconfirmed",
});
