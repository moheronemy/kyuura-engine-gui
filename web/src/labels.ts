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
  play_trainer: "トレーナーを使う",
  use_power: "ポケモンパワーを使う",
  use_stadium: "スタジアムを使う",
  remove_disguise: "ばけているカードを外す",
  discard_from_play: "場のカードをトラッシュする",
  reveal_face_down: "裏向きのカードを表にする",
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
    description: "入力の範囲は guarantees に書かれた範囲で保証されます。対戦の完走や、その後の処理までは保証しません。",
  },
  may_stop_later: {
    label: "送れる（後で止まりうる）",
    description: "送れます。そのあとの処理で止まる・決定を求められることがあります（受理は保証されません）。",
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
    description: "処理できるかを確かめられません。送るとエンジンが判定します（受理の保証ではありません）。",
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
  partial: "部分実装です。scope_kinds の一部（not_covered_kinds）はこの API の版では候補に出ません。",
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
  kinds_not_covered: "操作できる種類はありますが、現行 API では未対応です（ゲーム上できないのではありません）。",
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
