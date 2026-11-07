# エンジンの契約と GUI の対応（kyuura-engine d0c5cfa・v0.164.0）

GUI が使うエンジンの公開の境界と、その確かめ方・更新の方法の記録です。推測でなく、固定コミットの文書・コードと実際の応答で確かめた内容だけを書きます。

## 1. 参照した資料（固定コミット d0c5cfa）

- `docs/client-api-v0.164.md`（入口・要求と応答・更新・導入）
- `docs/legal-actions-u7-1.md`（決定への回答・番を終える・取っ手・処理可能性・coverage）
- `docs/legal-actions-u7-2.md`（初期配置・補償・ジャンケン・延長戦・ホストの入口）
- `kyuura_engine/client_api.py`・`legal_actions.py`・`diagnostics.py`・`observation.py`・`examples/headless_client.py`・`tests/test_client_api.py`
- 実際の応答（接続層のテストと e2e が固定版のエンジンで確かめる）

## 2. 使う境界

| 境界 | 使い方 |
|---|---|
| `ClientHub.start(deck0, deck1, seed, **options)` | 新しい対戦（seed は接続層が決める。`conventions` を任意で渡す） |
| `ClientHub.from_state(state)` | 検証用の固定例（公開の `new_game`・`apply_command`・`command_from_dict` で再生した状態） |
| `hub.player(0/1)`・`hub.spectator()`・`hub.host()` | 入口。接続層が保持する |
| 入口の `handle(dict) -> dict` | `view`・`candidates`・`inputs`・`check`・`submit`・`updates` |
| `preset_deck`・`preset_deck_ids`・`expand_decklist`・`deck_problems`・`load_card_pool` | サンプルデッキ・デッキの検査・カード名の表 |
| `view_record.FORBIDDEN_KEYS` | ブラウザ向けの応答の禁止項目の最終確認 |

使わないもの: hub の内部（`_host`・`_state`）・`GameState`・`CommandResult`・`verifier`・スナップショット・完全な記録・`visible_log`（状態が要るため）。

## 3. 型と実行時検証

機械可読のスキーマはエンジンにないため、初版で必要な範囲の型（`web/src/api/types.ts`）と実行時検証（`web/src/api/validate.ts`）を用意しました。

- 封筒: `contract == "kyuura-client-api"`・`format == 1`・`type` が要求の種類と同じ・`ok` が真偽
- 候補: `kyuura_legal_actions_format == 1`、`processability`・`input_disclosure`・入力の段の `input` は契約の表（`contract/kyuura-client-api-v1.json`）の値だけ
- 公開の更新は `ok` を持たない封筒（`type: "update"`）
- 接続層の封筒: `gui_server == 1`
- 合わない応答は `ProtocolError` → 画面は「不明な応答」を表示して操作を止める

契約の値の表は TypeScript と Python のテストが同じファイルを読みます。Python のテスト（`server/tests/test_contract.py`）がエンジンの定数・実際の coverage と照らします。

## 4. 入力の組み立て

- `choose_option`: 選択肢の `id`（`o1`…）をそのまま送る。複数の段は段の順に連結する（初期配置は `[バトル場, ベンチ…]`）。`options_from_stage` は指す段の選択肢を使い、`distinct_across_stages` なら他の段で選んだものを選べなくする
- `choose_value`: `range` の整数をそのまま送る
- 選んだ順を保つ（`order` が `unconfirmed`・`not_significant` でも並べ替えない）
- `eligible` が偽・処理可能性が `unresolved_ruling`・`not_implemented`・`technical_limit` の選択肢は理由を表示して選べなくする（エンジンもホストの段で `CANDIDATE_NOT_EXECUTABLE` にする）
- `withheld`（入力の情報境界が未確認）は選べるものを出さない
- 送信の可否は count・range を読むだけ。合法性の最終の判定はエンジン（`check` で事前に検査できる）

## 5. 確かめた挙動（固定版エンジン）

- プリセットデッキでも、seed によっては準備で停止する（`UNRESOLVED_MULLIGAN_COMPENSATION`）。テストは停止を確かめて作り直す
- 準備: 両者の初期配置 → 補償（あれば）→ ホストのジャンケン → 勝者の番。番の候補は `end_turn` だけ（`completeness: partial`、12 種類が `not_covered_kinds`）
- 拒否（`refused`）では更新が作られず、取っ手は失効しない。受理で全取っ手が失効する
- 決定待ちの相手には候補がなく `waiting_for_player`、観測の決定は種類・決める人・数だけ
- サドン・デス待ち: プレイヤーは `empty_reason: host_operation`、ホストの `start_sudden_death` で延長戦 1 の準備へ

## 6. エンジン側の報告事項（エンジンは変更していない）

- **パッケージの指定**: `pyproject.toml` の `packages = ["kyuura_engine"]` に `kyuura_engine.resolution` がなく、wheel での導入（文書の推奨の `pip install "kyuura-engine @ git+…"`）では import に失敗する。GUI は `-e git+…@<commit>` で回避している
- **ログ**: client_api 形式 1 は閲覧者別の対戦ログ（`visible_log`）を返さない。GUI は公開の更新の要約で代えている。ログを出すなら、エンジンの契約に閲覧者別のログ（または閲覧用記録）の要求を加える必要がある
- **デッキの診断**: `ClientHub.start` の拒否は `INVALID_DECK` だけ。GUI は作成の画面に限り `deck_problems` の結果を表示している

## 7. U7-3 以後への対応

新しい操作の種類（ベンチに出す・エネルギー・進化・にげる・ワザ・トレーナー・パワーなど）が candidates に出るようになったら:

1. エンジンの文書で、種類・入力の段・`choices_format`・処理可能性・保証を確かめる（推測しない）
2. `contract/kyuura-client-api-v1.json` の `implemented_kinds`・`turn_kinds_not_covered` を直す（Python のテストが照らす）
3. 入力の段が既存の `choose_option`・`choose_value` の形なら、決定の入力の画面はそのまま使える。表示名を `web/src/labels.ts` の `KIND_LABELS` に加え、選択肢の意味（`meaning`）の表示を `optionLabel` に加える
4. 新しい入力の形（例えば対象を段階的に選ぶ形）が加わったら、`types.ts`・`validate.ts`・`DecisionPanel` に段の種類を加える。知らない `input` は今は「不明な応答」で止まる
5. 盤面の表示でワザ名を「表示のみ」としている箇所を、候補から操作できるように変える場合も、操作は必ず candidates の候補から行い、盤面のカードから候補を推測しない
6. 実エンジンで e2e を加え、未対応の固定例（決定待ち・サドン・デス）が通常の操作で届くようになったら、固定例を通常の流れのテストに置きかえる
