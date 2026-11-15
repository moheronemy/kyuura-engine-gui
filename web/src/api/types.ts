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
  /** 公開の値（うらのカードでも観測が返す。マチスの秘策のカードなど）。どのカードかは来ない。 */
  pokemon_id?: number;
  damage?: number;
  energy?: CardRef[];
  /** 持ち主の観測だけにある、本人が知っている本当のカード（マチスの秘策など）。ほかの閲覧者の観測にはない（validate.ts が確かめる）。 */
  real?: CardRef;
  [key: string]: unknown;
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
  /** U7-5f: 表示だけの種類（評価した種類のうち、送ればエンジンに渡す前に断るもの。check_face_up_deck）。 */
  display_only_kinds: string[];
  /** U7-5g-3: complete の意味の説明（エンジンの文）。complete でも全部の操作の受理・完走ではない。 */
  completeness_basis: string;
  /** U7-5g-3: scope_kinds の種類にある、示さない経路（residual の not_offered）の分類 id（completeness を partial にする理由）。 */
  partial_residual: string[];
  /** U7-5g-3: 残りの分類（classes は API 全体で同じ値）と、この応答に当てはまる残り（present）。 */
  residual: { classes: ResidualClass[]; present: ResidualPresent[] };
  /** U7-5g-3: unverified の候補・選べるもの・組の理由ごとの候補（送るまで受理が分からない経路。completeness とは別の軸）。 */
  unverified_paths: { reason: string; candidates: string[] }[];
}

/** U7-5g-3: 残りの分類（R-2〜R-5。R-1 は欠番）。 */
export interface ResidualClass {
  id: string;
  kind: string | null;
  field: string;
  situation: string;
  status: string;
  reason: string;
  subject: string;
  note: string;
}

/** U7-5g-3: この応答に当てはまる残り。public は公開の状態から、actor は本人の候補から（本人の応答にだけ。candidate はその候補の id）。 */
export interface ResidualPresent {
  id: string;
  scope: "public" | "actor";
  candidate?: string;
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
  /** U7-5d（use_stadium）: 場のスタジアム（公開）。owner は出したプレイヤーで、使うのは番のプレイヤー（持ち主でなくても使える）。 */
  stadium?: StadiumRef;
  /** U7-5e（use_power）: 特殊能力を使う本人の場のポケモン。v0.172: 本人のうらのカードは face_down（カード ID なし）。 */
  pokemon?: PowerPokemon;
  /** U7-5e（use_power）: 特殊能力の位置・名前と、印刷したカード（「ばける」・写した特殊能力では場のポケモンのカードと違うことがある）。 */
  power?: PowerRef;
}

/** U7-5e: 特殊能力を使う本人の場のポケモン。 */
export interface PowerPokemon {
  pokemon: number;
  card: number;
  zone: "active" | "bench";
  bench_index?: number;
  /** おもてのポケモンだけ（本人のうらのカードにはない）。 */
  card_id?: string;
  /** v0.172（U7-5g-2）: 本人のうらのカード（盤面は裏のまま）。 */
  face_down?: true;
}

/** U7-5e: 特殊能力（index は印刷したカードの特殊能力の位置。入力の値ではない）。 */
export interface PowerRef {
  index: number;
  name_ja: string;
  card: number;
  /** 印刷したカード。face_down のときは本人が知る本当のカード（本人の候補にだけ出る。公開の盤面の情報ではない）。 */
  card_id: string;
  /** v0.172（U7-5g-2）: 本人のうらのカードの特殊能力（エンジンがおもてにしてから決める。unverified）。 */
  face_down?: true;
}

/** U7-5d: 候補の場のスタジアム。 */
export interface StadiumRef {
  card: number;
  card_id: string;
  owner: PlayerIndex;
}

