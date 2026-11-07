// client_api（契約 kyuura-client-api・形式 1）と、ローカル接続層（gui_server 1）の JSON に対応する型。
// エンジンの Python の型（GameState・CommandResult など）はここに持ち込まない。応答に含まれる JSON の形だけ。
// 表示に使わない項目は `unknown` のまま通す（型で中身を決めつけない）。

export type PlayerIndex = 0 | 1;
export type SeatKey = "player0" | "player1" | "spectator";

// ---------------------------------------------------------------- 共通

export interface ClientErrorBody {
  code: string;
  message: string;
}

/** client_api の誤りの応答（ok が偽）。 */
export interface ClientErrorResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: string | null;
  ok: false;
  error: ClientErrorBody;
}

export interface Refusal {
  code: string;
  message: string;
}

// ---------------------------------------------------------------- 状態と観測

export type WaitingBy = PlayerIndex | "players" | "host";

export interface Waiting {
  kind: string;
  by: WaitingBy;
}

export interface HaltInfo {
  diagnostic_id: string | null;
  category: string | null;
  case_id?: string | null;
  case_status?: string | null;
  message: string | null;
  interrupted?: boolean;
}

export interface ConventionRef {
  id: string;
  version: number;
  digest?: string;
}

export interface StatusInfo {
  status: string;
  phase?: string;
  segment?: number;
  continuable: boolean;
  waiting: Waiting[];
  halt?: HaltInfo | null;
  convention_set?: ConventionRef | null;
}

export interface CardRef {
  card: number;
  card_id: string;
  name_ja?: string;
}

export interface AttackRef {
  card_id?: string;
  attack_index?: number;
  name_ja?: string;
  problem?: string | null;
}

export interface FieldPokemon {
  pokemon_id: number;
  card: number;
  card_id: string;
  name_ja: string;
  hp: number;
  printed_hp?: number;
  damage: number;
  pokemon_type?: string | null;
  weakness?: string | null;
  resistance?: string | null;
  resistance_value?: number;
  energy: CardRef[];
  trainers: unknown[];
  special_conditions: string[];
  persistent_effects?: string[];
  markers?: unknown[];
  evolution_stack?: unknown[];
  attacks?: AttackRef[];
  powers?: unknown[];
  [key: string]: unknown;
}

export interface FaceDownPokemon {
  face_down: true;
}

export type FieldSlot = FieldPokemon | FaceDownPokemon;

export interface PlayerObservation {
  player: PlayerIndex;
  hand: { count: number; cards: CardRef[] | null; revealed_by: unknown[] };
  deck: { count: number; [key: string]: unknown };
  prizes: { count: number; face_up: (CardRef & { position: number })[] };
  set_aside: { kind: string; count: number; cards: CardRef[] | null; [key: string]: unknown }[];
  discard: CardRef[];
  active: FieldSlot | null;
  bench: FieldSlot[];
}

/** 観測の決定（相手・観戦者には種類・決める人・数だけ）。 */
export interface PublicDecision {
  kind: string;
  player: PlayerIndex;
  min_choices?: number;
  max_choices?: number;
  option_count?: number;
  [key: string]: unknown;
}

export interface Observation {
  viewer: PlayerIndex | null;
  turn: number;
  current_player: PlayerIndex | null;
  phase: string;
  players: [PlayerObservation, PlayerObservation];
  stadium: (CardRef & { owner: PlayerIndex }) | null;
  trainer_in_use: (CardRef & { player: PlayerIndex }) | null;
  decision: PublicDecision | null;
  result: { outcome: string; winner: PlayerIndex | null } | null;
  segment?: { index: number; prize_count: number; previous: unknown[] };
  [key: string]: unknown;
}

export type ViewerLabel = PlayerIndex | "spectator" | "host";

export interface ViewResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: "view";
  ok: true;
  viewer: ViewerLabel;
  status: StatusInfo;
  observation: Observation;
}

// ---------------------------------------------------------------- 候補

export interface Coverage {
  implemented_kinds: string[];
  scope_kinds: string[];
  offered_kinds: string[];
  not_covered_kinds: string[];
  withheld_input_candidates: string[];
  completeness: string;
  completeness_scope: string;
}

export interface Candidate {
  id: string;
  kind: string;
  processability: string;
  reasons: string[];
  guarantees: Record<string, string>;
  input_disclosure: string;
  input_stages: { stage: number; input: string }[];
  choices_format?: string;
}

