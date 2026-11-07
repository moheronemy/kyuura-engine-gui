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
