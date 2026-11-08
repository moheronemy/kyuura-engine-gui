// 表示の文言。エンジンの値（機械が扱う区分）を日本語にする。知らない値は値をそのまま見せる（推測で言い換えない）。

export const KIND_LABELS: Record<string, string> = {
  take_prize: "サイドを取る",
  promote_active: "バトル場に出すポケモンを選ぶ",
  answer_decision: "決定に答える",
  end_turn: "番を終える",
  place_starting: "最初のポケモンを置く",
  mulligan_draw: "切り直しの補償（引く枚数）",
  report_janken: "ジャンケンの結果を入力",
  start_sudden_death: "サドン・デスを始める",
  play_basic: "たねポケモンをベンチに出す",
  attach_energy: "エネルギーをつける",
  evolve: "進化させる",
  retreat: "にげる",
  use_attack: "ワザを使う",
  play_trainer: "手札のトレーナーを使う",
  use_power: "ポケモンパワーを使う",
  use_stadium: "場のスタジアムを使う",
  remove_disguise: "「ばける」でのせたカードを外す",
  discard_from_play: "化石・人形を場からすてる",
  reveal_face_down: "うらのカードをおもてにする",
  check_face_up_deck: "表向きの山札のカードを確かめる",
};

export const NEXT_LABELS: Record<string, string> = {
  place_starting_pokemon: "最初のポケモンを置く",
  draw_mulligan_cards: "切り直しの補償",
  report_janken_result: "ジャンケンの結果",
  turn_action: "番の操作",
  answer_decision: "決定への回答",
  start_sudden_death: "サドン・デスの開始",
};

export const STATUS_LABELS: Record<string, string> = {
  in_progress: "対戦中",
  awaiting_decision: "決定待ち",
  halted: "停止",
  game_over: "終局",
  sudden_death_pending: "サドン・デス待ち",
  not_started: "未開始",
  unavailable: "処理できない結果のあと",
};

export const PHASE_LABELS: Record<string, string> = {
  setup_placement: "準備: 最初のポケモンを置く",
  setup_mulligan_draw: "準備: 切り直しの補償",
  setup_first_player: "準備: 先攻を決める",
  main: "番の中",
  take_prize: "サイドを取る",
  promote_active: "バトル場に出す",
  decision: "決定",
  sudden_death: "サドン・デス",
  game_over: "終局",
  halted: "停止",
};

export interface Explained {
  label: string;
  description: string;
}

/** 処理可能性（processability）。未裁定・未実装を「ルール上禁止」と書かない。 */
export const PROCESSABILITY_TEXT: Record<string, Explained> = {
  supported: {
    label: "対応",
    description: "候補の guarantees に書かれた範囲だけの保証です。受理のあとの全分岐の完走は保証しません（コインなど乱数で決まる続きを含む）。",
  },
  may_stop_later: {
    label: "送れる（後で止まりうる）",
    description: "送れます。受理のあとの反応・決定・停止を評価していないため、受理のあとに止まる・決定を求められることがあります。",
  },
  unresolved_ruling: {
    label: "未裁定",
    description: "記録で裁定が決まらないため、今は処理できません（ゲーム上の禁止ではありません）。",
  },
  not_implemented: {
    label: "未実装",
    description: "エンジンが未対応です（ゲーム上の禁止ではありません）。",
  },
  technical_limit: {
    label: "技術上の制限",
    description: "エンジンの技術上の制限で、今は処理できません（ゲーム上の禁止ではありません）。",
  },
  unverified: {
    label: "未確認",
    description:
      "保証はありません（例: 本人のうらのカードの進化・にげる・ワザ、使うための条件をエンジンが前もって確かめないトレーナー）。送れますが、使えるかは送るまで分かりません。最終の判定はエンジンが送信のときに行います。",
  },
};

export const DISCLOSURE_TEXT: Record<string, Explained> = {
  confirmed: { label: "入力を表示", description: "入力の情報境界をエンジンが確かめた種類です。" },
  unconfirmed: {
    label: "入力非公開",
    description: "入力の情報境界が未確認のため、エンジンは選べるもの・数・並びを返しません（input_disclosure: unconfirmed）。",
  },
  no_input: { label: "入力なし", description: "この操作に入力はありません。" },
};

