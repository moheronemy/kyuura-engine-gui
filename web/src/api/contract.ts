// GUI が前提にする client_api の契約の値。Python のテスト（server/tests/test_contract.py）と同じ表を読む。
// エンジンを更新したら contract/kyuura-client-api-v1.json を直し、両方のテストを通す（README「エンジンの更新」）。
import expected from "../../../contract/kyuura-client-api-v1.json";

export const CONTRACT = expected.contract; // "kyuura-client-api"
export const FORMAT = expected.format; // 1
export const LEGAL_ACTIONS_FORMAT = expected.legal_actions_format;
export const DIAGNOSTIC_SCHEMA = expected.diagnostic_schema;
export const GUI_SERVER_FORMAT = expected.gui_server_format;
export const ENGINE = expected.engine;

export const PROCESSABILITY = expected.processability as readonly string[];
export const EXECUTABLE_PROCESSABILITY = new Set<string>(expected.executable_processability);
export const INPUT_DISCLOSURE = expected.input_disclosure as readonly string[];
export const COMPLETENESS = expected.completeness as readonly string[];
export const SITUATIONS = expected.situations as readonly string[];
export const EMPTY_REASONS = expected.empty_reasons as readonly string[];
export const INPUT_KINDS = expected.input_kinds as readonly string[];
export const ORDERS = expected.orders as readonly string[];
export const OUTCOMES = expected.outcomes as readonly string[];
export const IMPLEMENTED_KINDS = expected.implemented_kinds as readonly string[];
export const TURN_KINDS_NOT_COVERED = expected.turn_kinds_not_covered as readonly string[];
export const REFETCH_REFUSALS = new Set<string>(expected.refetch_refusals);
export const TURN_BASIC_KINDS = expected.turn_basic_kinds as readonly string[];
export const MAIN_KINDS = expected.main_kinds as readonly string[];
/** GUI が入力の画面を持つ種類。ほかの種類の候補は表示だけで選べない（新しい種類を古い入力の画面へ通さない）。 */
export const GUI_OPERABLE_KINDS = new Set<string>(expected.gui_operable_kinds);
/** 入力の段の項目。ほかの項目のある段は知らない制約かもしれないので、操作を止める（validate.ts）。 */
export const STAGE_KEYS = new Set<string>(expected.stage_keys);
export const PAIR_KEYS = new Set<string>(expected.pair_keys);
export const ZONES = expected.zones as readonly string[];
export const STATUS_VALUES = expected.status_values as readonly string[];
export const NEXT_KINDS = expected.next_kinds as readonly string[];
// U7-4: ワザの宣言。段の role の並び・route・addon・cost の値・選べるものの項目は契約の表のとおりで、ほかは操作を止める（validate.ts）
export const ATTACK_KINDS = new Set<string>(expected.attack_kinds);
export const STAGE_ROLES = expected.stage_roles as Readonly<Record<string, readonly string[]>>;
export const ATTACK_ROUTES = expected.attack_routes as readonly string[];
export const DECLARATION_ADDONS = expected.declaration_addons as readonly string[];
export const ENERGY_TYPES = expected.energy_types as readonly string[];
export const ATTACK_OPTION_KEYS = new Set<string>(expected.attack_option_keys);
export const ADDON_OPTION_KEYS = new Set<string>(expected.addon_option_keys);
/** 今の入力・今の取っ手への check が通ってから送信する種類（GUI の決まり。check は受理の保証ではない）。0.174.0 から retreat も種類で含む。 */
export const CHECK_BEFORE_SUBMIT_KINDS = new Set<string>(expected.check_before_submit_kinds);
// U7-5a〜d: 場のポケモン 1 匹を指す操作・手札のトレーナー・場のスタジアム。段の role・選べるもの・holder・候補の stadium の項目は契約の表のとおりで、ほかは操作を止める（validate.ts）
export const BOARD_KINDS = new Set<string>(expected.board_kinds);
export const TRAINER_KINDS = new Set<string>(expected.trainer_kinds);
export const STADIUM_KINDS = new Set<string>(expected.stadium_kinds);
/** 段がない応答（入力なし。choices は []）も受ける種類（選ばせるもののない場のスタジアム）。 */
export const STAGE_ROLES_OR_EMPTY = new Set<string>(expected.stage_roles_or_empty);
/** stage_roles の role のうち、U7-3 の種類（にげる・エネルギーをつける）も同じ名前で使うもの。 */
export const STAGE_ROLES_SHARED = new Set<string>(expected.stage_roles_shared);
export const BOARD_OPTION_KEYS = new Set<string>(expected.board_option_keys);
export const TRAINER_OPTION_KEYS = new Set<string>(expected.trainer_option_keys);
export const STADIUM_ENERGY_OPTION_KEYS = new Set<string>(expected.stadium_energy_option_keys);
export const HOLDER_KEYS = new Set<string>(expected.holder_keys);
export const STADIUM_KEYS = new Set<string>(expected.stadium_keys);
// U7-5e: 特殊能力（use_power）。同じ種類の候補がいくつも並ぶ（候補は id で区別する）。段の role の並び・依存（upstream_stages・after）・項目は契約の表のとおり
export const POWER_KINDS = new Set<string>(expected.power_kinds);
export const POWER_STAGE_SHAPES = expected.power_stage_shapes as readonly (readonly string[])[];
export const POWER_ROLE_MEANINGS = expected.power_role_meanings as Readonly<Record<string, string>>;
export const POWER_OPTION_KEYS = new Set<string>(expected.power_option_keys);
export const POWER_CANDIDATE_POKEMON_KEYS = new Set<string>(expected.power_candidate_pokemon_keys);
export const POWER_KEYS = new Set<string>(expected.power_keys);
// U7-5f: 表示だけの種類（check_face_up_deck）。implemented_kinds にあるが gui_operable_kinds にない。候補と inputs を表示し、check・submit を呼ばない
export const DISPLAY_ONLY_KINDS = new Set<string>(expected.display_only_kinds);
export const DISPLAY_ONLY_STAGES = expected.display_only_stages as Readonly<Record<string, { role: string; meaning: string }>>;
export const FACE_UP_OPTION_KEYS = new Set<string>(expected.face_up_option_keys);
// U7-5g-1: 前の段の選び方の組で引く段（path_stages・options_by_path）。U7-5e の依存する段（upstream_stages・after）とは別の形
export const PATH_STAGE_KINDS = expected.path_stage_kinds as Readonly<
  Record<string, { stage: number; role: string; meaning: string; path_stages: readonly number[]; count: { min: number; max: number }; decline: boolean }>
