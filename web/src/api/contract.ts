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
/** 今の入力・今の取っ手への check が通ってから送信する種類（GUI の決まり。check は受理の保証ではない）。 */
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
