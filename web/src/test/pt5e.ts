// 0.176.0（PT-5e。山札から引いて試すトレーナー 5 つの型・6 枚の使うための条件を候補の作成で呼ぶ）の実応答（固定版のエンジン 6f62700。模擬ではない）。
// 盤面は server/tests/pt5e_boards.py の構築盤面（エンジンの PT-5e のテストの table の形。new_game からではない）。client_api の candidates・inputs の応答をそのまま写した
// （証跡の probe/pt5e_responses.json）。新しい語彙はない（may_stop_later・not_implemented・unresolved_ruling・stops_before_acceptance は既存）。
// - 盤面 1: 手札はカツラのクイズ その2（GD5-017。条件を通る）・ポケモン性格判定（neo4-105。進化カードがなくゲーム上使えない → 選べるものに出ない）・
//   カツラのクイズ その1（GD5-016。手札のポケモンが図鑑番号のないポリゴンだけ → 未対応）・ポリゴン（ES1-033）
// - 盤面 2: 手札はカツラのクイズ その3（PMCG6-082。ワザを持つポケモンがない → 未裁定 QZ1）・とりかえっこプリーズ（PR1-027。相手の手札がない → 出ない）・マサキ（PMCG1-074）
import type { Candidate, InputStage } from "../api/types";

/** play_trainer の候補の保証の範囲（0.176.0 の文。表示するだけで、合法性の判定には使わない）。 */
export const PT5E_GUARANTEES = {"preconditions": "番・段階と、手札のトレーナーカードごとに、エンジンが手札から出す前の確かめ（engine.check_play_trainer。番・手札・トレーナーカードであること・トレーナーの使用の禁止・登録表・カードごとの使うための条件・リムーブ禁止ジムの追加の条件・MG1。コマンドの処理と同じ関数・同じ順番）を候補の作成に使う。v0.176: 状態の複製の上で山札から引いて試す使うための条件（PLAYABLE_FACE_UP_PREFIX_TRIALS）も呼ぶ。結果は本人の手札・公開の枚数と、おもての山札の並びの不変条件で決まる。その不変条件が成り立たない状態では呼ばない（unverified）。effects.py の外で定義した条件も呼ばない（unverified）", "acceptance": "保証しない。エンジンは受け付ける前に、［ちえくらべ］を使わない続き・効果の途中の決定の答えの続きを状態の複製の上で試し（_trainer_reaction_decline_check・_trainer_dead_end）、効果の処理の途中の未裁定・未対応で拒否することがある（状態は変わらない）。候補の作成・入力の検査は、これらを呼ばない。最終の判定は apply_command", "after_acceptance": "評価していない（錯乱ジムのコイン・相手の［ちえくらべ］の決定・リムーブ禁止ジムの追加の条件・効果の対象や枚数や山札の検索・サイキックコントロールの使うカードは、どれも受理のあとの決定で、answer_decision の候補で答える。決めるのが相手のこともある。番を終えるトレーナーは番を終える）", "supported_scope": "トレーナーの候補は supported にしない（受理の前の先読みと受理のあとを評価していないため）"};

export const PT5E_CANDIDATE_1 = { ...{"id": "c3", "kind": "play_trainer", "processability": "may_stop_later", "reasons": ["continuation_not_evaluated", "preflight_not_evaluated"], "choices_format": "[手札のカードの番号]", "input_disclosure": "confirmed", "input_stages": [{"stage": 1, "input": "choose_option"}]}, guarantees: PT5E_GUARANTEES } as Candidate;
export const PT5E_STAGES_1 = [{"stage": 1, "input": "choose_option", "role": "trainer", "meaning": "card", "count": {"min": 1, "max": 1}, "options": [{"id": "o1", "card": 1, "card_id": "GD5-017", "eligible": true, "processability": "may_stop_later", "reasons": ["continuation_not_evaluated", "preflight_not_evaluated"]}, {"id": "o2", "card": 3, "card_id": "GD5-016", "eligible": false, "processability": "not_implemented", "reasons": ["stops_before_acceptance"]}], "order": "not_applicable"}] as InputStage[];
/** 本人の観測の手札（バトル場のエビワラーが card 0。選べるものの card と同じ番号）。 */
export const PT5E_HAND_1 = [{"card": 1, "card_id": "GD5-017"}, {"card": 2, "card_id": "neo4-105"}, {"card": 3, "card_id": "GD5-016"}, {"card": 4, "card_id": "ES1-033"}];

export const PT5E_CANDIDATE_2 = { ...{"id": "c2", "kind": "play_trainer", "processability": "may_stop_later", "reasons": ["continuation_not_evaluated", "preflight_not_evaluated"], "choices_format": "[手札のカードの番号]", "input_disclosure": "confirmed", "input_stages": [{"stage": 1, "input": "choose_option"}]}, guarantees: PT5E_GUARANTEES } as Candidate;
export const PT5E_STAGES_2 = [{"stage": 1, "input": "choose_option", "role": "trainer", "meaning": "card", "count": {"min": 1, "max": 1}, "options": [{"id": "o1", "card": 1, "card_id": "PMCG6-082", "eligible": false, "processability": "unresolved_ruling", "reasons": ["stops_before_acceptance"]}, {"id": "o2", "card": 3, "card_id": "PMCG1-074", "eligible": true, "processability": "may_stop_later", "reasons": ["continuation_not_evaluated", "preflight_not_evaluated"]}], "order": "not_applicable"}] as InputStage[];
export const PT5E_HAND_2 = [{"card": 1, "card_id": "PMCG6-082"}, {"card": 2, "card_id": "PR1-027"}, {"card": 3, "card_id": "PMCG1-074"}];
