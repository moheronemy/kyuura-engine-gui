// U7-4（ワザの宣言）の模擬の応答。
// - JAB_STAGES・DRY_UP_STAGES・ATTACK_CANDIDATE・結果の封筒: 固定版のエンジン（v0.166.0・9506d63）の実際の応答（seed を固定した new_game）の形
// - ADDON_STAGES・ROUTE_STAGES・FACE_DOWN_ATTACK_STAGES・REJECTED_HC1: 実エンジンの通常の操作では届いていない。形はエンジンの
//   docs/legal-actions-u7-4.md（7.1 の JSON の例）と legal_actions.py の _attack_candidate・_addon_specs・_face_down_attack_candidate から作った
import type { InputStage } from "../api/types";
import { cand } from "./fixtures";

const MAY = { eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated", "preflight_not_evaluated"] } as const;
const NOTE = "宣言といっしょに選ぶもの（0 個でもよい）。選べるのは options_by_choice（1 段目の番号ごと）。";

export const ATTACK_CANDIDATE = cand("use_attack", "may_stop_later", {
  id: "c3",
  reasons: ["continuation_not_evaluated", "preflight_not_evaluated"],
  input_disclosure: "confirmed",
  choices_format: "[ワザの番号, 宣言といっしょに選ぶものの番号, ...]（いっしょに選ぶものは選んだ順。0 個でもよい）",
  input_stages: [
    { stage: 1, input: "choose_option" },
    { stage: 2, input: "choose_option" },
  ],
});

function declaration(options: unknown[], byChoice: Record<string, unknown[]>, extra: Record<string, unknown> = {}): InputStage {
  return {
    stage: 2,
    input: "choose_option",
    role: "declaration_options",
    meaning: "declaration_option",
    count: { min: 0, max: options.length },
    options,
    depends_on_stage: 1,
    options_by_choice: byChoice,
    distinct: true,
    decline: true,
    order: "significant",
    order_preserved: true,
    note: NOTE,
    ...extra,
  } as InputStage;
}

function attacks(options: unknown[]): InputStage {
  return { stage: 1, input: "choose_option", role: "attack", meaning: "attack", count: { min: 1, max: 1 }, options, order: "not_applicable" } as InputStage;
}

/** エビワラーのジャブ（実応答）。宣言といっしょに選ぶものはない。 */
export const JAB_STAGES: InputStage[] = [
  attacks([{ id: "o1", card: 1, card_id: "PMCG1-058", attack_index: 0, route: "form", name_ja: "ジャブ", cost: ["fighting"], damage: "20", text_ja: null, ...MAY }]),
  declaration([], { o1: [] }),
];

/** ファイヤーのドライアップ（実応答の形）。対象・コインは宣言のあと（入力にない）。 */
export const DRY_UP_STAGES: InputStage[] = [
  attacks([
    {
      id: "o1",
      card: 0,
      card_id: "ES2-005",
      attack_index: 0,
      route: "form",
      name_ja: "ドライアップ",
      cost: ["fire", "fire"],
      damage: null,
      text_ja: "相手の場のポケモンを1匹選ぶ。その後、「うら」が出るまでコインを投げ続け、「おもて」の数ぶんの「水」エネルギーカードを、そのポケモンからはがしてトラッシュする。",
      ...MAY,
    },
  ]),
  declaration([], { o1: [] }),
];

/** 宣言といっしょに選ぶもの（模擬）: 2 つのワザ、スタジアムのコイン・自身の特殊能力・場のポケモンの特殊能力。o2 とコインの組は未裁定。 */
export const ADDON_STAGES: InputStage[] = [
  attacks([
    { id: "o1", card: 1, card_id: "PMCG1-058", attack_index: 0, route: "form", name_ja: "ワザA", cost: ["lightning", "colorless"], damage: "30", text_ja: "説明A", ...MAY },
    { id: "o2", card: 1, card_id: "PMCG1-058", attack_index: 1, route: "form", name_ja: "ワザB", cost: [], damage: "10+", text_ja: null, ...MAY },
  ]),
  declaration(
    [
      { id: "o3", addon: "stadium_coin", card: 40, card_id: "PMCG5-076", ...MAY },
      { id: "o4", addon: "attack_power", pokemon: 1, ...MAY },
      { id: "o5", addon: "with_power", pokemon: 3, card: 7, zone: "bench", bench_index: 0, card_id: "PMCG1-029", power: "XXXXX", ...MAY },
    ],
    {
      o1: [
        { option: "o3", eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated", "preflight_not_evaluated"] },
        { option: "o5", eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated", "preflight_not_evaluated"] },
      ],
      o2: [
        { option: "o3", eligible: false, processability: "unresolved_ruling", reasons: ["stops_before_acceptance"] },
        { option: "o4", eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated", "preflight_not_evaluated"] },
        { option: "o5", eligible: true, processability: "may_stop_later", reasons: ["continuation_not_evaluated", "preflight_not_evaluated"] },
      ],
    },
  ),
];

/** コピー・許可のワザの持ち方（模擬）: ［サイコリンク］（provider）と［にんぎょうつかい］（payer・grantors）、選ぶと止めるワザ。 */
export const ROUTE_STAGES: InputStage[] = [
  attacks([
    { id: "o1", card: 5, card_id: "PMCG1-030", attack_index: 0, route: "psylink", provider: 3, name_ja: "ワザC", cost: ["psychic"], damage: "20", text_ja: null, ...MAY },
    { id: "o2", card: 6, card_id: "PMCG1-029", attack_index: 1, route: "puppet", provider: 3, payer: 3, grantors: [3], name_ja: "ワザD", cost: ["colorless"], damage: null, text_ja: "説明D", ...MAY },
    { id: "o3", card: 6, card_id: "PMCG1-029", attack_index: 0, route: "recall", name_ja: "ワザE", cost: ["colorless"], damage: "10", text_ja: null, eligible: false, processability: "unresolved_ruling", reasons: ["stops_before_acceptance"] },
  ]),
  declaration([], { o1: [], o2: [], o3: [] }),
];

/** 本人のうらのバトル場のポケモンのワザ（模擬）: 本人が知る本当のカード（候補にある card_id）・route なし・unverified。いっしょに選ぶものは示さない。 */
export const FACE_DOWN_ATTACK_STAGES: InputStage[] = [
  attacks([
    {
      id: "o1",
      card: 9,
      card_id: "SECRET-1",
      attack_index: 0,
      face_down: true,
      name_ja: "ひみつのワザ",
      cost: ["colorless"],
      damage: "10",
      text_ja: null,
      eligible: true,
      processability: "unverified",
      reasons: ["face_down_reveal_not_evaluated"],
    },
  ]),
  { ...(declaration([], { o1: [] }) as object), count: { min: 0, max: 0 }, order: "not_applicable" } as InputStage,
];

/** 送信の結果（client_api の submit の応答）。 */
export function submit(outcome: string, result: Record<string, unknown> | null, extra: Record<string, unknown> = {}) {
  return {
    contract: "kyuura-client-api",
    format: 1,
    type: "submit",
    ok: true,
    outcome,
    refusal: null,
    result:
      result === null
        ? null
        : {
            kyuura_diagnostic_schema: 1,
            role: "actor",
            viewer: 0,
            outcome,
            status: "in_progress",
            stage: "turn_action",
            continuable: true,
            next: [],
            diagnostic_id: null,
            category: null,
            subkind: null,
            case_id: null,
            case_status: null,
            message: null,
            halt: null,
            operation_id: "x",
            ...result,
          },
    refetch_required: outcome === "accepted",
    ...extra,
  };
}

export const ACCEPTED_TURN_MOVES = submit("accepted", { next: [{ kind: "turn_action", player: 1 }] });
export const ACCEPTED_AWAITING_OWN = submit("accepted", { status: "awaiting_decision", next: [{ kind: "answer_decision", player: 0 }] });
export const ACCEPTED_AWAITING_OTHER = submit("accepted", { status: "awaiting_decision", next: [{ kind: "answer_decision", player: 1 }] });
export const ACCEPTED_GAME_OVER = submit("accepted", { status: "game_over", continuable: false });
const DU1 = {
  diagnostic_id: "UNRESOLVED_DRY_UP_WATER_ENERGY_SHORT",
  category: "unresolved_ruling",
  case_id: "UNRESOLVED_DRY_UP_WATER_ENERGY_SHORT",
  case_status: "identified",
  message: "この場面の扱いは、今のルールと記録からは決まらないため、エンジンは対戦を止めました。",
  interrupted: true,
};
export const ACCEPTED_HALTED = submit("accepted", { status: "halted", continuable: false, halt: DU1 });
/** エンジンの拒否（宣言の前の先読みの停止。HC1 の形）。状態は変わらない・取っ手は失効しない。 */
export const REJECTED_HC1 = submit(
  "rejected",
  { outcome: "rejected", diagnostic_id: "UNRESOLVED_CONFUSED_ENERGY_DISCARD", category: "unresolved_ruling", message: "この場面の扱いは決まらないため、宣言を受け付けませんでした。" },
  { refetch_required: false },
);
export const REFUSED_INVALID = submit("refused", null, { refusal: { code: "CANDIDATE_INPUT_INVALID", message: "入力が候補の制約に合わない" }, refetch_required: false });
export const FAILED = submit("failed", { status: "unavailable", continuable: false, diagnostic_id: "INTERNAL_ERROR", category: "internal_error" }, { refetch_required: true });