>;
export const ATTACH_ENERGY_ROLE_SHAPES = expected.attach_energy_role_shapes as readonly (readonly string[])[];
export const ENERGY2_OPTION_KEYS = new Set<string>(expected.energy2_option_keys);
// U7-5g-3: coverage の項目と残り（residual）の分類。知らない項目・分類は止める
export const COVERAGE_KEYS = new Set<string>(expected.coverage_keys);
export const RESIDUAL_CLASSES = expected.residual_classes as readonly {
  id: string;
  kind: string | null;
  field: string;
  situation: string;
  status: string;
  reason: string;
  subject: string;
}[];
export const RESIDUAL_CLASS_KEYS = new Set<string>(expected.residual_class_keys);
export const RESIDUAL_STATUSES = expected.residual_statuses as readonly string[];
export const RESIDUAL_SCOPES = expected.residual_scopes as readonly string[];
export const RESIDUAL_PRESENT_KEYS = new Set<string>(expected.residual_present_keys);
// 0.174.0（P6）: にげる（retreat）。段の role の並び・トラッシュの段の選べるものの項目・費用を評価していないことの印（cost_evaluation）は契約の表のとおり。
// おもての段は total_units とすべての units を持ち、本人のうらのバトル場のポケモンの段は total_units・units を省いて cost_evaluation を持つ（validate.ts）
export const RETREAT_STAGE_ROLES = expected.retreat_stage_roles as readonly string[];
export const RETREAT_DISCARD_OPTION_KEYS = new Set<string>(expected.retreat_discard_option_keys);
export const RETREAT_COST_EVALUATION = expected.retreat_cost_evaluation as { readonly status: string; readonly reason: string; readonly omitted: readonly string[] };