export const ORDER_TEXT: Record<string, string> = {
  significant: "選んだ順に意味があります（この順に送ります）。",
  not_significant: "エンジンが決まった並びに直します（選んだ順のまま送ります）。",
  unconfirmed: "順序の扱いはエンジンで未確認です。選んだ順のまま送ります（並べ替えません）。",
  not_applicable: "",
};

export const COMPLETENESS_TEXT: Record<string, string> = {
  complete: "この応答で明示した種類（scope_kinds）の候補がそろっています。全合法手の完成ではありません。",
  partial: "部分実装です。not_covered_kinds の種類は、この API の版では評価も候補の作成もしていません。",
  undetermined: "完全性を判定できません。",
};

export const SITUATION_LABELS: Record<string, string> = {
  actor_to_act: "あなたの操作",
  waiting_for_player: "ほかのプレイヤーの操作待ち",
  waiting_for_host: "ホストの操作待ち",
  game_over: "終局",
  halted: "停止",
};

export const EMPTY_REASON_LABELS: Record<string, string> = {
  not_actor: "今はこの閲覧者が操作する場面ではありません。",
  host_operation: "ホストの操作（ジャンケンの結果・サドン・デスの開始）を待っています。",
  game_ended: "終局・停止のため、操作は受け付けられません。",
  kinds_not_covered: "操作できる種類はありますが、この API の版では未対応です（ゲーム上できないのではありません）。",
  players_to_act: "プレイヤーの操作を待っています（ホストの操作はありません）。",
};

export const HALT_CATEGORY_LABELS: Record<string, string> = {
  invalid_input: "入力の誤り",
  unresolved_ruling: "未裁定",
  unsupported: "未対応",
  technical_limit: "技術上の制限",
  compatibility: "互換性",
  state_integrity: "状態の整合",
  internal_error: "内部エラー",
  unmapped: "未分類",
};

export const PLACEMENT_TEXT: Record<string, string> = {
  eligible: "",
  excluded_by_convention: "この規約集合では、最初のポケモンとして出せません（規約による扱い）。",
  stops: "最初のポケモンとして出せるかは記録で決まらないため、今は処理できません（ゲーム上の禁止ではありません）。",
};

export const OUTCOME_LABELS: Record<string, string> = {
  accepted: "受理",
  rejected: "拒否（エンジン）",
  failed: "処理できない結果",
  refused: "送らなかった（ホストの段の拒否）",
};

export const ENERGY_LABELS: Record<string, string> = {
  grass: "草",
  fire: "炎",
  water: "水",
  lightning: "雷",
  psychic: "超",
  fighting: "闘",
  colorless: "無色",
  darkness: "悪",
  metal: "鋼",
};

export function labelOf(map: Record<string, string>, value: string | null | undefined): string {
  if (value == null) return "—";
  return map[value] ?? value;
}

export function playerLabel(p: 0 | 1 | null | undefined): string {
  return p == null ? "—" : `プレイヤー${p}`;
}

export function waitingByLabel(by: 0 | 1 | "players" | "host"): string {
  if (by === "players") return "両プレイヤー（それぞれ）";
  if (by === "host") return "ローカルホスト";
  return playerLabel(by);
}

/** 処理可能性の理由（reasons）。表示だけ（知らない理由はコードのまま）。 */
export const REASON_LABELS: Record<string, string> = {
  reactions_not_evaluated: "受理のあとの反応・決定・停止を評価していない",
  face_down_reveal_not_evaluated: "うらのカードの本当のカードでは確かめていない（エンジンがおもてにしてから確かめる）",
  stops_before_acceptance: "エンジンが受け付ける前に止める（未裁定・未対応。ゲーム上の禁止ではない）",
  checkup_not_evaluated: "番の終わりの処理を評価していない",
  state_not_supported: "この版が扱えない状態",
  segment_setup_not_evaluated: "延長戦の準備を評価していない",
  turn_start_not_evaluated: "番の始まりの処理を評価していない",
  continuation_not_evaluated: "続きの処理を評価していない",
  decision_not_supported: "この版が扱えない決定",
  input_boundary_unconfirmed: "入力の情報境界が未確認",
  no_eligible_card: "出せるカードがない",
  preflight_not_evaluated: "エンジンの宣言の前の先読み（コインの結果・ワザの途中の決定を試す）を評価していない（エンジンが宣言を断ることがある）",
  no_printed_attack: "うらのカードに印刷のワザがない（この版は入力の形を作らない）",
  use_condition_not_evaluated: "カードの使うための条件をエンジンが前もって確かめていない（使えるかは送信のときにエンジンが決める）",
};