/** U7-5d: スタジアムで選ぶエネルギーカードがついている本人の場のポケモン（U7-5a の場のポケモンと同じ形。うらのポケモンは face_down で card_id なし）。 */
export interface Holder {
  pokemon: number;
  card: number;
  zone: "active" | "bench";
  bench_index?: number;
  card_id?: string;
  face_down?: true;
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
  /** U7-3: 処理可能性の理由（reactions_not_evaluated など）。 */
  reasons?: string[];
  /** U7-3: 手札のエネルギーカード・トラッシュするエネルギーが特殊エネルギーか。 */
  special?: boolean;
  /** U7-3: にげるでトラッシュするエネルギー 1 枚が出す個数（無色2個エネルギーは 2）。カードの枚数ではない。 */
  units?: number;
  /** U7-3: 場のポケモンの番号・場所。 */
  pokemon?: number;
  zone?: "active" | "bench";
  bench_index?: number;
  /** U7-3: 本人のうらのポケモン（場のポケモンの選べるものでは card_id はない）。U7-4: うらのバトル場のポケモンのワザ（card_id は本人が知るカード）。 */
  face_down?: true;
  /** U7-4（role: attack）: ワザの位置（印刷したカードの何番目のワザか）。入力の値ではない（送るのは id）。 */
  attack_index?: number;
  /** U7-4: ワザの持ち方（form・recall・psylink・prehistoric・puppet・mimic）。うらのバトル場のポケモンのワザにはない。 */
  route?: string;
  /** U7-4: ワザを供給する場のポケモンの番号（［サイコリンク］など）。 */
  provider?: number;
  /** U7-4: 必要なエネルギーを払うポケモンの番号（［にんぎょうつかい］）。 */
  payer?: number;
  /** U7-4: 許可を与える特殊能力を持つ場のポケモンの番号。 */
  grantors?: number[];
  /** U7-4: 印刷のワザの名前・必要なエネルギー・ダメージの表示（印刷のまま。与えるダメージの予測ではない）・説明。 */
  name_ja?: string;
  cost?: string[];
  damage?: string | null;
  text_ja?: string | null;
  /** U7-4（role: declaration_options）: 宣言といっしょに選ぶものの種類。 */
  addon?: string;
  /** U7-4（addon: with_power）: 特殊能力の名前。 */
  power?: string;
  /** U7-5d（use_stadium の role: energy）: エネルギーカードがついている本人の場のポケモン。 */
  holder?: Holder;
  /** U7-5e（依存する段）: 直前の段の選ぶものの番号（この選ぶものはその選び方のあとだけに選べる）。 */
  after?: string;
  /** U7-5f（check_face_up_deck）: 山札の持ち主と、上からの位置（0 がいちばん上）。カード ID・名前は来ない。 */
  owner?: PlayerIndex;
  position?: number;
  [key: string]: unknown;
}

/** U7-3: 2 段の操作の、1 段目の番号ごとの組（2 段目の選べるもの・組ごとの可否）。 */
export interface PairOption {
  option: string;
  eligible: boolean;
  processability: string;
  reasons?: string[];
}

/** 0.174.0（P6）: 段の費用の評価の状態（今は not_evaluated だけ）。omitted は、この段で省いた項目の名前。 */
export interface CostEvaluation {
  status: "not_evaluated";
  reason: string;
  omitted: string[];
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
  /** U7-3: 2 段目が 1 段目の選択に依存する（options_by_choice）。 */
  depends_on_stage?: number;
  options_by_choice?: Record<string, PairOption[]>;
  /** U7-5e: 前のすべての段の番号（2 段目以降。depends_on_stage は直前の段）。 */
  upstream_stages?: number[];
  /** U7-5g-1: 前の段の選び方の組で引く段（attach_energy の 3 段目）。鍵は path_stages の段の選ぶものの番号を / でつないだもの。 */
  path_stages?: number[];
  options_by_path?: Record<string, PairOption[]>;
  /** U7-3（にげる）: トラッシュするカードの units の合計の範囲（count は枚数）。おもてのバトル場のポケモンのにげるの段だけ。 */
  total_units?: Count;
  /**
   * 0.174.0（P6。本人のうらのバトル場のポケモンのにげるのトラッシュの段だけ）: 費用・個数を評価していない印。このとき total_units と選べるものの units はない。
   * GUI は費用・個数を計算しない（0 と見なさない・本人の real・公開カード定義から求めない）。値は契約の表の retreat_cost_evaluation と同じものだけを受ける。
   */
  cost_evaluation?: CostEvaluation;
  /** U7-3（ベンチに出す）: 今のベンチの数と上限（公開の値）。 */
  bench?: { count: number; limit: number };
  /** U7-3（にげる）: こんらん（受理のあとにコイン）。 */
  confused?: boolean;
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
  name?: string;
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

/** 0.183.0: ログの位置（その区間のログの番号 index の出来事の前）。 */
export interface LogPosition {
  segment: number;
  index: number;
}

/** 0.183.0: 可視ログの出来事 1 つ（閲覧用記録の出来事と同じ形。event はその閲覧者の写しで、見えない項目は hidden に名前だけ）。 */
export interface LogItem {
  segment: number;
  log_index: number;
  event: { kind: string; [key: string]: unknown };
}

/** 0.183.0: 読み取りの要求 log の応答（最大 256 件。続きは next から。complete は next が end と同じこと）。 */
export interface LogResponse {
  contract: "kyuura-client-api";
  format: 1;
  type: "log";
  ok: true;
  entries: LogItem[];
  next: LogPosition;
  end: LogPosition;
  complete: boolean;
  baseline_end: LogPosition;
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
