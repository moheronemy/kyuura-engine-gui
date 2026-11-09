// 0.175.0（U-R3a。本人のうらのカードの、宣言の段が 2〜3 段の特殊能力）の模擬の応答。形は固定版のエンジン（81e9e99）の実応答（server/tests/r3a_boards.py の
// 構築盤面。new_game からではない）に合わせた（番号・uid・場のポケモンの番号・段・options_by_choice・after は実応答の値。guarantees・note の文は短くした）。
// 盤面: 自分のバトル場は闘エネルギー 2 枚のエビワラー（場のポケモン 1）、ベンチは炎・水エネルギーのコラッタ（2）と、うらのポケモン（4。何もついていない）。
import type { Candidate, InputStage, OptionStage } from "../api/types";
import { cand } from "./fixtures";

export const REASON = "face_down_reveal_not_evaluated";
const U = { eligible: true, processability: "unverified", reasons: [REASON] } as const;
export const FACE_DOWN_POKEMON = { pokemon: 4, card: 7, zone: "bench", bench_index: 1, face_down: true } as const;
const GUARANTEES = {
  preconditions: "本人のうらのカードの、本当のカードの印刷の特殊能力。2〜3 段は前の段の選び方ごとの番号の構造の組で、受け付けるかで絞らない。check は段の数・番号・前の段との依存だけ",
  acceptance: "保証しない。エンジンはこのポケモンをおもてにしてから決める（たねなら確かめ、受け付けなければ拒否。たねでなければトラッシュして受理）",
  after_acceptance: "評価していない",
  supported_scope: "うらのカードの特殊能力の候補は unverified",
};

function power(id: string, name: string, cardId: string, roles: string[]): Candidate {
  return cand("use_power", "unverified", {
    id,
    reasons: [REASON],
    guarantees: GUARANTEES,
    pokemon: FACE_DOWN_POKEMON as never,
    power: { index: 0, name_ja: name, card: 7, card_id: cardId, face_down: true },
    choices_format: `[${roles.map((r) => `${r} の番号`).join(", ")}]（段の順）`,
    input_disclosure: "confirmed",
    input_stages: roles.map((_, i) => ({ stage: i + 1, input: "choose_option" })),
  });
}

/** 実応答: ロケット団のヒトカゲ［ほのおをもらう］（たね。source → energy の 2 段）。 */
export const RC_POWER = power("c4", "ほのおをもらう", "PMCG4-012", ["source", "energy"]);
/** 実応答: フシギバナ［エナジートランス］（2 進化。source → energy → target の 3 段）。 */
export const VENUSAUR_POWER = power("c4", "エナジートランス", "PMCG1-011", ["source", "energy", "target"]);

const HITMONCHAN = { pokemon: 1, card: 0, zone: "active", card_id: "PMCG1-058" } as const;
const RATTATA = { pokemon: 2, card: 3, zone: "bench", bench_index: 0, card_id: "PMCG1-060" } as const;
const ENERGIES = [
  { id: "o3", card: 1, card_id: "PMCG1-102", after: "o1" },
  { id: "o4", card: 2, card_id: "PMCG1-102", after: "o1" },
  { id: "o5", card: 4, card_id: "PMCG1-098", after: "o2" },
  { id: "o6", card: 5, card_id: "PMCG1-099", after: "o2" },
] as const;
const FIRST_NOTE = "うらのカードの特殊能力（2〜3 段）: 選べるものは宣言の場所の並び。あとの段は前の段の選び方ごとの番号（options_by_choice）。組は構造だけで、受け付けるかは確かめていない（エンジンがおもてにしてから確かめる）";
const LATER_NOTE = "選べるものは options_by_choice（前の段の選ぶものの番号ごと）。番号は前のすべての段の選び方ごとに別。前の段を変えたら、この段とあとの段の選び方・入力の検査の結果は無効";

function byChoice(options: { id: string; after: string }[]): Record<string, { option: string; eligible: boolean; processability: string; reasons: string[] }[]> {
  const out: Record<string, { option: string; eligible: boolean; processability: string; reasons: string[] }[]> = {};
  for (const o of options) (out[o.after] ??= []).push({ option: o.id, ...U, reasons: [REASON] });
  return out;
}

const first = (): OptionStage =>
  ({
    stage: 1,
    input: "choose_option",
    role: "source",
    meaning: "pokemon",
    count: { min: 1, max: 1 },
    options: [
      { id: "o1", ...HITMONCHAN, ...U, reasons: [REASON] },
      { id: "o2", ...RATTATA, ...U, reasons: [REASON] },
    ],
    order: "not_applicable",
    note: FIRST_NOTE,
  }) as OptionStage;

const second = (): OptionStage =>
  ({
    stage: 2,
    input: "choose_option",
    role: "energy",
    meaning: "card",
    count: { min: 1, max: 1 },
    options: ENERGIES.map((e) => ({ ...e, ...U, reasons: [REASON] })),
    order: "not_applicable",
    depends_on_stage: 1,
    upstream_stages: [1],
    options_by_choice: byChoice([...ENERGIES]),
    note: LATER_NOTE,
  }) as OptionStage;

/** 3 段目: (source, energy) の 4 組ごとに、自分の場の 3 匹（エビワラー・コラッタ・うらのポケモン（カード ID なし））。番号は o7〜o18。 */
const THIRD_OPTIONS = ENERGIES.flatMap((e, i) =>
  [HITMONCHAN, RATTATA, FACE_DOWN_POKEMON].map((p, j) => ({ id: `o${7 + i * 3 + j}`, ...p, after: e.id })),
);
const third = (): OptionStage =>
  ({
    stage: 3,
    input: "choose_option",
    role: "target",
    meaning: "pokemon",
    count: { min: 1, max: 1 },
    options: THIRD_OPTIONS.map((o) => ({ ...o, ...U, reasons: [REASON] })),
    order: "not_applicable",
    depends_on_stage: 2,
    upstream_stages: [1, 2],
    options_by_choice: byChoice(THIRD_OPTIONS),
    note: LATER_NOTE,
  }) as OptionStage;

export const rcStages = (): InputStage[] => [first(), second()];
export const venusaurStages = (): InputStage[] => [first(), second(), third()];
export const RC_STAGES = rcStages();
export const VENUSAUR_STAGES = venusaurStages();

/** 本人の観測のうらのベンチのポケモン（real は本人の観測にだけ）。相手・観戦者には real がない。 */
export const OWN_FACE_DOWN_BENCH = {
  pokemon_id: 4,
  face_down: true,
  damage: 0,
  energy: [],
  trainers: [],
  special_conditions: [],
  persistent_effects: [],
  markers: [],
  real: { card: 7, card_id: "PMCG4-012", name_ja: "ヒトカゲ" },
};
export const OTHERS_FACE_DOWN_BENCH = (({ real: _real, ...rest }) => rest)(OWN_FACE_DOWN_BENCH);