export function reasonsText(reasons: readonly string[]): string {
  return reasons.map((r) => (REASON_LABELS[r] ? `${REASON_LABELS[r]}（${r}）` : r)).join("・");
}

/** check・submit の拒否のコード（送り手だけに表示する）。 */
export const REFUSAL_TEXT: Record<string, string> = {
  CANDIDATE_INPUT_INVALID: "入力が候補の制約に合いません",
  CANDIDATE_NOT_EXECUTABLE: "エンジンが受け付ける前に止める入力です（未裁定・未対応など。ゲーム上の禁止ではありません）",
  CANDIDATES_STALE: "候補が古くなりました（取り直します）",
  CANDIDATES_WRONG_GAME: "別の対戦の候補です（取り直します）",
  CANDIDATES_WRONG_ACTOR: "別の主体の候補です（取り直します）",
  CANDIDATE_UNKNOWN: "知らない候補です（取り直します）",
  INPUT_BOUNDARY_UNCONFIRMED: "入力の情報境界が未確認の候補です",
};

/** 入力の段の役割（role）。同じ role でも操作の種類で意味が違うので、種類ごとに決める。 */
const ROLE_LABELS: Record<string, string> = {
  "place_starting:active": "バトル場",
  "place_starting:bench": "ベンチ",
  "play_basic:bench": "ベンチに出すたねポケモン（手札）",
  "attach_energy:energy": "つけるエネルギーカード（手札）",
  "attach_energy:target": "つける先（自分の場のポケモン）",
  "evolve:evolution_card": "進化カード（手札）",
  "evolve:target": "進化させるポケモン（自分の場）",
  "retreat:new_active": "入れ替えるベンチのポケモン",
  "retreat:discard": "トラッシュするエネルギー",
  "use_attack:attack": "ワザ",
  "use_attack:declaration_options": "宣言といっしょに選ぶもの（任意。0 個でもよい）",
  "remove_disguise:disguised": "「ばける」でカードをのせている自分の場のポケモン",
  "discard_from_play:discard": "場からすてる自分の化石・人形",
  "reveal_face_down:face_down": "おもてにする自分のうらのカード",
  "play_trainer:trainer": "使うトレーナーカード（手札）",
  "use_stadium:energy": "スタジアムの効果で選ぶエネルギーカード（ついている自分の場のポケモン）",
};

/** ワザの持ち方（route）。エンジンが返した値の説明で、カード名・画像からワザを補わない。 */
export const ROUTE_LABELS: Record<string, string> = {
  form: "今の姿のカードのワザ",
  recall: "「思い出させる」で使う進化前のワザ",
  psylink: "［サイコリンク］で持つ、自分の場のポケモンのワザ",
  prehistoric: "［げんしのきおく］で使う、進化前のカードのワザ",
  puppet: "［にんぎょうつかい］で使うワザ",
  mimic: "［ものまね］で使う、相手の対戦ポケモンのワザ",
};

/** 宣言といっしょに選ぶもの（addon）の種類。表示だけで、選べるか・組み合わせはエンジンが決める。 */
export const ADDON_LABELS: Record<string, string> = {
  stadium_coin: "場のスタジアムのコインを投げる",
  attack_power: "ワザを使うポケモン自身の、ワザといっしょに使う特殊能力",
  with_power: "自分の場のポケモンの、ワザといっしょに使う特殊能力",
};

/** 決定の種類の説明（表示だけ。エンジンの文書の意味。送る値は選べるものの id のまま）。知らない種類は説明しない。 */
export const DECISION_TEXT: Record<string, string> = {
  accept_request: "錯乱ジム: 相手が使ったトレーナーを、かわりに使うか（選べるものを選ぶと「使う」、選ばないと「使わない」）。使えるかは送ったときにエンジンが決めます。",
  secret_plan_card: "マチスの秘策: うらにしてベンチに出すカード（選ばなくてもよい）。",
};

export function roleLabel(kind: string, role: string): string {
  return ROLE_LABELS[`${kind}:${role}`] ?? role;
}