export interface LegalActions {
  kyuura_legal_actions_format: 1;
  game: string;
  actor: PlayerIndex | "host";
  revision: string;
  status: string;
  situation: string;
  empty_reason: string | null;
  coverage: Coverage;
  candidates: Candidate[];
}

export interface CandidatesResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: "candidates";
  ok: true;
  response: LegalActions;
}

// ---------------------------------------------------------------- 入力

export interface InputOption {
  id: string;
  processability: string;
  value?: number | string;
  card?: number;
  card_id?: string;
  placement?: string;
  eligible?: boolean;
  convention?: string;
  [key: string]: unknown;
}

export interface Count {
  min: number;
  max: number;
}

export interface OptionStage {
  stage: number;
  input: "choose_option";
  role?: string;
  decision_kind?: string;
  meaning?: string;
  count: Count;
  options?: InputOption[];
  options_from_stage?: number;
  distinct?: boolean;
  distinct_across_stages?: boolean;
  order: string;
  order_preserved?: boolean;
  decline?: boolean;
  note?: string;
}

export interface ValueStage {
  stage: number;
  input: "choose_value";
  decision_kind?: string;
  meaning?: string;
  range: { min: number; max: number; unit?: string };
  count: Count;
  order: string;
  remaining?: number;
  decline?: boolean;
  note?: string;
}

export type InputStage = OptionStage | ValueStage;

export interface InputsBody {
  candidate: string;
  kind: string;
  stages: InputStage[];
  /** 入力の情報境界が未確認（input_disclosure が unconfirmed）。選べるもの・数・並びは返されない。 */
  withheld?: Refusal;
}

export interface InputsResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: "inputs";
  ok: boolean;
  response: InputsBody | { refusal: Refusal };
  refetch_required: boolean;
}

export interface CheckResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: "check";
  ok: true;
  response: { valid: boolean; refusal: Refusal | null };
  refetch_required: boolean;
}

/** 送り手への定型の診断（プレイヤーは U1 の本人への診断、ホストは HostNotice）。 */
export interface SenderDiagnostic {
  role: "actor" | "host";
  outcome: string;
  status: string;
  continuable: boolean;
  next: { kind: string; player: PlayerIndex | null }[];
  diagnostic_id: string | null;
  category: string | null;
  message: string | null;
  halt: HaltInfo | null;
  operation_id: string | null;
  [key: string]: unknown;
}

export interface SubmitResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: "submit";
  ok: true;
  outcome: string;
  refusal: Refusal | null;
  result: SenderDiagnostic | null;
  refetch_required: boolean;
}

export type Choice = string | number;

// ---------------------------------------------------------------- 公開の更新（接続層が閲覧者ごとに保持）

export interface UpdateItem {
  contract: "kyuura-client-api";
  format: 1;
  type: "update";
  number: number;
  status: StatusInfo;
  observation: Observation | null;
}

export interface UpdatesResponse {
  gui_server: 1;
  ok: true;
  kind: "updates";
  latest: number;
  oldest_retained: number | null;
  gap: boolean;
  updates: UpdateItem[];
}

// ---------------------------------------------------------------- 接続層

export interface MatchInfo {
  match_id: string;
  origin: { kind: string; label: string; description?: string; scenario?: string; conventions?: string | null };
  seats: Record<SeatKey, { token: string }>;
  host: { token: string };
}

export interface StartNotice {
  outcome: string;
  status: string;
  diagnostic: { diagnostic_id: string; category: string; message: string } | null;
}

export interface DeckDiagnostic {
  code: string;
  message: string;
}

export interface CreateMatchResult {
  ok: boolean;
  start: StartNotice | null;
  deck_diagnostics: DeckDiagnostic[][] | null;
  match?: MatchInfo;
  error?: ClientErrorBody;
}

export interface PresetDeck {
  id: string;
  name_ja: string;
  entries: { card_id: string; count: number; name_ja: string | null }[];
}

export interface CatalogCard {
  id: string;
  name_ja: string;
  category: string;
  stage: string | null;
  hp: number | null;
}

export interface ScenarioInfo {
  id: string;
  label: string;
  description: string;
}

export interface DeckEntry {
  card_id: string;
  count: number;
}

export type CreateMatchRequest =
  | { mode: "decks"; decks: [{ entries: DeckEntry[] }, { entries: DeckEntry[] }]; conventions?: string }
  | { mode: "scenario"; scenario: string };
