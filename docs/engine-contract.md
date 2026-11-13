# エンジンの契約と GUI の対応（kyuura-engine v0.180.0・F-1。v0.172.0・U7-5f・g までは 13 章まで）

GUI が使うエンジンの公開の境界と、その確かめ方・更新の方法の記録です。推測でなく、固定コミットの文書・コードと実際の応答で確かめた内容だけを書きます。

## 0. 固定と導入

- 版 0.180.0、導入する完全なコミット `27ba35d7d325aabe4a8804c57e095e00fc3b81c6`（公開ブランチ `claude/f1-face-down-attack-guarantee` の「版を 0.180.0 にする」。F-1 を含む。配布の確認済みのコミット。Git の URL からの通常のインストール。20 章）。文書だけの後続のコミット（`a042ba3`）・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- 以前の固定: 0.179.0、導入する完全なコミット `4b6e3fea9212c50622dcfea7142dcc76fd14b09d`（公開ブランチ `claude/pt5t-c1` の「版を 0.179.0 にする」。PT-5t-C1 を含む。配布の確認済みのコミット。Git の URL からの通常のインストール。19 章）。文書だけの後続のコミット（`c157c7b`）・検証用 AI の追従（`claude/vai-0179-follow`）・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- 以前の固定: 0.178.0、導入する完全なコミット `8f5329d6fb9eeeb783f3d6f57128069ffc0d98a0`（公開ブランチ `claude/up5t-c1` の「版を 0.178.0 にする」。UP-5t-C1 を含む。配布物の検査と Git の URL からの通常のインストールを確かめたコミット。18 章）。文書だけの後続のコミット（`7ef45be`）・検証用 AI の追従（`claude/vai-0178-follow`）・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- 以前の固定: 0.177.0、`01317a649e65461dfeffabfa0b4893840ae6d9ee`（公開ブランチ `claude/pt5e-from-state-fix` の「版を 0.177.0 にする」。`from_state` の入口の不変条件の確かめを含む。Git の URL からの通常のインストール。17 章）
- 以前の固定: 0.176.0、`6f627007a2a7101be066ac6ba035e838a75e36e1`（公開ブランチ `claude/pt-5e-impl` の「版を 0.176.0 にする」。PT-5e を含む。Git の URL からの通常のインストール。16 章）
- 以前の固定: 0.175.0、`81e9e99f76c2a2071fbbc50f852d6c28a026d080`（公開ブランチ `claude/u-r3a-face-down-multistage-power` の「版を 0.175.0 にする」。U-R3a を含む。Git の URL からの通常のインストール。15 章）。文書だけの後続のコミット（`43debdd` など）・検証用 AI の追従（`claude/vai-u-r3a-follow`）・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- 以前の固定: 0.174.0、`f7bf450580bf0d02573b4d032271be6b8e12d699`（公開ブランチ `claude/p6-face-down-retreat` の「版を 0.174.0 にする」。P6 と 0.173.0 の CN-1 の修正を含む。Git の URL からの通常のインストール。14 章）。文書だけの後続のコミット・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- 以前の固定: 0.172.0、`e26df79cc6dec913c1d15b5d8203df066334d65d`（公開ブランチ `claude/u7-5fg-impl` の「版を 0.172.0 にする」。U7-5f・g を含む。Git の URL からの通常のインストール。`server/requirements.txt`）。文書だけが違う後続のコミット（`05a6749`。限定の検証と配布の記録）・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- `74c8e1f`（0.171.0）から `e26df79` までの `kyuura_engine/` の差分: `legal_actions.py`（U7-5f の表示だけの候補、U7-5g-3 の coverage の残り、U7-5g-1 の経路で引く段、U7-5g-2 の本人のうらのカードの特殊能力）と版の番号（`__init__.py`）だけ。`engine.py`・`resolution/`・`effects.py`・`client_api.py`・同梱のカードデータは変わっていない（カードデータの blob も同じ。導入物の改行は 8.2）。契約の識別・形式の版は同じで、応答は加える方向（13 章）。意図した意味の変更は、番のプレイヤーの MAIN の `not_covered_kinds` が空になることと、番でない主体・決定の回答者が R-4 で partial になること
- 以前の固定: 0.171.0（`74c8e1f8ca03d017d5c0a8a79e6fdaa33d25b7f8`。U7-5e。12 章）
- `0885d66`（0.170.0）から `74c8e1f` までの差分: `kyuura_engine/legal_actions.py`（U7-5e の特殊能力の候補・宣言の段・依存する段の確かめ）・`engine.py`（特殊能力の宣言の前の確かめを `check_use_pokemon_power` に分けた。処理は同じ）・`effects.py`（型ごとの宣言の表 `POWER_INPUT_STAGES` などを加えた。挙動は同じ）・版の番号・文書・テスト。`client_api.py` と同梱のカードデータは変わっていない。契約の識別・形式の版は同じで、応答は加える方向だけ（12 章）
- 以前の固定: 0.170.0（`0885d664913bc8e57279ed9e44ac51cc97d5a6bf`。U7-5a〜d。11 章）
- `9506d63`（0.166.0）から `0885d66` までの差分: `kyuura_engine/legal_actions.py`（U7-5a〜d の候補・入力・検査）・`engine.py`（場の 3 操作・トレーナー・スタジアムの受け付ける前の確かめを `check_*` の関数に分けた。処理は同じ）・`effects.py`（スタジアムの型に選ばせるものの宣言 `energy_choice` を加えた。挙動は同じ）・版の番号・文書・テスト。`client_api.py` は変わっていない。同梱のカードデータ（`kyuura_engine/data`）は変わっていない（コミットの blob は同じ。導入物の改行は 8.2）。契約の識別・形式の版は同じで、応答は加える方向だけ（11 章）
- 以前の固定: 0.166.0（`9506d6305e90ec262fbe77740d9aa57f04b980b6`。U7-4）
- `b4e62d9`（0.165.0）から `9506d63` までの差分: `kyuura_engine/legal_actions.py`（U7-4 のワザの候補・入力・検査）・`resolution/flow.py`（ワザの宣言の前の確かめを `check_use_attack` に分けた。処理は同じ）・版の番号・文書・テスト。同梱のカードデータ（`kyuura_engine/data`）は変わっていない（コミットの blob のバイト列も同じ）。契約の識別・形式の版は同じで、応答は加える方向だけ（10 章）
- `ffcc5ca`（0.164.0）から `b4e62d9` までの差分: `kyuura_engine/legal_actions.py`（U7-3 の候補・入力・検査）・`engine.py`（コマンドの処理の前半を `check_*` の関数に分けた）・版の番号・文書・テスト。同梱のカードデータの内容は同じ（正規化した JSON の sha256 が同じ）。契約の識別・形式の版（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）は同じで、応答は加える方向だけ（9 章）
- 契約の確かめ（1〜5 章）は `d0c5cfa` で行った。`d0c5cfa` から `ffcc5ca` までの差分は配布の設定（`pyproject.toml`・`MANIFEST.in`）・文書・配布物の確かめの道具とテストだけで、`kyuura_engine/` の中身は変わっていない。API の契約は変わっていないものとして扱い、接続層のテスト・ブラウザの接続確認を `ffcc5ca` の通常のインストールで通した
- 導入元は `direct_url.json` の `vcs_info.commit_id` で確かめる（`kyuura_gui_server/engine_source.py`）。site-packages で `git rev-parse` をしない（GUI 自身の HEAD を返しうる）

## 1. 参照した資料（1〜5 章は固定コミット d0c5cfa で確かめ、b4e62d9・9506d63・0885d66・74c8e1f・e26df79 で変わっていないことを確かめた。U7-3 は 9 章、U7-4 は 10 章、U7-5 は 11 章、U7-5e は 12 章、U7-5f・g は 13 章、P6（0.174.0）は 14 章、U-R3a（0.175.0）は 15 章、PT-5e（0.176.0）は 16 章、from_state の入口の確かめ（0.177.0）は 17 章、UP-5t-C1（0.178.0）は 18 章、PT-5t-C1（0.179.0）は 19 章、F-1（0.180.0）は 20 章。14 章では 1〜13 章、15 章では 1〜14 章、16 章では 1〜15 章、17 章では 1〜16 章、18 章では 1〜17 章、19 章では 1〜18 章、20 章では 1〜19 章の確かめを、それぞれ f7bf450・81e9e99・6f62700・01317a6・8f5329d・4b6e3fe・27ba35d でやり直していない（15 章で選んだテストの範囲は 15.8、16 章は 16.8、17 章は 17.7、18 章は 18.7、19 章は 19.8、20 章は 20.8）

- `docs/client-api-v0.164.md`（入口・要求と応答・更新・導入）
- `docs/legal-actions-u7-1.md`（決定への回答・番を終える・取っ手・処理可能性・coverage）
- `docs/legal-actions-u7-2.md`（初期配置・補償・ジャンケン・延長戦・ホストの入口）
- `docs/legal-actions-u7-3.md`（番の基本の操作 4 種類。b4e62d9）
- `docs/legal-actions-u7-4.md`（ワザの宣言。9506d63）・`docs/client-api-v0.164.md` の v0.166 の追記・`resolution/flow.py` の `check_use_attack`
- `docs/legal-actions-u7-5ab.md`（場の 3 操作）・`docs/legal-actions-u7-5c.md`（手札のトレーナー）・`docs/legal-actions-u7-5d.md`（場のスタジアムと GUI への引き継ぎ。0885d66）・`legal_actions.py` の `_board_candidates`・`_trainer_candidate`・`_stadium_candidate`・`_pokemon_option`・`_card_option`
- `docs/legal-actions-u7-5e.md`（特殊能力・型ごとの宣言・3 段の依存。74c8e1f）・`legal_actions.py` の `_power_candidates`・`_power_candidate`・`_public_pokemon`・`_power_domain`・`stage_dependency_problems`・`_power_input_problem`・`effects.POWER_INPUT_STAGES`
- `docs/legal-actions-u7-5fg.md`・`docs/legal-actions-u7-5fg-spec.md`（U7-5f・g。文書は `05a6749`）・`legal_actions.py`（e26df79）の `_face_up_candidate`・`_add_energy2_stage`・`_path_stage_problems`・`_face_down_power_candidates`・`RESIDUAL_CLASSES`・`_residual_present`・`_unverified_paths`・`_candidates`
- `kyuura_engine/client_api.py`・`legal_actions.py`・`diagnostics.py`・`observation.py`・`examples/headless_client.py`・`tests/test_client_api.py`
- `docs/legal-actions-f1-face-down-attack-guarantee.md`（F-1。文書は `a042ba3`）・`legal_actions.py`（27ba35d）の `GUARANTEE_FACE_DOWN_ATTACK`・`_attack_candidate`・`_face_down_attack_candidate`・テスト `tests/test_legal_actions_f1_v0_180.py`（20 章）
- 実際の応答（接続層のテストと e2e が固定版のエンジンで確かめる）

## 2. 使う境界

| 境界 | 使い方 |
|---|---|
| `ClientHub.start(deck0, deck1, seed, **options)` | 新しい対戦（seed は接続層が決める。`conventions` を任意で渡す） |
| `ClientHub.from_state(state)` | 検証用の固定例（公開の `new_game`・`apply_command`・`command_from_dict` で再生した状態）。0.177.0 から、エンジンが複製の不変条件を確かめ、崩れていれば hub を作る前に `UnusableStateError` で拒否する（接続層は既存の `GUI_INTERNAL_ERROR` だけを返す。17 章） |
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

- **パッケージの指定（解決済み）**: `d0c5cfa` までの `pyproject.toml` では `kyuura_engine.resolution` が配布物に入らず、通常のインストールでは import に失敗したため、GUI は編集可能インストールで回避していた。エンジンの配布の修正（`ffcc5ca` に含まれる）で解決し、GUI は通常のインストールに戻した
- **ログ**: client_api 形式 1 は閲覧者別の対戦ログ（`visible_log`）を返さない。GUI は公開の更新の要約で代えている。ログを出すなら、エンジンの契約に閲覧者別のログ（または閲覧用記録）の要求を加える必要がある
- **デッキの診断**: `ClientHub.start` の拒否は `INVALID_DECK` だけ。GUI は作成の画面に限り `deck_problems` の結果を表示している

## 7. 次の操作の種類への対応（U7-5 など）

新しい操作の種類が candidates に出るようになったら（U7-4 のワザは 10 章、U7-5a〜d の 5 種類は 11 章、U7-5e の特殊能力は 12 章、U7-5f の表示だけの種類は 13 章のとおり、この手順で加えた。表示だけの種類は `display_only_kinds` に入れ、`gui_operable_kinds` に加えない）:

1. エンジンの文書で、種類・入力の段・`choices_format`・処理可能性・保証を確かめる（推測しない）
2. `contract/kyuura-client-api-v1.json` の `implemented_kinds`・`gui_operable_kinds`・`main_kinds`・`turn_kinds_not_covered`・`stage_keys` を直す（Python のテストが照らす）。入力の画面を作るまで `gui_operable_kinds` に加えない（候補は表示だけで選べない）
3. 入力の段が既存の `choose_option`・`choose_value` の形なら、決定の入力の画面はそのまま使える。表示名を `web/src/labels.ts` の `KIND_LABELS` に加え、選択肢の意味（`meaning`）の表示を `optionLabel` に加える
4. 新しい入力の形（例えば対象を段階的に選ぶ形）が加わったら、`types.ts`・`validate.ts`・`DecisionPanel` に段の種類を加える。知らない `input` は今は「不明な応答」で止まる
5. 盤面の表示でワザ名を「表示のみ」としている箇所を、候補から操作できるように変える場合も、操作は必ず candidates の候補から行い、盤面のカードから候補を推測しない
6. 実エンジンで e2e を加え、未対応の固定例（決定待ち・サドン・デス）が通常の操作で届くようになったら、固定例を通常の流れのテストに置きかえる

## 8. カード画像（GUI 接続層の拡張と kyuura-card-renderer）

client_api の契約は変えていない。カード画像のために加えたものは、すべて GUI 側の拡張。

### 8.1 固定

| 依存 | 固定 | 記録 |
|---|---|---|
| kyuura-engine | `ffcc5cab5df1ebde0faed3fd23b481295374e1f9`（0.164.0。今回は変えていない） | `server/requirements.txt`・`contract/kyuura-client-api-v1.json` |
| kyuura-card-renderer | `af882310059c7f33bc371d31b859b09f5428f6d1`（非同期の描画の修正 51e9eec と、その使い方の README を含む） | `web/package.json`・`web/package-lock.json`・`contract/kyuura-gui-card-definitions-v2.json` |

renderer は公開の入口（`dist-lib/lib/index.js`）の export だけを使う: `fromEngineCard`・`renderToCanvas`・`cancelRenderToCanvas` と型 `EngineCardRecord`・`EngineText`・`EngineAttack`・`EnginePower`・`RenderableCard`。

### 8.2 公開カード定義の口（`GET /api/card-definitions`）

- エンジンの client_api の入口ではない。接続層が、導入済みのパッケージの同梱データ（`importlib.resources.files("kyuura_engine") / "data/kyuura_cards.json"`、`format: "kyuura-engine card extract 1"`）を読む
- 封筒: `{"gui_server": 1, "ok": true, "kind": "card_definitions", "schema": "kyuura-gui-card-definitions", "schema_version": 2, "source": {"package", "resource", "format", "engine_version", "sha256_method", "sha256"}, "card_count", "omitted", "cards": [...]}`
- `sha256_method: "kyuura-gui canonical-json 1"`: 読んだ JSON の直列化（キーの並べ替え・空白なしの区切り・UTF-8）の sha256。`schema_version: 1`（バイト列の sha256・方式の識別なし）とは値の意味が違うので比べない。正規化は直列化だけで、内容の違いは隠さない（接続層のテストで、値・記録・並びを変えると別の値になることを確かめる）
- 記録: `fromEngineCard` の入力（`EngineCardRecord`）に要る項目だけ。`id`・`jp_set`・`category`（pokemon・trainer・energy）・`name{ja,en}`・`pokemon{stage, evolves_from, hp, types, weaknesses[{type}], resistances[{type,value}], retreat_cost, rules_text, powers[{kind,name,text}], attacks[{name,cost,damage{display},text}]}`・`trainer{text}`・`energy{kind,provides,text}`・`jp_print{level,rarity}`
- カード ID の形: `^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$`。形の違う記録・同じ ID の記録は表に入れず `omitted` に数える
- 対戦に依存しない全体の表（対戦の状態・デッキリストを読まない。対戦で使うカードだけの表を作らない）。プロセスの中で 1 回だけ作る（`lru_cache(maxsize=1)`）
- 同梱データを読めない・形式が違うときは `GUI_CARD_DATA_UNAVAILABLE`（503・決まった文）
- 0.170.0 の確かめ: エンジンのリポジトリの blob（`kyuura_engine/data/kyuura_cards.json`）は 9506d63 と 0885d66 でバイト列も同じ。この端末で入れた 0.170.0 の導入物は、Git の改行の変換（システムの `core.autocrlf=true`。pip がコミットを取り出して配布物を作る）で CRLF になり、導入物のバイト列の sha256 は 0.166.0 の導入物と違った。`sha256`（canonical-json 1。読んだ JSON から作る）は同じ値（`b82354d6…`・1374 件）。0.171.0（74c8e1f）でも blob は同じで、導入物は同じく CRLF、`sha256` は同じ値。0.172.0（e26df79）でも blob は同じ（`e7a8013`）。この端末で今回入れた導入物は LF で、0.171.0 の導入物（CRLF）とはバイト列の sha256 が違うが、`sha256`（canonical-json 1）は同じ値（`b82354d6…`・1374 件）。カード定義の契約は変えていない。改行の違いは JSON の値の違いではないので、識別を読み替えたのではない（値・記録・並びの違いは別の値になる）

### 8.3 表示の境界

| 観測 | 表示 |
|---|---|
| `hand.cards` がある（本人） | 表面（カード ID ごと） |
| `hand.cards` が null（相手・観戦者） | `hand.count` 枚の裏面（最大 8 枚＋残りの数） |
| 場のポケモン（`card_id` がある） | 表面（印刷の画像）＋観測の HP・ダメージ・状態の文字 |
| `{"face_down": true}` | 裏面（カード ID なし） |
| `prizes.face_up` の位置 | 表面。それ以外の位置は裏面 |
| `deck.face_up_top` | 表面。なければ裏面 1 枚 |
| `discard`・`stadium`・`trainer_in_use` | 表面（トラッシュは開いたときだけ描く） |
| 決定の選択肢の `card_id`（inputs。本人だけに届く） | 表面（選択肢のラベルの中。押すと同じ選択肢を選ぶ） |

表を取得できても、表面を描くかどうかは観測だけで決める。裏面の部品にはカード ID・名前を渡さない。

### 8.4 非同期の描画

renderer の `renderToCanvas` は、同じ Canvas では最後に始めた要求だけが描き（前の要求は `false`）、`cancelRenderToCanvas` で待機中の要求を無効にできる。どちらも **すでに描かれたピクセルは消さない**。GUI は、描く内容ごとに別の Canvas を作り、cleanup でキャンセルと消去（隠す・幅と高さを 0）を行い、`true` のときだけ表示する。古い要求の `true`・`false`・reject は effect の目印で無視する。

### 8.5 確かめたこと・renderer への報告事項（renderer は変更していない）

- `dist-lib` は拡張子なしの相対 import・素材画像・CSS の import を含むバンドルしない ESM で、Node の ESM としては読み込めない。Vite のビルド・開発サーバーでは問題ない。Vitest では `server.deps.inline` で Vite の変換を通す必要があった。README の「Vite で動作を確かめています」の範囲どおり
- npm 11.16 の `allowScripts` では、Git の依存の `prepare` は「未確認の導入スクリプト」として警告される（今は実行される。将来の npm では止まる予定）。GUI は `allowScripts` でこのコミットだけを許可した
- lockfile の `resolved` は npm の正規化で `git+ssh://git@github.com/...#<commit>` になる。npm は GitHub の依存を https で取得できるので、SSH の鍵のない環境でも `npm ci` できることを確かめた（クリーンな作業場所での確認）

## 9. U7-3（番の基本の操作。b4e62d9 の実応答で確かめた）

確かめ方: エンジンの `docs/legal-actions-u7-3.md`・`kyuura_engine/legal_actions.py`（b4e62d9。読むだけ）と、seed を固定した new_game の実際の応答（接続層のテスト `server/tests/test_turn_basics.py`・e2e `web/e2e/turn-basics.spec.ts`）。報告だけを前提にしていない。

### 9.1 候補と coverage

- 番の候補: `end_turn` と、ゲーム上できる基本の操作（`play_basic`・`attach_energy`・`evolve`・`retreat`）。番号（`c1`…）は応答ごとで、GUI は `kind` で表示を決める
- `coverage.scope_kinds` = 評価した種類（`end_turn` と基本の 4 種類）＋ `not_covered_kinds`（8 種類）。U7-2 までの「候補に出した種類＋未対応」から意味が変わった。`offered_kinds` は候補に出した種類だけ。GUI は「評価して候補に出さなかった種類」を別に表示する
- `completeness` は番では `partial` のまま。`implemented_kinds` は 12 種類（U7-1・U7-2 の 8 種類＋基本の 4 種類）
- 理由（`reasons`）: `reactions_not_evaluated`（may_stop_later）・`face_down_reveal_not_evaluated`（unverified）・`stops_before_acceptance`（未裁定・未対応）

### 9.2 入力の形（加わった項目）

| 場所 | 項目 | GUI の扱い |
|---|---|---|
| 段 | `role` | 種類ごとの表示名（`labels.ts` の `roleLabel`） |
| 段 | `depends_on_stage`・`options_by_choice` | 2 段目は 1 段目の番号の組だけ。組の `option` は 2 段目の番号、キーは 1 段目の番号（実行時の検証）。組ごとの `eligible`・`processability`・`reasons` |
| 段 | `total_units` | にげるの出すエネルギーの個数の範囲。すべての選べるものに `units` があること（検証） |
| 段 | `bench` | ベンチの数と上限（表示だけ） |
| 段 | `confused` | こんらん（受理のあとにコイン）の表示 |
| 選べるもの | `units`・`special` | 1 枚が出す個数・特殊エネルギー |
| 選べるもの | `pokemon`・`zone`・`bench_index` | 場のポケモンの番号・場所（表示名に使う） |
| 選べるもの | `face_down` | 本人のうらのポケモン。`card_id` がない（あれば「不明な応答」） |
| 選べるもの・組 | `reasons` | 理由の表示 |

- 段の項目は `contract/kyuura-client-api-v1.json` の `stage_keys` だけを受け付ける（`server/tests/test_contract.py` がエンジンのソースの段の項目をすべて含むことを確かめる）。知らない項目は操作を止める
- 選べるものの番号は段をまたいで重ならない（検証）。`choices` は段の順（2 段の操作は `[1 段目, 2 段目]`、にげるは `[控え, エネルギー…]` を選んだ順）

### 9.3 確かめた挙動（seed 21 の new_game・プリセットの 1・2 番目のデッキ）

- 準備: 両者の初期配置 → 補償 1 回 → ジャンケン（プレイヤー0）→ 番 1 の候補は `end_turn`・`play_basic`・`attach_energy`（`supported`）
- `play_basic` の段に `bench: {count: 0, limit: 5}`。受理でベンチが 1 匹
- `attach_energy` は 2 段・`options_by_choice`。同じ番の 2 回目の候補は出ない。段の順を逆にした入力・1 段目だけの入力は `CANDIDATE_INPUT_INVALID`
- 番 3 に `evolve`（2 段）と `retreat`。にげるの段 2 は `total_units: {min: 2, max: 2}`・`units: 1` が 2 枚・`order: significant`。1 個の入力は check・submit とも `CANDIDATE_INPUT_INVALID`（拒否では相手・観戦者の更新はなく、取っ手は失効しない）。2 個で受理、受理で取っ手は失効（`refetch_required`）
- 主体の固定: 相手の入口で同じ取っ手を送ると拒否、ホストの口ではプレイヤーの識別子を使えない、要求に `actor` を書くと `CLIENT_FIELD_UNKNOWN`
- 未確かめ（実エンジン）: 未裁定（`unresolved_ruling`）の選べるもの・組、`unverified`（本人のうらのポケモン）、1 枚で 2 個のエネルギー・0 個・こんらんのにげるは、この seed の通常の操作では届かないので、実応答の形に合わせた模擬の応答の単体テストだけで確かめた

### 9.4 検証用の固定例の互換性

`server/tools/scenario_views.py` を `ffcc5ca`（記録のエンジン）と `b4e62d9` の環境で実行し比べた。3 つの固定例（決定待ち・サドン・デス待ち・準備で停止）の全入口の view は同じ。candidates の違いは `coverage.implemented_kinds` に 4 種類が加わったことだけ。操作の列・到達点は変わらないので、記録し直さず、固定例の JSON に `compatibility`（確かめた版と方法）と `views_sha256`（各時点の全入口の観測の要約）を追記した。記録を作ったエンジン（`engine_commit: ffcc5ca…`）は書き換えていない。接続層は再生のたびに観測を `views_sha256` と照らし、違えば固定例を使わない

## 10. U7-4（ワザの宣言。9506d63 の実応答で確かめた）

確かめ方: エンジンの `docs/legal-actions-u7-4.md`・`kyuura_engine/legal_actions.py` の `_attack_candidate`・`_addon_specs`・`_face_down_attack_candidate`・`_attack_input_problem`・`resolution/flow.py` の `check_use_attack`（9506d63。読むだけ）と、seed を固定した new_game の実際の応答（接続層のテスト `server/tests/test_attacks.py`・e2e `web/e2e/attacks.spec.ts`）。報告だけを前提にしていない。契約の識別・形式の版は同じ（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）。

### 10.1 候補と coverage

- 種類 `use_attack`（`MAIN_KINDS` の並びで基本の 4 種類のあと）。`implemented_kinds` は 13 種類（`retreat` のあと）。番の `scope_kinds` は 13 種類のまま、`not_covered_kinds` は 7 種類（`play_trainer`・`use_power`・`use_stadium`・`remove_disguise`・`discard_from_play`・`reveal_face_down`・`check_face_up_deck`）。番の候補は `partial`
- ゲーム上宣言できるワザがなければ候補を作らない（エネルギーのない番 1 の初めは「評価して候補に出さなかった種類」）
- 候補の処理可能性は `may_stop_later`（理由 `continuation_not_evaluated`・`preflight_not_evaluated`）。`supported` にしない。`input_disclosure` は `confirmed`。`choices_format` は「[ワザの番号, 宣言といっしょに選ぶものの番号, ...]」

### 10.2 入力の形（加わった項目）

| 段 | 項目 | 型・任意性（実応答と `legal_actions.py` で確かめた） | GUI |
|---|---|---|---|
| 1（`role: attack`・`meaning: attack`・`count {1,1}`・`order: not_applicable`） | `card`（int）・`card_id`（str）・`attack_index`（int ≥ 0）・`name_ja`（str）・`cost`（`EnergyType` の値の並び。空もある）・`damage`（str か null。印刷の表示）・`text_ja`（str か null）・`eligible`・`processability`・`reasons` | 必ずある | 表示。送るのは `id` |
| 1 | `route`（`form`・`recall`・`psylink`・`prehistoric`・`puppet`・`mimic`） | うらのバトル場のポケモンのワザ（`face_down: true`）にはない。それ以外は必ずある | 出どころとして表示 |
| 1 | `provider`・`payer`（int。場のポケモンの番号）・`grantors`（int の並び） | 任意（持ち方による） | 観測の場のポケモンの名前・場所で表示（なければ番号） |
| 1 | `face_down: true` と `card_id` | 本人のうらのバトル場のポケモンだけ。`card_id` は本人が知る本当のカード（本人の候補にだけある）。`processability: unverified`・理由 `face_down_reveal_not_evaluated` | 本人の画面だけで表示 |
| 2（`role: declaration_options`・`meaning: declaration_option`・`count {0, n}`・`decline: true`・`order: significant`・`order_preserved: true`・`distinct: true`） | `depends_on_stage: 1`・`options_by_choice`（すべてのワザの番号に表がある。組は `option`・`eligible`・`processability`・`reasons`） | 必ずある。いっしょに選ぶものがなければ `options: []`・`count {0,0}`・組は空 | 組だけを示す。なければ入力を求めない |
| 2 | `addon`（`stadium_coin`: `card`・`card_id` がスタジアム／`attack_power`: `pokemon`／`with_power`: `pokemon`・`card`・`zone`・`bench_index`・`card_id` か `face_down`・`power`） | addon ごとに決まる | addon の種類と、エンジンが返した名前・場所だけで表示 |

- 入力 `choices` は `[ワザの番号, いっしょに選ぶものの番号...]`（選んだ順）。組にない・重なり・段の並びの誤り・知らない番号は `CANDIDATE_INPUT_INVALID`、止める組（未裁定・未対応）は `CANDIDATE_NOT_EXECUTABLE`（どちらもエンジンに渡さない・取っ手は失効しない）
- GUI の検証（`web/src/api/validate.ts` の `kindStages`・`attackOption`・`addonOption`）: 段の role の並び（`stage_roles`）・選べるものの項目（`attack_option_keys`・`addon_option_keys`）・`route`・`addon`・`cost` の値が契約の表にないとき、すべてのワザに組の表がないとき、ほかの種類の段にワザの role が来たときは「不明な応答」として操作を止める。送信の結果の `result.status`（`status_values`）・`next`（`next_kinds`）・`halt` の形も確かめる
- 宣言の対象・トラッシュ・検索・写すワザ・任意の効果は宣言の入力にない（受理のあとの既存の決定）。コインは入力にない

### 10.3 確かめた挙動（seed 21 の new_game・通常の操作の列）

- プリセットの 1・2 番目のデッキ（`test_attack_is_forwarded_and_turn_moves`・`test_attack_knock_out_leads_to_own_decision_then_game_over`、e2e の 1 件目）:
  - 番 1 の初め（エネルギーなし）は `use_attack` の候補がない（`scope_kinds` には入り、`not_covered_kinds` には入らない）
  - エネルギーをバトル場のエビワラーにつけると、候補にジャブ（`card_id: PMCG1-058`・`attack_index: 0`・`route: form`・`cost: ["fighting"]`・`damage: "20"`・`text_ja: null`・`may_stop_later`）。2 段目は `options: []`・`count {0,0}`・組 `{"o1": []}`
  - `[]`・`[o1, o1]`・`[o9]`・`[o1, o9]` は check で `CANDIDATE_INPUT_INVALID`。重なりの submit は `refused`（`result: null`・`refetch_required: false`）で、相手・観戦者の更新はない
  - `[o1]` の check は通り、submit は `accepted`・`status: in_progress`・`next: [{turn_action, player 1}]`・`refetch_required: true`。相手のバトル場のダメージが観測で 20 増え、番がプレイヤー1へ移る。相手・観戦者に更新がある。受理で取っ手は失効
  - 番 3 のジャブできぜつ: `accepted`・`awaiting_decision`・`next: [{answer_decision, player 0}]`。本人の候補は `take_prize` だけ、相手は `waiting_for_player`。答えると `game_over`
- ファイヤーのデッキ（`ES2-005` 4 枚・`PMCG1-098` 56 枚）対 プリセットの 1 番目（`test_attack_with_decision_after_acceptance_then_halt`、e2e の 2 件目）:
  - 番 1 は炎 1 個でワザの候補がない。番 3 に炎 2 個で候補はドライアップだけ（ほのおのつばさはエネルギーが足りないので出ない。`damage: null`・`cost: ["fire","fire"]`）。2 段目はない（`options: []`）
  - 宣言は `accepted`・`awaiting_decision`（対象を選ぶ `select_pokemon` の決定。本人の回答待ち、相手は `waiting_for_player`）。決定の選べるもののカード ID は本人の観測にあるものだけ
  - 決定に答えると `accepted`・`halted`（`UNRESOLVED_DRY_UP_WATER_ENERGY_SHORT`・`unresolved_ruling`。コインの「おもて」が水エネルギーの枚数より多い DU1）。宣言の拒否ではない。全員の観測が停止、候補はない
- 主体の固定・拒否のときの更新・完全情報の禁止項目は、U7-3 と同じテストの仕組み（`Bridge` がすべての応答を確かめる）で確かめた

### 10.4 実エンジンで通していない範囲（模擬の単体テストだけ）

次は、この seed・このデッキの通常の操作では届かないので、エンジンの文書（7.1 の JSON の例）と `legal_actions.py` の形に合わせた模擬の応答の単体テスト（`web/src/test/u74.ts`・`Attacks.test.tsx`・`AppAttacks.test.tsx`）だけで確かめた。共通の形が同じという理由だけで、実エンジンで確かめたとは扱わない。

- 宣言といっしょに選ぶもの（クチバシティジムのコイン・［すいりょくはつでん］・［XXXXX］・［ANGER］）の選べるもの・組・選んだ順の送信・組み合わせの check の拒否。［ANGER］と［XXXXX］の併用（エンジン側でも個別に確かめていない範囲）
- コピー・変身・許可の持ち方（`recall`・`psylink`・`prehistoric`・`puppet`・`mimic`）と、選ぶと止めるワザ（VA1・RC2〜RC4 など。`unresolved_ruling`）
- 本人のうらのバトル場のポケモンのワザ（`unverified`）
- エンジンの拒否（`rejected`。宣言の前の先読みの停止。HC1 など）。実ブラウザで表示した拒否は、U7 の段の check の拒否（`CANDIDATE_INPUT_INVALID`。にげる。`turn-basics.spec.ts`）だけ。submit の `refused` は接続層のテストで確かめた
- 山札から選ぶ・写すワザ・トラッシュするエネルギーの決定（既存の決定の入力。U7-1 から同じ形）

### 10.5 検証用の固定例の互換性（0.166.0）

`server/tools/scenario_views.py --full` を 0.165.0（`b4e62d9`）と 0.166.0（`9506d63`）の環境で実行し、応答の全体を項目ごとに比べた。3 つの時点の全入口の view は同じ（`views_sha256` も同じ）。candidates の違いは `coverage.implemented_kinds` に `use_attack` が加わったことだけで、追加されたワザの候補はどの時点にもない（どれも番の中ではない）。ほかの違いはない。記録し直さず、固定例の JSON の `compatibility` に確かめた結果（`candidates_difference` に、ワザの候補による差とそれ以外の差を分けて）を追記した。記録のエンジン（`ffcc5ca`）は書き換えていない。

## 11. U7-5a〜d（場の 3 操作・手札のトレーナー・場のスタジアム。0885d66 の実応答で確かめた）

確かめ方: エンジンの `docs/legal-actions-u7-5ab.md`・`u7-5c.md`・`u7-5d.md` と `kyuura_engine/legal_actions.py`（0885d66。読むだけ）と、固定例から進めた実際の応答（接続層のテスト `server/tests/test_u7_5.py`・e2e `web/e2e/u75.spec.ts`）。報告だけを前提にしていない。契約の識別・形式の版は同じ（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）。

### 11.1 候補と coverage

- 種類: `remove_disguise`・`discard_from_play`・`reveal_face_down`（U7-5a・b）、`play_trainer`（U7-5c）、`use_stadium`（U7-5d）。`implemented_kinds` は 18 種類（`use_attack` のあとに場の 3 操作・`play_trainer`・`use_stadium`、最後にホストの 2 種類。エンジンの並び）。候補の並びは `MAIN_KINDS` の順
- 番の `scope_kinds` は `MAIN_KINDS` の 13 種類のまま、`not_covered_kinds` は `use_power`・`check_face_up_deck` の 2 種類。番の候補は `partial`。プリセットのデッキ（seed 21）の番 1 にも `play_trainer` の候補が出る（0.166.0 までは対応しない種類。接続層のテストの期待を直した意図した差）
- 処理可能性: トレーナー・スタジアムは `supported` にならない（`may_stop_later`。理由 `preflight_not_evaluated`・`continuation_not_evaluated`）。使うための条件を前もって呼ばないトレーナーは `unverified`（理由 `use_condition_not_evaluated`。契約の `reason_codes` に加えた）。場の操作は `remove_disguise`・`reveal_face_down` が `may_stop_later`、`discard_from_play` は U7-3 と同じ条件で `supported` のことがある
- 入力の公開: 5 種類とも `confirmed`。選ばせるもののない `use_stadium` は `no_input`（`input_stages: []`・`choices_format: "[]"`）

### 11.2 入力の形（加わった項目）

| 項目 | 形（実応答） | GUI の扱い |
|---|---|---|
| 段の `role` | `disguised`・`discard`・`face_down`（`meaning: pokemon`）、`trainer`・`energy`（`meaning: card`）。どれも 1 段・`count` 1〜1・`order: not_applicable` | `stage_roles` の表と同じ並びでなければ止める。`discard`・`energy` は U7-3 のにげる・エネルギーをつけるも使う（`stage_roles_shared`）。ほかの U7-5 の role がほかの種類に来たら止める。段のない応答は `use_stadium` だけ（`stage_roles_or_empty`） |
| 場のポケモンの選べるもの | `pokemon`・`card`・`zone`・`bench_index`（ベンチ）・`card_id`（おもて）または `face_down: true`（うら。カード ID なし） | `board_option_keys` の外は止める。うらにカード ID、おもてにカード ID なしは止める。うらは裏面と場所だけを表示 |
| トレーナーの選べるもの | `card`・`card_id`（本人の手札。`special` はエネルギーだけで、トレーナーにはない） | `trainer_option_keys` の外は止める |
| スタジアムのエネルギー | `card`・`card_id`（ついているエネルギーカード。公開）・`holder`（ついている本人の場のポケモン。場のポケモンの形） | `holder` は必須。`holder_keys` の外・うらの holder のカード ID は止める。エネルギーとついているポケモンを並べて表示 |
| 候補の `stadium` | `card`・`card_id`・`owner`（場のスタジアム。公開） | `use_stadium` の候補だけ（ほかの種類に来たら止める）。持ち主（出したプレイヤー）と使う主体（番のプレイヤー）を分けて表示。`state_not_supported` の候補にはない（任意の項目） |
| 観測のうらのカード | 相手・観戦者: `pokemon_id`・`face_down`・ダメージ・ついているカードなど。持ち主: さらに `real`（`card`・`card_id`・`name_ja`。本人の知識） | `real` は持ち主の観測だけで受け付け、ほかの閲覧者の観測に来たら止める。うらの枠の外のカード ID・名前も止める。持ち主の画面には文字だけで示す（表の画像は描かない） |

選べるものの番号（`o1` など）・`choices` の形は U7-1〜U7-4 と同じ。カード名・画像から送る値を作らない。

### 11.3 確かめた挙動（固定例から、通常の操作の列）

固定例（`server/tools/build_u7_5_scenarios.py` が導入済みのエンジンの公開の入口だけで作る）。「new_game」の 5 つは `ClientHub.start` に固定のデッキと seed を渡すだけで、準備（初期配置は最初の選べるもの・補償は最大・ジャンケンはプレイヤー0）から先は client_api だけで進める。

- ラッキースタジアム（エンジンのテストの LUCKY_DECK 対 CONNECT_DECK・seed 1）: `play_trainer`（`role: trainer`・check 有効）→ 受理（`in_progress`・`next` はプレイヤー0の番）→ `use_stadium`（`stadium.owner` 0・`no_input`）。`choices: ["o1"]` は `CANDIDATE_INPUT_INVALID`、`[]` は check 有効 → 受理 → 同じ番の `use_stadium` の候補はない。観測の `stadium` は全員に公開
- ヤマブキシティジム（ナツメのケーシィ 4・ヤマブキシティジム 4・超エネルギー 52 対 CONNECT_DECK・seed 1）: エネルギーをつける → `play_trainer` → `use_stadium`（`role: energy`・選べるもの 1 つ・`holder` はバトル場のナツメのケーシィ）→ 受理 → 観測で手札が 1 枚増え、バトル場のエネルギーが 0
- マチスの秘策（CONNECT_DECK の炎エネルギー 4 枚を PMCG5-093 にしたデッキ・seed 1）: `play_trainer` → 受理（`awaiting_decision`・`next` は本人の `answer_decision`）。相手は `waiting_for_player`。決定 `secret_plan_card`（0〜1・辞退できる）でヒトカゲを選ぶ → 相手・観戦者の観測のベンチは `face_down` でカード ID・名前なし（持ち主の観測には `real`）→ `reveal_face_down`（`face_down: true`・カード ID なし・`face_down_reveal_not_evaluated`）→ 受理 → 相手・観戦者に公開の更新が届き、観測でヒトカゲが公開される。たねでないカードをうらにした場合（別の seed）にトラッシュされることは、上限を決めた探索の一時的なスクリプトで見ただけ（テスト・e2e にはしていない）
- ピッピ人形（エンジンのテストの DOLL_DECK 同士・seed 1）: `play_trainer` → ベンチ → `discard_from_play`（`role: discard`・`supported`）→ 受理 → ベンチが空
- 錯乱ジム（エンジンのテストの CHAOS_DECK 対 たねポケモン 1 枚と炎エネルギー 59 枚・seed 1・補償 1 回）: 錯乱ジムを出す → 交換おじさん → コイン「うら」で受理（`awaiting_decision`・`next` はプレイヤー1の `answer_decision`）。使った側は `waiting_for_player`。相手の決定 `accept_request`（`count` 0〜1・`decline: true`・選べるもの `o1`）。`["o1"]`（使う）は check 有効だが submit は `rejected`（`NO_POKEMON_CARD_IN_HAND`・区分 `invalid_input`・`refetch_required: false`）。使ったプレイヤー・観戦者への更新は 0 件。同じ取っ手で `[]`（使わない）は受理 → プレイヤー0の番
- 「ばける」（タケシのロコン・キュウコン・ヒトカゲ・リザード各 4 と炎エネルギー 44 対 CONNECT_DECK・seed 10・9 コマンドの再生。「ばける」は特殊能力で GUI の対象外なのでホストの側で送った）: `remove_disguise`（`role: disguised`・タケシのキュウコン）→ 受理 → のせたリザードがトラッシュ
- 取っ手: エンジンは `candidates` を取るたびに新しい `revision` を返す。拒否では取っ手は失効しない（同じ取っ手で辞退できた）が、GUI は送信のあとに観測と候補を取り直すので、画面では選び直す（古い取っ手を使い続けない）

### 11.4 実エンジンで通していない範囲（模擬の単体テストだけ）

形はエンジンの文書の JSON の例と `legal_actions.py` から作った（`web/src/test/u75.ts` の区分）。同じ形を運べることを、実際の場面で画面が正しく動くことと同じには扱わない。

- `unverified` のトレーナー（0.170.0〜0.175.0 は PT-5e の 5 つ。0.176.0 からは、おもての山札の並びの不変条件が成り立たない状態と `effects.py` の外の条件だけ。16 章。0.179.0 からは、確かめが相手のうらのカードの本当のカードを使った選べるものも `unverified`。19 章）と、未登録のトレーナー（`not_implemented`）
- 本人のうらのカードをすてる FD1（`eligible: false`・`unresolved_ruling`）・`leave_lock` による拒否
- うらのポケモンについているエネルギー（`holder` の `face_down`）・相手が出したスタジアムを番のプレイヤーが使う場面・タマムシシティジム・コインのあとの決定のあるスタジアム（セキチクシティジム・エネルギースタジアム・キョウの忍者ジム・ラジオとう）・知らない選ばせるものの宣言（`unconfirmed`）
- ［ちえくらべ］（相手の `REACTION_POWER`）・MG1・リムーブ禁止ジムの追加の条件・サイキックコントロール・どうぐ・なにかの化石・番を終えるトレーナー・対象を選ぶトレーナー
- おもてにしてトラッシュ・すててバトル場が空く場面の `promote_active`（U7-1 の既存の候補。実エンジンでは U7-1 の固定例で確かめた）
- エンジンの `rejected` のうち錯乱ジム以外（ばけるの解除の MH1・TK1、トレーナーの先読みの拒否など）

### 11.5 検証用の固定例の互換性（0.170.0）

`server/tools/scenario_views.py --full` を 0.166.0（`9506d63`）と 0.170.0（`0885d66`）の環境で実行し、応答の全体を項目ごとに比べた。既存の 3 つの時点の全入口の view は同じ（`views_sha256` も同じ）。candidates の違いは `coverage.implemented_kinds` に U7-5 の 5 種類が加わったことだけで、U7-5 の候補はどの時点にもない（番の中でトレーナー・スタジアム・場の 3 操作の対象がない）。記録し直さず、`compatibility` に確かめた結果（`candidates_difference` に U7-5 の候補による差とそれ以外の差を分けて）を追記した。記録のエンジン（`ffcc5ca`）は書き換えていない。U7-5 の 6 つの固定例は 0885d66 で作り、記録のエンジンは `0885d66`。

## 12. U7-5e（特殊能力と依存する段。74c8e1f の実応答で確かめた）

確かめ方: エンジンの `docs/legal-actions-u7-5e.md` と `kyuura_engine/legal_actions.py`・`effects.py`（74c8e1f。読むだけ）と、固定例から進めた実際の応答（接続層のテスト `server/tests/test_u7_5e.py`・e2e `web/e2e/u75e.spec.ts`）。比べた GUI は U7-5a〜d に対応した実際の GUI（`9c36a8f`）で、エンジンの文書の引き継ぎが比べた古い GUI（`3649946`）ではない。契約の識別・形式の版は同じ（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）。

### 12.1 候補と coverage

- 種類 `use_power`。`implemented_kinds` は 19 種類（`use_stadium` のあと、ホストの 2 種類の前。エンジンの並び）。番の `scope_kinds` は 13 種類のまま、`not_covered_kinds` は `check_face_up_deck` だけ。番の候補は `partial`
- 特殊能力の位置ごとに 1 つの候補（同じ種類の候補がいくつも並ぶ）。候補の項目に `pokemon`（使う本人の場のポケモン。`pokemon`・`card`・`zone`・`bench_index`・`card_id`）と `power`（`index`・`name_ja`・`card`・`card_id`。印刷したカード）。本人のうらのカードの特殊能力・常にはたらく特殊能力・反応やワザといっしょに使う特殊能力は候補にならない（ソースで確かめた）
- 処理可能性: `may_stop_later`（理由 `continuation_not_evaluated`）。うらのカードを指定する組は `unverified`（`face_down_reveal_not_evaluated`）。止める候補は入力なしで実行できない区分。入力の公開は、入力ありが `confirmed`、入力なしが `no_input`、宣言のない型が `unconfirmed`（`input_boundary_unconfirmed`・`not_implemented`）

### 12.2 入力の形と依存する段（GUI が確かめる範囲）

| 項目 | 形（実応答・ソース） | GUI の扱い |
|---|---|---|
| 段の role の並び | `[]`・`[source, energy, target]`・`[source, energy]`・`[energy, target]`・`[energy]`・`[source, target]`・`[source]`・`[target]`（`POWER_INPUT_STAGES` と同じ） | 表（`power_stage_shapes`）のどれでもなければ止める。`source`・依存の形はほかの種類の段に来たら止める |
| meaning・count | `source`・`target` は `pokemon`、`energy` は `card`。どの段も `count` 1〜1 | 違えば止める（任意の段はない） |
| 依存 | 2 段目以降に `depends_on_stage`（直前の段）・`upstream_stages`（前のすべての段）・`options_by_choice`（直前の段の番号ごと）・選べるものの `after`（直前の段の番号） | 段の番号は 1 からの並び、`after` は組の鍵でその組にある、組の選べるものの `after` はその鍵（別の上流の番号を混ぜない）。合わなければ止める（エンジンの `stage_dependency_problems` と同じ確かめ） |
| 選べるもの | 場のポケモン（本人: `pokemon`・`card`・`zone`・`bench_index`・`card_id`。相手のうら: `pokemon`・`zone`・`bench_index`・`face_down` だけ）、カード（`card`・`card_id`。手札は `special` もある） | 項目の表（`power_option_keys`）の外・うらにカード ID・カードの選べるものに場のポケモンの項目は止める |

- 画面: k 段目は直前の段で選んだ番号の組だけ。k 段目を変えたら、直接・間接に依存する後のすべての段の選択を捨てる（`downstreamOf`。U7-4 までは直接の次の段だけだった）。check の答えは今の入力と同じときだけ使う
- エンジンの文書の「新しい項目を無視するクライアントも直前の段の番号で引けば正しい組だけを選べる」は、エンジンの側の説明で、この GUI の保証ではない。GUI は新しい項目を読み、上の形だけを受け付ける

### 12.3 確かめた挙動（固定例から、通常の操作の列）

固定例（`server/tools/build_u7_5e_scenarios.py`。導入済みのエンジンの公開の入口だけで作る）。準備は初期配置が最初の選べるもの・補償は最大・ジャンケンはプレイヤー0。

- ロケット団のヒトカゲ（new_game。エンジンのテストの RC_DECK 同士・seed 1）: 番 1 にロケット団のヒトカゲ・コラッタをベンチ、炎エネルギーをポニータ → 番 3 に炎エネルギーをコラッタ →［ほのおをもらう］（`source` 2 つ → `energy`。`after` と組が一致）。`[元A, 元B のエネルギー]`・逆の順・1 つだけ・空は `CANDIDATE_INPUT_INVALID`（submit も `refused`。相手・観戦者の更新 0 件）→ 正しい入力は check 有効 → 受理（`in_progress`）→ 相手の観測でポニータ 0・ロケット団のヒトカゲ 1・コラッタ 1 → 同じ番には候補が出ない（コラッタにまだ炎エネルギーがある。番ごとに 1 回）。相手の候補は `waiting_for_player`
- ダークユンゲラー（new_game。ケーシィ 4・ダークユンゲラー 4・超エネルギー 52 対 RC_DECK・seed 1）: 番 1 に超エネルギー → 番 3 に進化 →［ぶっしつこうかん］（`no_input`・`choices_format: "[]"`。`["o1"]` は断る、`[]` は check 有効）→ 受理（`awaiting_decision`・本人の `answer_decision`）。相手は待つ。決定 `discard_from_hand`（1〜1・辞退できない）→ 答えて受理 → 観測でトラッシュ +1・手札の枚数は同じ → 同じ番には出ない
- エナジートランス（再生。フシギダネ・フシギソウ・フシギバナ各 4 と草エネルギー 48 対 RC_DECK・seed 1・13 コマンド）: 番 5 に［エナジートランス］（3 段。元はフシギバナ 1 つ・エネルギー 3 枚・先はエネルギーごとに別の番号）。混ぜた入力（2 段目 A と、2 段目 B に続く 3 段目）は断る → 受理 → 相手の観測でバトル場 −1・ベンチ +1 → 続けて候補が出る（回数の制限はない）
- 探索: 対象と上限を先に決めた（ダークユンゲラー seed 1〜10・フシギバナ seed 1〜10。どちらも seed 1 で条件を満たした。各 seed 1 回）

### 12.4 実エンジンで通していない範囲（模擬の単体テストだけ）

形はエンジンの文書の 7.1 の JSON の例と `legal_actions.py` から作った（`web/src/test/u75e.ts` の区分）。同じ形を運べることを、実際の場面で画面が正しく動くことと同じには扱わない。

- 元が 2 匹ある 3 段（1 段目を変えて 2・3 段目を捨てる画面の動きは模擬だけ。実エンジンの 3 段は元が 1 匹）
- 相手の場の元と先（のろい・じっとみる）・相手のうらのカードを指定する組（`unverified`）
- 宣言のない型（入力非公開）・止める候補（入力なしで実行できない区分）
- 写した特殊能力（メタモン）・「ばける」の印刷したカード、ねむり・かがくへんかガスで候補が消えること、あまごい・ダメージスワップの形
- 特殊能力のエンジンの `rejected`（MH1 など）・受理のあとの停止

### 12.5 検証用の固定例の互換性（0.171.0）

`server/tools/scenario_views.py --full` を 0.170.0（`0885d66`）と 0.171.0（`74c8e1f`）の環境で実行し、9 つの固定例の応答の全体を項目ごとに比べた。全入口の view は同じ（`views_sha256` も同じ）。candidates の違いは `coverage.implemented_kinds` に `use_power` が加わったこと（「ばける」の時点は番の中なので `not_covered_kinds` から `use_power` が外れた）だけで、どの時点にも `use_power` の候補は出ない。記録し直さず、9 つの JSON の `compatibility` に確かめた結果を追記した。記録のエンジン（`ffcc5ca`・`0885d66`）は書き換えていない。U7-5e の 3 つの固定例は 74c8e1f で作った。

## 13. U7-5f・g（表示だけの候補・coverage の残り・経路で引く段・本人のうらのカードの特殊能力。e26df79 の実応答で確かめた）

確かめ方: エンジンの `docs/legal-actions-u7-5fg.md`・`docs/legal-actions-u7-5fg-spec.md`（文書は公開ブランチの最新の `05a6749`。文書だけのコミットで、固定する `e26df79` との差は `docs/` だけ）と `kyuura_engine/legal_actions.py`（e26df79。読むだけ）の `_face_up_candidate`・`_add_energy2_stage`・`_path_stage_problems`・`_face_down_power_candidates`・`RESIDUAL_CLASSES`・`_residual_present`・`_unverified_paths`・`_candidates`、導入済みのエンジンの実応答（GUI の側で上限を決めた探索と、接続層のテスト `server/tests/test_u7_5fg.py`・e2e `web/e2e/u75fg.spec.ts`）。比べた GUI は main の `088822c`（U7-5e の `e3bb682` を含む。エンジン 0.171.0 を固定）。契約の識別・形式の版は同じ（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）。

### 13.1 候補と coverage

- `implemented_kinds` に `check_face_up_deck`（`use_power` のあと、ホストの 2 種類の前）。番のプレイヤーの MAIN の `not_covered_kinds` は空、`display_only_kinds` は `["check_face_up_deck"]`、`partial_residual` は `["R-2"]`（completeness は partial のまま。対応しない種類と not_offered の分類から決まり、決め打ちではない）
- coverage の項目（`coverage_keys`）: `implemented_kinds`・`scope_kinds`・`offered_kinds`・`not_covered_kinds`・`display_only_kinds`・`withheld_input_candidates`・`completeness`・`completeness_scope`・`completeness_basis`・`partial_residual`・`residual`・`unverified_paths`。ほかの項目は「不明な応答」として止める
- `residual.classes`: R-2（`use_attack`・`turn_player_main`・`not_offered`）・R-3（`use_power`・`turn_player_main`・`input_withheld`）・R-4（`check_face_up_deck`・`other_than_turn_player_main`・`out_of_scope`）・R-5（種類なし・`any`・`input_withheld`）。どの応答も同じ値（`note` はエンジンの説明文で、契約の表には写さない）。R-1（カツラの 2 枚目）は 3 段目で示すので欠番
- `residual.present`: `{"id", "scope": "public"}`（公開の状態から。R-2 はうらのバトル場、R-4 は相手の山札のおもてが 2 枚以上）か `{"id", "scope": "actor", "candidate"}`（本人の候補から。入力を返さない候補ごとに R-3 か R-5）。`unverified_paths`: `[{"reason", "candidates": [候補の id]}]`（理由の並びは名前の順）
- 番でないプレイヤー・決定の回答者（準備を含む）で相手の山札のおもてが 2 枚以上なら、`not_covered_kinds` に `check_face_up_deck`・`scope_kinds` にも加わり partial、`present` に R-4。候補がなければ `empty_reason` は `kinds_not_covered`。決定の回答者は R-5 だけなら complete のまま
- GUI の検証: 項目の表、分類が契約の表と同じ（数・並び・値）、`present` の id が分類にある・`scope` が public なら `candidate` がない・actor なら `candidate` がある・重ならない、`partial_residual` は not_offered の分類、`present`・`unverified_paths`・`withheld_input_candidates` の候補が応答にある、`display_only_kinds` は契約の表の種類で `scope_kinds` にある、表示だけの種類の候補は `display_only_kinds` にあり送れない区分、未対応の種類・示さない経路があるのに complete なら止める

### 13.2 表示だけの候補（check_face_up_deck・U7-5f）

| 項目 | 実応答 | GUI の扱い |
|---|---|---|
| 候補 | `processability: unresolved_ruling`・`reasons: ["stops_before_acceptance"]`・`input_disclosure: confirmed`・1 段。番のプレイヤーの MAIN だけ（MAIN_KINDS の最後） | 候補に「表示だけ（送れません）」。「位置を表示する」は inputs だけ。`gui_operable_kinds` に加えない |
| 段 | `role: face_up_position`・`meaning: deck_position`・`count` 1〜1 | 1 段・この role と meaning でなければ止める |
| 選べるもの | `id`・`owner`・`position`・`eligible: false`・`processability`・`reasons`（位置は 1〜相手の `face_up_count` − 1。0 がいちばん上） | ほかの項目（カード ID など）・`position` 0・送れる区分なら止める。「相手（プレイヤー1）の山札・上から position+1 枚目」と `owner`・`position` を並べて表示。カード ID・名前・画像を補わない |
| check・submit | 形の合う入力は `CANDIDATE_NOT_EXECUTABLE`、知らない番号は `CANDIDATE_INPUT_INVALID`（エンジンに渡さない。更新なし） | GUI は呼ばない（検査・送信のボタンがない。e2e で要求がないことを確かめた）。未裁定でゲーム上の禁止ではないと表示 |

### 13.3 経路で引く段（attach_energy の任意の 3 段目 energy2・U7-5g-1）

| 項目 | 実応答（カツラの効果がある番） | GUI の扱い |
|---|---|---|
| 段の並び | `[energy, target, energy2]`（カツラの効果がない番は `[energy, target]` のまま） | `attach_energy_role_shapes` のどちらか。ほかは止める |
| 3 段目 | `meaning: card`・`count` 0〜1・`decline: true`・`path_stages: [1, 2]`・`options_by_path`。`options_by_choice`・`depends_on_stage`・`upstream_stages` はない | 契約の表（`path_stage_kinds`）の種類・段・形だけ。ほかの種類・段に `path_stages` があれば止める |
| 鍵と参照 | 鍵は 1・2 段目の選ぶものの番号を `/` でつないだもの（`"o1/o8"`）。値は参照（`option`・`eligible`・`processability`・`reasons`）の並び。3 段目の番号は 1・2 段目のあとに続き、1 段目と同じカードでも別の番号（その組には出ない） | 鍵の段の数・番号が path_stages の段にある・前の段どうしの組が 2 段目の `options_by_choice` にある・参照がこの段にある・重ならない。`path_stages` は前の段の増える並び（空・逆・自分やあとの段は止める）。エンジンの `_path_stage_problems` と同じ確かめ |
| 画面 | — | 今の 1・2 段目の鍵の一覧だけを出す（全部の組を GUI で作らない）。鍵がなければ「この段に選べるものがありません。選ばずに送れます」。1・2 段目を変えたら 3 段目の選択を捨てる（`downstreamOf` が path_stages もたどる）。送る順は段の順 |
| check の答え | 1 段目を変えた古い 3 段目・同じカード・知らない番号・4 つ以上・逆の順は `CANDIDATE_INPUT_INVALID`。エンジンは check なしの submit も受け付ける（check は送信の条件ではない） | 入力を変えたら前の答えと、変える前に始めた遅れた答えを使わない（元の入力に戻しても検査し直す）。GUI の決まりとして、attach_energy は 1 枚・2 枚とも送る前の check を必須にする（13.3.1） |

カツラの許可・炎の判定・つける先・回数・レインボーは GUI で判定しない（エンジンの組と送信が決める）。

#### 13.3.1 送る前の check（GUI の決まり。`3740355` のあとの訂正）

`3740355` までは「attach_energy は送る前の check を必須にしていない」としていた。エンジンが check なしの submit を受け付けることと、GUI が送る前に check を要求することは別なので、GUI の送信の条件を次に統一した。

| 区分 | 条件 |
|---|---|
| エンジンが要求する条件 | なし（submit は check を前提にしない。受理・拒否は submit の応答で決まる）。エンジンは変更していない |
| GUI が要求する条件 | attach_energy は、energy2 の段の有無・2 枚目の有無にかかわらず、今の取っ手・今の候補・今の入力への check が通っている場合だけ送信できる |

- 仕組み: 契約の表の `check_before_submit_kinds` に `attach_energy` を加えた（ワザ・U7-5 の 5 種類・use_power と同じ一覧。説明に GUI の決まりと明記）。条件の関数は `web/src/state/checkGate.ts` の 1 つで、送信のボタンの可否（`DecisionPanel`）と送信の処理の入口（`useEndpointSession` の submit）が同じ関数を呼ぶ。入口で条件を満たさなければ submit の要求を出さず、「送信していません」と知らせる
- 答えを捨てる場面: 1 段目のエネルギーを変える・2 段目のつけ先を変える・3 段目の 2 枚目を選ぶ・変える・外す（どれも入力の変更）、候補・取っ手が変わる（選び直す・取っ手の取り直し）、閲覧者を切り替える（部品ごと作り直す）。入力の世代は既存の `checkEpoch` を使い、別の状態の管理は加えていない（候補を選んだときにも世代を進めるようにした）
- 元の入力に戻しても、変える前に始めた check の遅れた答えは置かず、検査し直す
- check・submit を自動で実行・再送しない

### 13.4 本人のうらのカードの特殊能力（U7-5g-2）

- 候補の `pokemon`: `{"pokemon", "card", "zone", "bench_index", "face_down": true}`（カード ID がない）。`power`: `{"index", "name_ja", "card", "card_id", "face_down": true}`（`card_id` は本人が知る本当のカード。本人の候補にだけ出る）。片方だけの `face_down`・うらの `pokemon` のカード ID・`pokemon` と `power` の片方だけは止める
- 0 段: `unverified`（`face_down_reveal_not_evaluated`）・`no_input`・`choices_format: "[]"`。1 段（前の段によらない場所）: `unverified`・`confirmed`・段は U7-5e の形（`[source]`・`[target]`・`[energy]`）。2 段以上・宣言のない型・登録のない力・選べるもののない段: `not_implemented`（`face_down_reveal_not_evaluated`・`input_boundary_unconfirmed`）・`unconfirmed`・inputs は `withheld`（`INPUT_BOUNDARY_UNCONFIRMED`）。check は `CANDIDATE_NOT_EXECUTABLE`。`residual.present` に R-3（actor・その候補）
- 画面: 盤面の情報（裏向きのポケモン・場所。盤面の画像は裏面）と、本人が知る本当のカード（`power.card_id`）を分けて文字で書く。説明は公開カード定義の印刷（位置と名前が合うときだけ）。`unverified` を「使える」「受理される」と書かない。送る前に check（use_power の決まり）。入力を返さない候補は入力非公開で送れない
- 情報境界（実エンジンで確かめた）: 相手・観戦者の観測の、うらのカードの場所はカード ID・`real` がない。相手の候補の応答に能力の名前がなく、`residual.present`・`unverified_paths` は空。check は相手・観戦者に更新を作らない。受理のあと、おもてにしたカードは観測で全員に公開
- 送ったとき（エンジンの既存の入口のまま）: たねポケモンで確かめを通れば受理（受理のあとの決定・コインは answer_decision）、通らなければ拒否（状態・ログはもどり、おもてにしたことも公開されない。GUI は拒否を送った人にだけ表示）、たねポケモンでなければトラッシュして受理（特殊能力はおこらない）。GUI は結果を予告しない

### 13.5 確かめた挙動（固定例から、通常の操作の列）

固定例（`server/tools/build_u7_5fg_scenarios.py`。導入済みのエンジンの公開の入口だけで作る）。準備は初期配置が最初の選べるもの・補償は最大・ジャンケンはプレイヤー0。探索は対象と上限を先に決めた（フラッシュ: 後攻の最初の番の手札にフラッシュがある seed を 1〜20、うらのカード: 準備のあとの先攻の手札にマチスの秘策・マンキー・ロケット団のヒトカゲがある seed を 1〜40。各 seed 1 回。最初の 2・8 を使った。マチスの秘策 2 枚とマンキー・ロケット団のヒトカゲが同時にある seed は 1〜40 になく、1 つの対戦で両方をうらに出す経路は作っていない）。

- カツラ（new_game。エンジンのテストの BLAINE_DECK 同士・seed 1・補償 1 回）: 番 1 のカツラの前は 2 段 → カツラ（play_trainer）→ 3 段（`path_stages: [1, 2]`）。同じカード・1 段目を変えた古い 3 段目・知らない番号・4 つ・逆の順は断る（相手・観戦者に更新なし）→ `[e1, つける先]` と `[e1, つける先, e2]` は check が通る → 2 枚で受理 → 相手の観測で +2 → attach_energy の候補が出ない。1 枚だけの送信も受理（別の対戦）
- フラッシュ（再生。ヒトカゲ・炎エネルギー 対 ヒトカゲ・フラッシュ・炎エネルギー・seed 2。準備・番を終える・フラッシュ・先攻の並べ替えの 4 つの U7 の操作のあと、後攻の並べ替えの決定）: 後攻（決定の回答者）は R-4 で partial（`not_covered_kinds: ["check_face_up_deck"]`）→ 5 枚の並べ替えに答える → 番を終える → 先攻の MAIN に表示だけの候補（相手の山札の位置 1〜4）→ 番でない後攻は候補なし・`kinds_not_covered`・R-4
- うらのカードの特殊能力（new_game。マンキー（PMCG2-028）4・ロケット団のヒトカゲ 4・マチスの秘策 4・闘エネルギー 48 対 RC_DECK・seed 8）: 番 1 にマチスの秘策 → うらにするカードの決定でマンキー → 本人の候補に［スパイ］（入力なし）→ check → 受理（`awaiting_decision`。おもてにしてから決定）→ 相手の観測でおもてのマンキー。ロケット団のヒトカゲをうらに出すと［ほのおをもらう］は入力を返さない（R-3・actor、相手の応答に出ない）
- 遅れた応答（e2e）: 3 段目を選んで出した check の応答をブラウザの通信の差し替えで 1.5 秒遅らせ、その間に 1 段目を変えた → 届いた答えは表示されず、選び直して検査し直してから送った

### 13.6 実エンジンで通していない範囲（模擬の単体テストだけ）

形はエンジンの文書の 3 章の JSON の例と `legal_actions.py` から作った（`web/src/test/u75fg.ts`）。同じ形を運べることを、実際の場面で画面が正しく動くことと同じには扱わない。

- 1・2 段目の組のうち鍵がない組（ベンチのつけ先。実エンジンの固定例は場のポケモンが 1 匹）・レインボーエネルギー・特殊エネルギーの 2 枚目・BL1（1 枚のあとの 2 回目）
- 本人のうらのカードの 1 段の特殊能力（アンノーンB の［ベアー］など）、送ったあとの拒否（おもてにしたあとの確かめが受け付けない）・トラッシュ（たねポケモンでない本当のカード）
- R-2 が `present` にある場面（うらのバトル場のポケモン）、R-5 の `present`、`state_not_supported` の表示だけの候補、R-4 の準備の段階

### 13.7 検証用の固定例の互換性（0.172.0）

`server/tools/scenario_views.py --full` を 0.171.0（`74c8e1f`）と 0.172.0（`e26df79`）の環境で実行し、12 の固定例（11 の JSON）の応答の全体を項目ごとに比べた。全入口の view と作成の知らせは同じ（`views_sha256` も同じ）。candidates の違いは、coverage に `display_only_kinds`・`completeness_basis`・`partial_residual`・`residual`・`unverified_paths` が加わったこと、`implemented_kinds` に `check_face_up_deck` が加わったこと、番のプレイヤーの MAIN の 2 時点（「ばける」・エナジートランス）のプレイヤー 0 の応答で `not_covered_kinds` が空になり `display_only_kinds: ["check_face_up_deck"]`・`partial_residual: ["R-2"]` になったこと（意図した差）だけ。候補の並び・中身は同じで、どの時点にも U7-5f・g の候補は出ない。どの時点も `residual.present`・`unverified_paths` は空。記録し直さず、11 の JSON の `compatibility` に確かめた結果を追記した（記録のエンジン `ffcc5ca`・`0885d66`・`74c8e1f` は書き換えていない）。U7-5f・g の 3 つの固定例は e26df79 で作った。

### 13.8 実行した検証の記録

前回（`3740355` まで）と、今回の訂正（13.3.1）の実行の結果を分けて書く。

#### 前回（`3740355` まで）

| 場所 | 実行したもの | 結果 |
|---|---|---|
| 作業場所（GUI の worktree） | 新しい e2e 4 件（`u75fg.spec.ts`） | 成功 |
| 作業場所 | 既存の e2e 23 件 | 初回は 20 件成功・3 件失敗。原因を直したあと、失敗した 3 件だけを再実行して成功 |
| 作業場所 | 本番ビルドの e2e（preview。`KYUURA_E2E_PREVIEW=1`）4 件 | 成功 |
| クリーンな場所 | setup・接続層のテスト 113 件・単体テスト 221 件・型検査・ビルド | 成功 |
| クリーンな場所 | e2e・preview | 実行していない |

#### 今回（13.3.1 の訂正）

作業場所（GUI の worktree `kyuura-engine-gui-wt-u75fg`。エンジン 0.172.0・`e26df79` の通常のインストールのまま）だけで、変更に関係する対象を各 1 回実行した。失敗はなく、失敗による再実行はない（実行のあとの import の整理で 1 ファイルと型検査だけをもう 1 回実行した。表の最後の行）。件数と終了コードは JUnit と終了コードの記録に残した（2026-11-08 に補足: `web/playwright.config.ts` の reporter は `list` だけで、e2e の JUnit は実行のときのコマンド行の `--reporter=list,junit` と環境変数 `PLAYWRIGHT_JUNIT_OUTPUT_NAME` で出した。vitest は `--reporter=junit --outputFile.junit=…`、pytest は `--junitxml` をコマンド行で指定した。設定だけでは JUnit は出ない）。

| 実行したもの | 結果 |
|---|---|
| 型検査（`tsc --noEmit`） | 終了コード 0 |
| 単体テスト（vitest）: 送信の門・U7-3・U7-5f・g・決定の入力・ワザ・U7-5・U7-5e の部品と画面全体の 13 ファイル（`checkGate.test.tsx` を加えた） | 184 件成功・終了コード 0 |
| 接続層のテスト `server/tests/test_contract.py`（契約の表とエンジンの定数） | 13 件成功・終了コード 0 |
| ビルド（`npm run build`） | 終了コード 0 |
| e2e `u75fg.spec.ts` のカツラの 1 件（実ブラウザ・実エンジン・実 renderer。送信は check の前は無効・2 枚目を外す・選び直すたびに検査し直す・2 枚で受理） | 1 件成功・終了コード 0。Playwright が起動した接続層（8766）と Vite（5174）は終了後に残っていない |
| 上のすべての実行のあと `checkGate.test.tsx` の import を 1 行にまとめた（中身は同じ）ので、そのファイルと型検査だけをもう 1 回 | 4 件成功・型検査とも終了コード 0 |

実行していないもの: 接続層のテストの残り・単体テストの残り（カード画像・検証）・e2e の残り・preview・クリーンな場所での再構築・依存の更新の確かめ・エンジンの全体テスト。既存の e2e のうち attach_energy を check なしで送っていた `turn-basics.spec.ts`（3 か所）・`u75e.spec.ts`（1 か所）・`helpers.ts` の `attachToActive`（`attacks.spec.ts`・`u75.spec.ts`・`u75e.spec.ts` が使う。2026-11-08 に訂正: 当初は `attacks.spec.ts`（33・68・92・97・136 行）を書き落としていた。attacks も b1037bc の変更のあと実行していなかった）は、送る前に check するように直したが、今回は実行していない。

### 13.9 U7 の総合検証の先行の実行（G0・G1。2026-11-08）

エンジンの計画（`docs/u7-integration-verification-plan.md`。エンジンのブランチ `claude/u7-integration-plan`）の G0・G1 を、作業場所 `kyuura-engine-gui-wt-u75fg`（`b1037bc`・変更なし）で実行した記録。13.8 の「前回」「今回」とは別の実行で、数を足さない。全体の記録はエンジンの `docs/u7-integration-verification-e0-g1.md`。

- G0: `b1037bc`・変更なし。`server/.venv` の kyuura-engine は Git の URL からの通常のインストール（`commit_id` `e26df79…`・0.172.0・編集可能でない・`module` は作業場所の `.venv` の下）。renderer は lockfile の `resolved` が `af88231…`（package 0.1.0）。Playwright 1.65.0・Edge 157。8765・8766・5173・5174・4173 の待ち受けなし
- G1 の対象（実際の呼び出し先で確かめた。b1037bc の送る前の check の変更のあと実行していなかったもの）: `turn-basics.spec.ts` 2・`u75e.spec.ts` 3・`u75.spec.ts` 6・`attacks.spec.ts` 3（計 14 件）。1 ファイルずつ、`npx playwright test <ファイル> --reporter=list,junit`（`PLAYWRIGHT_JUNIT_OUTPUT_NAME` で JUnit）

| 実行 | ファイル | 結果 | 数え方 |
|---|---|---|---|
| 1 回目 | 4 つのファイル名が 1 つの絞り込みとして渡った（実行の道具の引数の誤り） | テスト 0 件・終了コード 1 | 数えない |
| 2 回目 | `turn-basics.spec.ts` | 2 件成功・終了コード 0 | 数える |
| 2 回目 | `u75e.spec.ts` | 3 件成功・終了コード 0 | 数える |
| 2 回目 | `u75.spec.ts` | 中断（6 件のうち 5 件が ✓ のところで、実行の環境がメモリ不足で止めた。JUnit・終了コードなし） | 数えない |
| 2 回目 | `attacks.spec.ts` | 始めていない | 未実行 |

- 止まったあと、8766・5174 の待ち受けと、接続層・Playwright のプロセスは残っていない（止めたものはない）。重い実行は自動で再開していない
- 今回の接続層であることの確かめ: 接続層の待ち受けのコマンド行は相対の `..\server\.venv\Scripts\python.exe` で作業場所の場所を含まないので、祖先が今回起動した npx であることで確かめた
- 残り: `u75.spec.ts`・`attacks.spec.ts`（G1）と G2 以降（残りの e2e・接続層・単体・preview・クリーンな場所）は未実行

#### 13.9.1 G1 の再開（残り 9 件。2026-11-08 16:20〜16:25）

13.9 の 2 回目で中断・未実行だった `u75.spec.ts`（6 件）と `attacks.spec.ts`（3 件）を、1 件ずつ別の Playwright のプロセスで実行した（作業場所 `b1037bc`・変更なし。13.9 の完了した 5 件は再実行していない。中断した u75 の途中の 5 件は数えていない）。

- 絞り込み: `npx playwright test e2e/<ファイル>:<行> --reporter=list,junit`（`PLAYWRIGHT_JUNIT_OUTPUT_NAME`）。JUnit の件数が 1 で、テスト名が対象の完全な名前と同じことを確かめた
- 結果: 9 件とも成功（各 JUnit tests 1・failures 0・errors 0・skipped 0、終了コード 0）。テストの時間は 2.2〜5.4 秒（設定の期限 120 秒）、接続層と Vite の起動・終了を含むプロセスの時間は 9.9〜16.3 秒
- G1 の到達: 対象 14 件すべてに成功の結果がある（13.9 の 5 件とこの 9 件。2 回の実行に分かれる）
- 資源: e2e 1 件のプロセスの木（npx から下）の私用のメモリは最大約 1.5 GB。端末の空きは最小 3,293 MB、コミットの空きは最小 4,218 MB。停止の知らせはなかった
- 今回の接続層であることの確かめ: 始める前に待ち受けがないこと、`reuseExistingServer: false`、接続層（python）と Vite（node）が今回起動した npx の子孫として記録されたこと（1 件目は道具の誤りで子孫を記録できなかった）、終わったあと待ち受けと子孫のプロセスが残っていないこと。待ち受けの観測（2 秒ごと）は記録がなく、待ち受けの pid とコマンド行の照合はできていない
- 詳細はエンジンの `docs/u7-integration-verification-e0-g1.md` 9 章

#### 13.9.2 G2〜G5（2026-11-08 18:28〜18:4x）

エンジンの計画の G2〜G5 を実行した記録（GUI `b1037bc`・エンジン `e26df79`・renderer `af88231`。GUI のコードは変えていない）。13.8・13.9・13.9.1 とは別の実行で、数を足さない。すべて 1 つずつ別のプロセスで、並列にしていない。全体の記録はエンジンの `docs/u7-integration-verification-e3-g5.md`。

| 段 | 場所 | 結果 |
|---|---|---|
| G2 | 作業場所 `kyuura-engine-gui-wt-u75fg` | tsc・`npm run build` 終了コード 0。vitest 18 ファイル 227 件・pytest 10 ファイル 113 件・失敗 0。e2e `local-flow` 5・`card-images` 4・`u75fg` 4 の 13 件・失敗 0 |
| G3 | 同（G2 のビルド） | `KYUURA_E2E_PREVIEW=1`（`npx vite preview`）で `card-images` 4・`u75fg` 4 の 8 件・失敗 0 |
| G4 | クリーンな場所（新しい clone を `b1037bc` に detach。新しい npm のキャッシュ・pip のキャッシュなし・空の PYTHONPATH・ssh なしで `npm run setup`） | 接続層の kyuura-engine は Git の URL からの通常のインストール（`e26df79…`・0.172.0・編集可能でない）。tsc・build 0、vitest 227 件・pytest 113 件、e2e 7 ファイル 27 件・preview 8 件・失敗 0 |
| G5 | 両方の場所（読むだけ） | package.json・lockfile の `resolved` は `af88231…`・version 0.1.0。入れた renderer の package.json・README.md は renderer の `af88231` の木と同じ sha256。`dist-lib/` の 75 ファイル（入れるときに作るもの）は 2 つの場所で同じ。2026-11-08 に読み取りだけで確かめ直した（下の G5 の確かめ直し） |

- e2e の選択: JUnit の件数がファイルの件数と同じことで確かめた。接続層（`..\server\.venv\Scripts\python.exe -m kyuura_gui_server --port 8766 --test-fixed-seed 21`）と Vite は、各実行で起動した npx の子孫として記録した
- 待ち受けの観測の訂正: この環境では `Get-NetTCPConnection` が待ち受けを示さず、netstat の `LISTENING` は生きている待ち受けでも pid 0 で、止めたプロセスの残り（接続を拒否する）も出る。13.9・13.9.1 の「待ち受けなし」は弱い根拠だった（プロセスの確かめは別で有効）。G2 の 2 ファイル目からは、8765・8766・5173・5174・4173 に直接 TCP でつなげるかで決めた。始める前と終わったあと、どこにもつながらなかった
- 事故: G4 の `u75.spec.ts`・`u75e.spec.ts` の後始末で、検証の道具（ParentProcessId をたどって子孫を集め、残りを `taskkill /T /F` で止めていた）が、pid の再利用で今回の実行でないプロセスを子孫と誤って数え、181 件に `taskkill /T /F` を要求した（今回の実行の過程は 0 件）。あとの確かめで 53 件（常駐のアプリ・デスクトップの部品など）がいなかったが、止められたのか自分で終わったのかは区別できない（2026-11-08 に訂正: 以前は「53 件を止めた」と書いていた）。テストの結果とは別。道具は直したが、直したあとは実行していない（エンジンの文書の 6.6 節）
- G5 の確かめ直し（2026-11-08。ファイルと git の読み取りだけ。インストール・テストの再実行なし）: 2 つの場所の `web/package.json`・`web/package-lock.json` は `b1037bc` の木と同じ sha256。入れた renderer は 77 ファイル（package.json・README.md・`dist-lib/` 75）で、道の一覧と sha256 は 2 つの場所で全部同じ。`dist-lib/` は renderer の `af88231` の木になく（`.gitignore` にあり、`prepare` が `build:lib`）、クリーンな場所では G4 の準備のあいだ（18:39:27）に作られた。75 の内訳は、木の素材と同じバイトの画像 51 と、ビルドで作る `.js`・`.d.ts` 24（CRLF・絶対パス・source map の参照なし）。フォント `@fontsource/noto-sans-jp` 5.3.1 の 2,319 ファイルも 2 つの場所で同じ。詳細はエンジンの文書の 6.4 節
- 終わったあと: 作業場所とクリーンな場所の指紋は E0 と同じ・変更なし。利用者の作業場所の未コミットの 13 件は E0 の記録と同じ

## 14. P6（本人のうらのバトル場のポケモンのにげる。0.174.0・f7bf450 の文書・コードと実応答で確かめた）

作業場所: `C:\dev\kyuura-engine-gui-wt-p6`（ブランチ `feature/engine-p6-retreat-facedown`。基点 `78c02a6` = `feature/u7-verification-e0-g1`。U7-5f・g と attach_energy の送る前の check の修正 `83faeb0`・`b1037bc` を含む）。エンジン・renderer・検証用 AI の道具は読むだけで、変えていない。

### 14.1 固定と依存の更新（0.172.0 → 0.174.0）

- 固定: `kyuura-engine @ git+https://github.com/moheronemy/kyuura-engine@f7bf450580bf0d02573b4d032271be6b8e12d699`（0.174.0）。文書だけの後続のコミット・エンジンの main には自動で追従しない。renderer の固定（`af88231`）・`web/package.json`・lockfile は変えていない（`npm run setup` の `npm install` のあとも差分なし）
- 導入の確かめ（新しい作業場所の新しい `.venv`）: `direct_url.json` の `vcs_info` は git・`commit_id` が `f7bf450…`・編集可能でない、配布メタデータとパッケージの版がどちらも 0.174.0、`kyuura_engine` は `server/.venv/Lib/site-packages` から読む。`python -m kyuura_gui_server.engine_source` と `server/tests/test_contract.py::test_engine_identity` が同じことを確かめる
- `e26df79` から `f7bf450` までの `kyuura_engine/` の差分: `legal_actions.py`（P6。`_retreat_candidate` のうらの分岐だけ。`GUARANTEE_FACE_DOWN_RETREAT`・`COST_NOT_EVALUATED` を加えた）、`replay_record.py`・`view_record.py`（0.173.0 の CN-1 の正式な修正。`ReplayCollector`・`ViewHost` に `failure` を加え、包んだ対戦の値をそのまま返す）、版の番号。`client_api.py`・`engine.py`・同梱のカードデータは変わっていない。GUI の接続層は `ClientHub.start`・`from_state` だけを使い、`ReplayCollector`・`ViewHost` を包まないので、CN-1 の修正は GUI の応答に現れない（14.7 の比べで確かめた）
- 契約の識別・形式の版（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1）は同じ。ただし、項目の追加（`cost_evaluation`）と省略（`total_units`・`units`）を含むので、契約の版が同じことを古いクライアントとの機能の互換の保証とは扱わない（0.172.0 対応の GUI の検証は、`cost_evaluation` を知らない段の項目として止める）

### 14.2 入力契約（エンジンの `docs/legal-actions-p6-face-down-retreat.md` 2 章・`legal_actions.py` と実応答）

| | おもてのバトル場のポケモン（変わらない） | 本人のうらのバトル場のポケモン（P6） |
|---|---|---|
| 候補 | 確かめの結果の `processability`・`GUARANTEE_TURN_ACTION` | `unverified`・`["face_down_reveal_not_evaluated"]`・`input_disclosure: confirmed`・`GUARANTEE_FACE_DOWN_RETREAT` |
| 段 1（`new_active`・`pokemon`・1〜1） | 場のポケモンの形（`board_option_keys`） | 同じ形。各選べるものは `eligible` 真・`unverified` |
| 段 2（`discard`・`card`・0〜枚数・`distinct`・`significant`・`order_preserved`） | `total_units` と、すべての選べるものに `units`（`eligible`・`reasons` なし） | `total_units`・`units` を省き、`cost_evaluation: {"status": "not_evaluated", "reason": "face_down_reveal_not_evaluated", "omitted": ["total_units", "units"]}`。選べるものは `id`・`card`・`card_id`・`special`・`eligible`・`processability`・`reasons` |

GUI の実行時の検証（`web/src/api/validate.ts` の `costEvaluation`・`retreatStages`。契約の表 `retreat_stage_roles`・`retreat_discard_option_keys`・`retreat_cost_evaluation`。`server/tests/test_contract.py::test_retreat_contract_matches_engine_source` がエンジンの定数・ソースと照らす）:

- `cost_evaluation` は項目がちょうど `status`・`reason`・`omitted`、値は表と同じ（`omitted` は並びも同じ）。知らない値・項目・型は止める
- `retreat` の段 2 だけで使う。段 1・ほかの種類の段・値の段の `cost_evaluation`、ほかの種類の段の `total_units`・`units` は止める
- 段 2 はどちらか 1 つの表し方だけ: `total_units` とすべての `units`（おもて）か、`cost_evaluation` で `units` なし（P6）。両方ある・両方ない（費用 0 と見なさない）・一部の選べるものだけ `units` は止める
- 段の並び・数（段 2 の `count` は 0〜選べるものの数）・重なりなし・`significant`・選べるものの項目を確かめる。段のない `retreat`（宣言の確かめが止める送れない候補）は今までどおり受ける

### 14.3 表示

- 費用（必要なエネルギーの個数）とカードごとのエネルギーの個数は「評価していません」。選んだカードの枚数は表示するが、エネルギーの個数・足りることとは別と書く。`total_units` がないことを費用 0 と読まない
- 本人の観測の `real`・公開カード定義から費用・タイプ・個数を計算しない。盤面のうらのカードは裏面のまま（`real` は本人の画面の文字だけ。画像にしない）
- 選べるのはエンジンが返した控えとエネルギーカードだけ。うらの候補を、ねむり・マヒなどを根拠に GUI で使えなくしない（`unverified` は送れる区分）。結果は予告しない
- おもてのにげるは今までどおり `total_units`・`units` の個数と枚数を分けて表示する（`TurnBasics.test.tsx`・`P6.test.tsx` の回帰・既存の e2e）

### 14.4 送る前の check（GUI の決まり）と保証の範囲

- `check_before_submit_kinds` に `retreat` を加え、`needsCheckBeforeSubmit` を種類だけで決める（以前の「`total_units` のある段があるとき」は外した）。条件は 1 つ:「今の主体・取っ手・候補・入力への check が通っている場合だけ送信できる」。送信のボタン（`DecisionPanel`）と送信の入口（`useEndpointSession` の submit）が同じ `checkGatePassed` を呼ぶ
- 前の答えを使わない変更: 控えの変更、トラッシュするカードの選択・解除・順序の変更（`onInputChange` → `inputChanged`）、候補・取っ手の変更（`select`）、閲覧者の切り替え（画面の作り直し・世代の番号）。元の入力に戻しても、変える前に始めた check の遅れた答えは既存の `checkEpoch` で捨てる（別の状態の管理は加えていない）
- P6 の check（エンジン）が確かめるのは、番号が候補にあること・段の並び（1 つめが段 1、残りが段 2）・段 2 の重なり（したがって数）だけ。費用・タイプ・受理は確かめない。足りないエネルギーの入力でも形が合えば通る（構築盤面 B）。存在しない番号・重なり・並びの違いなどは `CANDIDATE_INPUT_INVALID` で通らない
- check・submit を自動で実行・再送しない

### 14.5 送信の結果と情報境界

- エンジンはコマンドの入口でこのポケモンをおもてにしてから決める。たねポケモンなら、ふつうに確かめて受理（にげる）か拒否。拒否は送った本人にだけ診断が返り、状態・乱数・ログはもどり、おもてにしたことも公開されない。たねでなければ、ついているカードといっしょにトラッシュして受理（にげるはおこらない）、空いたバトル場は `promote_active` の決定になる
- 拒否のあとの取っ手: エンジンの契約では拒否で取っ手は失効しない（構築盤面 B で、拒否のあと同じ取っ手の check が通ることを確かめた）。GUI の既存の方針では、送信のあと（結果によらず）観測と候補を取り直し、取っ手（`revision`）が同じなら選択を残す。check の答えは入力の鍵ごとに残るので、利用者が同じ入力をもう一度送ることはできるが、GUI は自動で送り直さない。受理では取っ手は失効し（`CANDIDATES_STALE`）、GUI は選択と古い候補を捨てて取り直す
- 情報境界: 本人の候補・inputs・check・診断・`real` は相手・観戦者の応答に出ない（接続層のテストで 3 つの盤面の相手・観戦者の view・candidates・updates に本当のカード ID がないことを確かめた。拒否では相手・観戦者の更新が増えず、view も同じ）。受理では、おもてにしたカード・にげた・トラッシュしたことが公開の更新と観測で全員に公開される（正当な公開）。双子（本当のカードだけが違う 3 つの盤面）で、本人の候補・inputs・check の答えが同じ（費用・タイプ・段階によらない）

### 14.6 構築盤面（テスト専用）

- new_game からの到達ではない。seed の探索はしていない。`server/tests/p6_boards.py` に、エンジンのテスト `tests/test_legal_actions_p6_face_down_retreat_v0_174.py` の `face_down_active(real)`（`tests/test_secret_plan_v0_67.py` の `board`・`place`・`to_active`・`opponent_turn`、`tests/helpers.py` の `build_test_state`）の、この盤面に要る部分だけを写した。初期の盤面だけを導入したエンジンの状態の型で組み立て、そこから先は公開のコマンド（`apply_command`）だけで進める。`check_invariants` が空であることを作るたびに確かめる
- 出典との一致: エンジンの固定コミットの `tests/` を `git archive f7bf450 tests` で作業ツリーの外に取り出し（エンジンの木は読むだけ）、3 つの盤面（本当のカードはコラッタ・イワーク・ユンゲラー。エンジンのテストの `TWINS`）で、エンジンの tests の盤面と GUI の盤面の `state_to_dict(format_version=22)` と乱数の指紋が同じことを確かめた（状態の sha256: A `e349918b…`・B `4b8214f0…`・C `53983e9f…`。出典のファイルの sha256 は証跡の `p6_board_provenance/compare.json`）
- 閉じ込め: 製品のコード（`kyuura_gui_server`）はこのモジュールを import しない。接続層のテストは `p6_boards.install(scenarios, monkeypatch)` で固定例の表に 3 つの名前を加え、e2e はテスト専用の起動の入口 `server/tests/p6_server.py`（`web/playwright.config.ts` で `KYUURA_E2E_SERVER_MODULE=tests.p6_server` のときだけ。ほかの値は設定の読み込みで止める）が同じことをする。作成の口が受け取るのは固定例の名前だけで、任意の状態を受け取る口は加えていない。導入したパッケージに tests がないので、製品のコードもテストも実行時にエンジンの tests を読まない（出典との一致の確かめだけが、取り出した tests を読む）
- 盤面の名前（A・B・C）は結果を予告しない。画面の表示はラベルと説明だけ（「テスト専用・new_game からではない」）

### 14.7 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を、0.172.0（`e26df79`。既存の作業場所 `kyuura-engine-gui-wt-u75fg` の `.venv` を読むだけで使った）と 0.174.0（`f7bf450`）の環境で、同じ GUI のコード（この作業場所）から 1 回ずつ実行し、応答の全体を項目ごとに比べた。14 の固定例のすべての時点で、全入口（プレイヤー0・1・観戦者・ホスト）の view・candidates と作成の知らせが同じ（`views_sha256` も同じ）。どの時点にも P6 の候補・`cost_evaluation` は出ない
- 各固定例の JSON の `compatibility` に 0.174.0 の確かめを追記した。記録を作ったエンジン（`engine_commit`・`engine_version`・`source`）・操作の列・`views_sha256` は書き換えていない。0.172.0 の完全な記録・スナップショットを、識別を書き換えて新しい版へ流用していない。再生する固定例（ピカチュウ・ばける・エナジートランス・フラッシュ）は、記録の操作の列を新しい対戦で再生した互換性の確かめで、旧記録の正式な再実行・復元ではない
- カード定義: 同梱データ `kyuura_engine/data/kyuura_cards.json` の導入物のバイト列は 0.172.0 と 0.174.0 で違う（0.174.0 の導入物は CRLF の改行 127,782 個。Windows での Git の取り出しによる）が、正規化した JSON の sha256（方式 `kyuura-gui canonical-json 1`）は同じ `b82354d6…`、件数は同じ 1,374。改行などのバイト列の差と内容の差を分けて扱う（`schema_version` 2 のとおり）

### 14.8 実行した検証（2026-11-09。限定）

作業場所だけで、変更に関係する対象を 1 回ずつ実行した（予算は実行の前に証跡の `PLAN.md` に記録: 合計 40 分以内。実際は約 4 分）。証跡は 14.9。

| 実行 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `2587ede` | 型検査 `npx tsc --noEmit` | 終了コード 0 |
| R2 | `2587ede` | `npm run build` | 終了コード 0 |
| R3 | `2587ede` | vitest **全件**（20 ファイル）。`validate.ts` の `kindStages` の変更（ほかの種類の段の `total_units`・`units`・`cost_evaluation` を止める）がすべての種類の入力の検証に効くので、全件を選んだ | 259 件・失敗 0・エラー 0・skip 0 |
| R4 | `2587ede` | pytest 7 ファイル（`test_contract`・`test_engine_source`・`test_bridge`・`test_card_definitions`・`test_scenarios`・`test_turn_basics`・`test_p6`） | 101 件・失敗 0・エラー 0・skip 0 |
| R5 | `2587ede` | e2e `p6.spec.ts` 3 件（構築盤面。接続層 8786・Vite 5186） | A・C 成功、**B 失敗**（120 秒の期限切れ。終了コード 1） |
| R5b | `cbac66b` | e2e `p6.spec.ts:42`（B だけ） | 1 件成功・終了コード 0 |
| R6 | `cbac66b` | 既存のおもてのにげるの e2e `turn-basics.spec.ts:92`（通常の new_game・seed 21。接続層 8787・Vite 5187） | 1 件成功・終了コード 0 |
| R7 | `cbac66b` | 型検査（R5b の修正が `e2e/` の型検査の範囲なので） | 終了コード 0 |

- R5 の B の失敗の原因: 構築盤面 B のトラッシュの段は 0〜1 枚で、画面は 1 つを選ぶ形（「選ばない」と radio）を出すが、テストが checkbox を選ぼうとしていた（テストの誤り。画面の挙動は正しい。失敗の画面の記録で確かめた）。`cbac66b` でテストの選び方だけを直し、失敗した B だけを再実行した。成功した A・C・ほかの対象は再実行していない（件数を数えるための再実行はしていない）
- 開発の途中に、同じテストを作りながら何度か実行した（記録していない・数えない）
- e2e の接続層と Vite は Playwright の `webServer`（`reuseExistingServer: false`）が起動・終了した。始める前と終わったあと、8786・5186・8787・5187 に TCP でつながらないことを確かめた。終わったあと、この作業場所・これらのポートの python・node のプロセスはなかった（一覧を読むだけ。ほかのプロセスを止める処理は使っていない）

### 14.9 証跡

- 保存先: `C:\dev\kyuura-engine-verification-gui-p6`（Git に入れない。既存の `kyuura-engine-verification-u7` とは別）。`verifier/runs/2026-11-09-p6/` に計画・導入の記録・固定例の比べの全体（ホストの view を含む）・構築盤面の出典の確かめ・各実行のコマンド・標準出力・標準エラー・終了コード・JUnit・失敗の画面の記録（外へ出さない）。`public/runs/2026-11-09-p6/summary.md` は中身を読んで秘密を含まないと確かめた集計だけ。`manifest.json` と `sha256.json`
- ハッシュは `MANIFEST.md` に書く（この文書のコミットのあとに作るので、ここには書かない）

### 14.10 未確認・次へ残すこと

- new_game からの通常の進行で P6 に届くか（構築盤面だけで確かめた）。こんらん（`confused`）・特殊エネルギー・2 枚以上のエネルギーのうらのにげる（模擬の応答の単体テストだけ）。preview（本番ビルドの e2e）・全体の e2e・接続層のテストの残り（R4 は 7 ファイル）・クリーンな場所での再構築は実行していない
- 既存の 0.172.0 の `.venv` から `npm run setup` での入れ替えそのものは確かめていない（新しい `.venv` で確かめた）
- 構築盤面はスナップショットを使わない（Python の版によらず作れる）が、盤面の組み立てはエンジンの状態の型（`kyuura_engine.state`）に依存する。エンジンを更新したら 14.6 の一致を確かめ直す
- 観察（判断していない）: 構築盤面 A で受理のあと、同じ番の候補にまた `retreat`（`supported`）が出た。1 つの番ににげる回数の扱いはエンジンの規則の範囲で、GUI は数えない。エンジンの側で確かめる事項として残す
  - 2026-11-13 の整理（21.4）: 確認済みの仕様。2000.02.14 版 p.311「「にげる」の宣言は、1回の自分の番の中で、何度でもすることができます。」と一致する。回数のほかの不整合の報告はなく、残件から外した（この観察の記録は残す）
- R-5 のほかの候補（入力を返さない候補）と R-2〜R-4 は変わらない

## 15. U-R3a（本人のうらのカードの、宣言の段が 2〜3 段の特殊能力。0.175.0・81e9e99 の文書・コードと実応答で確かめた）

基点は GUI の `1b7d8c7`（`feature/engine-p6-retreat-facedown`。P6 の追従と送る前の check の修正を含む。`origin/main` には入っていない）。作業場所は専用の worktree `C:\dev\kyuura-engine-gui-wt-r3a`（ブランチ `feature/engine-u-r3a-facedown-powers`）。読んだもの: エンジンの固定コミットの `legal_actions.py` の差分と `tests/test_legal_actions_u_r3a_v0_175.py`、U-R3a の文書 `docs/legal-actions-u-r3a-v0.175.md`（固定コミットのあとの文書だけのコミット `43debdd`。固定先は変えない）、検証用 AI の追従の文書 `docs/verification-ai-u-r3a.md`（`claude/vai-u-r3a-follow` の `62fff09`）。文書は手がかりとして読み、根拠は契約の表・エンジンのコード・実応答にした。エンジン・検証用 AI・renderer の木は読むだけ。

### 15.1 固定と依存の更新（0.174.0 → 0.175.0）

- `server/requirements.txt`・契約の表の `engine` を `81e9e99`（0.175.0）にした。`npm run setup` で新しい作業場所の新しい `.venv` に入れ、`direct_url.json` の `commit_id` が `81e9e99…`・`vcs` git・編集可能でない、配布メタデータとパッケージの版が 0.175.0、`kyuura_engine` が site-packages から読み込まれることを確かめた（証跡の `setup/engine_identity.json`）。既存の 0.174.0 の `.venv` からの入れ替えそのものは確かめていない
- `f7bf450` から `81e9e99` までの `kyuura_engine/` の差分は `legal_actions.py`（`_face_down_power_candidates` の 2〜3 段の分岐、`_face_down_staged_declaration`・`_face_down_power_paths`、段の組み立ての `_staged_power_candidate` への切り出し、`GUARANTEE_FACE_DOWN_POWER` と residual R-3 の `note` の文）と版の番号だけ。`client_api.py`・`engine.py`・`effects.py`・同梱のカードデータは変わっていない。契約の識別・形式の版は同じ
- renderer（`af88231`）・`package.json`・lockfile・カード定義の契約（`contract/kyuura-gui-card-definitions-v2.json`）は変えていない（setup のあとも差分なし）

### 15.2 入力契約（既存の形。新しい項目はない）

- 本人の候補の `use_power` で、`power.face_down`・`pokemon.face_down`（`pokemon` にカード ID なし）、`processability: unverified`・`reasons: [face_down_reveal_not_evaluated]`・`input_disclosure: confirmed`。段の role の並びは `effects.POWER_INPUT_STAGES` の宣言どおりで、契約の表の `power_stage_shapes` の中（ロケット団のヒトカゲ `[source, energy]`、フシギバナ `[source, energy, target]`）
- 2 段目以降は U7-5e と同じ `depends_on_stage`（直前の段）・`upstream_stages`（前のすべての段）・`options_by_choice`・選べるものの `after`。番号は前のすべての段の選び方ごとに別（フシギバナの 3 段目は (source, energy) の 4 組 × 自分の場の 3 匹 = 12）。うらのポケモン（自分自身）の選べるものは `face_down` でカード ID なし
- 1 段目に `note`（構造の組で、受け付けるかは確かめていない）。`note` はもともと `stage_keys` にある
- 組は構造だけ（タイプ・同じポケモン・回数で絞らない）。ついているカードのないポケモンは組が完成しないので 1 段目に出ない。完成する組が 1 つもなければ今までどおり入力を返さない（`unconfirmed`・residual R-3 の actor）
- GUI の変更: 契約の表の `$power` の説明（「うらは 0 段か 1 段だけ」）を直した。実行時の検証（`validate.ts` の `powerStages`・`chainedStages`・`powerOption`）はもともとうらかどうかで段の数を分けず、うらのポケモンの選べるものにカード ID があれば止めるので、変えていない。0.175.0 で段の組み立てが `_staged_power_candidate` に移ったので、契約のテスト（`test_power_shapes_match_engine`）が読む関数を直し、U-R3a の宣言の並び・`note`・`unverified` を照らすテスト（`test_face_down_staged_power_matches_engine`）を加えた

### 15.3 入力と表示（既存の扱いの再利用）

- 後の段は、今の上流の選び方の `options_by_choice` だけ（`DecisionPanel` の `stageOptions`）。別の経路の番号は選べない。上流を選ぶまで後の段は選べない
- 上流を変えたら、依存するすべての段（`downstreamOf`）の選択と check の答えを捨てる。2 段目を変えても 3 段目を捨てる
- 本人が知る本当のカード（`power.card_id`）は、盤面の情報（裏向きのポケモン・場所）と分けて「あなただけが知る本当のカード」として文字で示す（U7-5g-2 の `PowerInfo`。変えていない）。盤面の画像は裏面のまま
- 変えたのは、うらのカードの特殊能力の check の答えの文だけ:「エンジンの形の検査を通りました（段の数・番号・前の段との組だけ。特殊能力を使えること・受理・完走の保証ではありません。エンジンが送信のあとカードをおもてにしてから決めます）」。結果（使った・トラッシュ・拒否）は予告しない
  - 2026-11-13（21.3）: 最後の文がおもてになることの予告として読めるので、「…特殊能力を使えるか・受理されるか・処理が完了するかは保証しません。送信のあとエンジンが判定します）」に直した

### 15.4 送る前の check と保証の範囲

- `use_power` はもともと `check_before_submit_kinds` にある。送信のボタンと送信の入口が同じ `checkGatePassed`（今の主体・取っ手・候補・入力への check が通っている場合だけ）を使う。新しい門・状態は加えていない
- 入力を変えたら前の答えを捨て、元の入力に戻しても、変える前に始めた check の遅れた答えは使わない（`checkEpoch`）。閲覧者を切り替えると session ごと作り直す
- 入力非公開の候補・完成する入力がない候補は、選べるもの・検査の入口を出さず、送信の入口でも check が通らないので送らない。カード定義・`real` から入力を補わない
- エンジンの check（`_power_input_problem`）が確かめるのは段の数・番号・前の段との依存・型だけ。闘エネルギーの組（おもてにしたあと `WRONG_ENERGY_TYPE`）も valid。使えること・受理・完走の保証ではない

### 15.5 送信の結果と情報境界

| 例 | エンジンの結果 | GUI の表示（既存の構成のまま） |
|---|---|---|
| たね（ロケット団のヒトカゲ）・受け付ける組 | 受理。公開のログ `secret_plan_revealed` → `pokemon_power` → `move_energy` | 「受理: 特殊能力を使う」。観測でおもてのヒトカゲ（`PMCG4-012`）と移った炎エネルギー。画像は観測の `card_id` が来てから描く |
| たね・受け付けない組（闘エネルギー） | 拒否 `WRONG_ENERGY_TYPE`（`invalid_input`）。状態・乱数・ログがもどる | 「拒否（エンジン）」と診断は本人の画面だけ。盤面はうらのまま。自動で再送しない |
| たねでない（フシギバナ） | 受理。`secret_plan_revealed` → `secret_plan_discarded`（入力は読まれない） | 「受理: 特殊能力を使う」。観測でうらのポケモンがいなくなり、トラッシュに `PMCG1-011` |

- 受理の内訳を新しい結果の分類にしない。公開のログは client_api 形式 1 の応答にないので GUI は読まず、内訳は観測（場・トラッシュのカード）で伝わる。うらの数の変化だけで区別しない
- 取っ手: エンジンの契約では、受理で失効し（`CANDIDATES_STALE`）、拒否では失効しない。GUI の方針は別で、送信のあと（結果によらず）観測と候補を取り直し、取っ手が同じなら選択を残す。自動では送り直さない
- 相手・観戦者の候補・観測・更新に、候補・入力・能力の名前・`real`・本人向けの診断は出ない（接続層のテストで、本当のカードを変えた 2 つの盤面の他者への応答が同じことも確かめた）

### 15.6 構築盤面（テスト専用）

- new_game からの到達ではない。seed の探索はしていない。`server/tests/r3a_boards.py` に、エンジンのテストの `placed(real)`（`tests/test_secret_plan_v0_67.py` の `board`・`place`、`tests/helpers.py` の `build_test_state`）を写した: 自分のバトル場は闘エネルギー 2 枚のエビワラー、ベンチは炎・水エネルギーのコラッタ、マチスの秘策で `real` をうらにしてベンチへ（公開のコマンドだけ）。`check_invariants` が空で、うらのカードに何もついていない・決定待ちでないことを作るたびに確かめる
- P6 の構築盤面（14.6）の再利用: 初期の盤面の組み立て（`p6_boards._initial` にベンチと手札の追加の引数を足した。P6 の盤面は同じ）と、固定例の表への追加（`install_boards`）と起動の入口（`p6_server.main` に installer を渡せるようにし、`server/tests/r3a_server.py` が使う）を共用した。`web/playwright.config.ts` のテスト専用の入口は決まった 2 つの名前（`tests.p6_server`・`tests.r3a_server`）だけを受け付ける
- 出典との一致: エンジンの `tests/` を `git archive 81e9e99 tests` で作業ツリーの外に取り出し（エンジンの木は読むだけ）、U-R3a の 2 つの盤面（ロケット団のヒトカゲ `b72443e4…`・フシギバナ `c826f242…`）と、共用に変えた P6 の 3 つの盤面（`e349918b…`・`4b8214f0…`・`53983e9f…`。14.6 の値と同じ）で、`state_to_dict(format_version=22)` と乱数の指紋がエンジンの tests の盤面と同じことを確かめた（証跡の `board_provenance/compare.json`）
- 閉じ込め: 製品のコード（`kyuura_gui_server`）はこれらのモジュールを import しない。作成の口が受け取るのは固定例の名前だけで、任意の状態を受け取る口は加えていない。製品のコードもテストも実行時にエンジンの tests を読まない。公開のログの確かめは、接続層のテストの中だけで盤面の `ClientHub` を控え、導入したエンジンの `observation.visible_log`（相手・観戦者の見え方）で行った
- fixture の準備（構築盤面を作る・固定例の表に加える）と、画面からの操作（e2e で候補を選び、段を選び、check・送信する）は分けている。e2e が使う入力はどれも画面に出た選べるものから選んだ

### 15.7 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を、0.174.0（`f7bf450`。既存の作業場所 `kyuura-engine-gui-wt-p6` の `.venv` を読むだけで使った）と 0.175.0（`81e9e99`）の環境で、同じ GUI のコード（この作業場所）から 1 回ずつ実行し、応答の全体を項目ごとに比べた（14.7 と同じ手順）。14 の固定例の 15 の時点で、全入口の view と作成の知らせは同じ（`views_sha256` も同じ）。candidates の違いは 45 か所で、どれも `coverage.residual.classes` の R-3 の `note` の文（15 時点 × プレイヤー0・1・ホスト）。分類の値は同じで、GUI は `note` を文字列であることだけ確かめる。どの時点にもうらのカードの 2〜3 段の入力は出ない
- 各固定例の JSON の `compatibility` に 0.175.0 の確かめを追記した（違いの内容と理由を `candidates_difference` に書いた）。記録を作ったエンジン・操作の列・`views_sha256` は書き換えていない。0.174.0 の記録・スナップショットを識別を書き換えて流用していない。再生する固定例の確かめは記録の操作の列を新しい対戦で再生した互換性の確かめで、旧記録の正式な再実行・復元ではない
- うらのロケット団のヒトカゲの new_game の固定例（`face_down_power`。番 1 にマチスの秘策）は、自分の場にカードがついたポケモンがなく組が完成しないので、0.175.0 でも入力を返さない（`test_u7_5fg.py`・`u75fg.spec.ts` の説明を「組が完成しない場面」に直した。確かめの中身は変えていない）
- カード定義: 0.174.0 と 0.175.0 の導入物のバイト列は同じ（`8ac177e8…`、CRLF 127,782 個。どちらも Windows での Git の取り出しによる改行）。正規化した JSON の sha256 は `b82354d6…`、件数 1,374 で、14.7（0.172.0 の LF の導入物）とも同じ内容

### 15.8 実行した検証（2026-11-09。限定）

実行の前に対象と予算を記録した（証跡の `PLAN.md`）。開発中に新しいテストのファイルを手元で流したもの（記録の対象外）は別にしている。

| 記録 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `571dde7` | 型検査（`tsc --noEmit`） | 終了コード 1: `R3a.test.tsx` の型の誤り（`PowerRef` を `Raw` に変換）。テストのコードだけの誤り |
| R2 | `571dde7` | ビルド | 終了コード 1（ビルドの前の型検査で R1 と同じ誤り） |
| R3 | `571dde7` | vitest 11 ファイル（R3a・AppR3a・checkGate・P6・AppP6・U75e・AppU75e・U75fg・AppU75fg・DecisionPanel・validate） | 135 件、失敗 0（vitest は型を検査しない） |
| — | `11f845c` | R1 の原因の修正（テストのコードだけ） | — |
| R1b・R2b | `11f845c` | 型検査・ビルド（失敗した対象だけ） | 終了コード 0 |
| R3b | `11f845c` | vitest `R3a.test.tsx`（直したファイルだけ） | 17 件、失敗 0 |
| R4 | `11f845c` | pytest 9 ファイル（test_contract・test_engine_source・test_bridge・test_card_definitions・test_scenarios・test_u7_5e・test_u7_5fg・test_p6・test_r3a） | 112 件、失敗 0 |
| R5 | `11f845c` | e2e U-R3a 3 件（構築盤面。`tests.r3a_server`・8788/5188） | 3 件成功（1 回目） |
| R6 | `11f845c` | 既存の e2e 3 件（`u75e.spec.ts:24` おもての 2 段、`u75fg.spec.ts:136` うらの 0 段、`:163` 組が完成しない入力非公開。8789/5189） | 3 件成功 |
| R7 | `11f845c` | 既存の e2e P6 の A 1 件（`p6.spec.ts:32`。`tests.p6_server`・8790/5190。共用に変えた構築盤面の回帰） | 成功 |

- vitest を全件にしなかった理由: 検証（`validate.ts`）を変えておらず、`DecisionPanel` の変更はうらのカードの特殊能力の check の答えの文だけ。pytest も変更に関係するファイルだけ
- 専用ポートは実行の前後とも閉じていた。e2e の接続層と Vite は Playwright の webServer が起動・終了した（`reuseExistingServer: false`）。実行のあと、この作業場所を含むコマンド行のプロセスは 0（証跡の `runs/processes_after.json`）。ほかのプロセスを終了させる処理は使っていない
- 実行していないもの: 全体の e2e・vitest と pytest の全件・preview・エンジンの全体テスト・検証用 AI の実対戦・大量対戦・lockstep・状態の監査・クリーンな環境での全工程の再実行・seed の探索

### 15.9 証跡

- 保存先: `C:\dev\kyuura-engine-verification-gui-r3a`（P6 などの既存の記録とは別）。`verifier/runs/2026-11-09-r3a/` に計画・setup・固定例の比べ・盤面の出典の照合・各実行（コマンド・コミット・作業ツリーの状態・標準出力・標準エラー・終了コード・時刻・JUnit）、`public/runs/2026-11-09-r3a/summary.md` に確かめた非機密の集計だけ。`manifest.json`・`sha256.json`・`MANIFEST.md` を置いた
- 本人向けの情報（本人の候補・入力・観測の `real`）、比べた応答の全体、詳細の trace は verifier の側だけに置き、public には置かない

### 15.10 未確認・次へ残すこと

- new_game の通常の進行で 2〜3 段のうらの特殊能力に届くこと（構築盤面だけで確かめた。seed の探索はしていない）
- 7 つの型のうち確かめたのはロケット団のヒトカゲ（2 段）とフシギバナ（3 段）だけ。手札のカードを選ぶ段（`AttachEnergyFromHand` など）・相手の場を選ぶ段（`MoveOpponentDamageCounter`）、受理のあとに決定・コインがある型、`WRONG_ENERGY_TYPE` 以外の拒否（`SAME_POKEMON` など）は実エンジンで通していない
- 既存の 0.174.0 の `.venv` からの入れ替えそのもの、preview、クリーンな環境での再構築
- エンジンを更新するときは、U-R3a と P6 の構築盤面とエンジンの tests の盤面の一致を確かめ直す（README「エンジンの更新の手順」5）
- 残る R-3（完成する組がない場面・宣言のない型・登録のない力・知らない場所の段）、R-2・R-4・R-5 の残り、P6 で記録した「受理のあと同じ番にもう一度 retreat の候補が出る」観察（14.10）は変わっていない（着手していない）

## 16. PT-5e（山札から引いて試すトレーナーの使うための条件を候補で呼ぶ。0.176.0・6f62700 の文書・コードと実応答で確かめた）

基点は GUI の `8f78ed3`（`feature/engine-u-r3a-facedown-powers`。P6・U-R3a の追従と送る前の check の修正を含む公開コミット。`origin/main`（`088822c`）には入っていない）。作業は専用の作業場所 `C:\dev\kyuura-engine-gui-wt-pt5e`（ブランチ `feature/engine-pt5e-trainers`）で行った。利用者の作業ツリー・エンジンの木は変えていない。

### 16.1 固定と依存の更新（0.175.0 → 0.176.0）

- `server/requirements.txt`・契約の表の `engine` を `6f62700`（0.176.0）にした。`npm run setup` で新しい作業場所の新しい `.venv` に入れ、`direct_url.json` のコミットの一致・非 editable・配布メタデータとパッケージの版 0.176.0・site-packages からの読み込みを確かめた（`engine_source` も終了コード 0）
- `81e9e99` から `6f62700` までの `kyuura_engine/` の差分は `legal_actions.py`（`PLAYABLE_NOT_EVALUATED` を空にし、`PLAYABLE_FACE_UP_PREFIX_TRIALS` を加えた。`_use_condition_evaluated` が状態を受け取り、この 5 つの型はおもての山札の並びの不変条件（`faceup.prefix_problems`）が成り立つ状態だけで条件を呼ぶ。`GUARANTEE_TRAINER["preconditions"]` の文）と版の番号だけ。`client_api.py`・`engine.py`・`effects.py`・同梱のカードデータは変わっていない
- 読んだ文書: `docs/legal-actions-pt5e-audit.md`（監査）、`docs/implementation-status.md` の v0.175 のあとの節、`docs/legal-actions-u7-5-design.json` の PT-5e の行、テスト `tests/test_legal_actions_pt5e_v0_176.py`（実装の確かめ。エンジンの木から読むだけ）
- 契約の識別・形式の版は同じ。種類・段・処理可能性・理由・拒否のコードの語彙は増えていない（`test_contract.py` で照らす）

### 16.2 対象（実際の登録で確かめた）

| 型 | カード | 条件（エンジンの監査 1.1） |
|---|---|---|
| `BlainesHeightQuiz` | `GD5-016` カツラのクイズ その1 | 手札のポケモンがなければ QZ1（未裁定）。全部が図鑑番号・身長なしなら未対応。そのあと、おもての山札の確かめ |
| `SetAsideGuessKindQuiz` | `GD5-017` カツラのクイズ その2 | このカードを除く手札がなければ FC1（未裁定）。そのあと、おもての山札の確かめ |
| `BlainesQuiz` | `PMCG6-082` カツラのクイズ その3 | ワザを持つポケモンが手札になければ QZ1。そのあと、おもての山札の確かめ |
| `SetAsideGuessKindQuiz` | `neo4-105` ポケモン性格判定 | 手札に進化カードがなければ Illegal。そのあと、おもての山札の確かめ |
| `GuessOpponentPrizeKind` | `neo1-080` カードめくりゲーム | うらの相手のサイドがなければ FC1。そのあと、おもての山札の確かめ |
| `SwapPleaseTrainer` | `PR1-027` とりかえっこプリーズ | 自分のほかの手札・相手の手札が 0 枚なら Illegal。そのあと、おもての山札の確かめ |

接続層のテスト（`test_pt5e.py::test_registration_and_engine_constants`）が、導入したエンジンの登録から 5 つの型・6 枚を引いて確かめる（名前から推測しない）。

### 16.3 変化と区別

- 条件を通るカード: `may_stop_later`（理由 `preflight_not_evaluated`・`continuation_not_evaluated`。`eligible: true`）。候補にあること・check が通ること・送って受理されること・完走することは別。受理のあとは決定（置くカード・相手の答え・サイドの選択・交換するカード）に続き、結果は山札・サイドの秘密で正当に変わる
- ゲーム上使えないカード（Illegal）: 選べるものに出ない（手札にはある）
- 未裁定・未対応: 選べるものに `eligible: false`・`unresolved_ruling` または `not_implemented`（理由 `stops_before_acceptance`）。check・submit は送る前に `CANDIDATE_NOT_EXECUTABLE` で断る（エンジンへ渡さない。状態・相手と観戦者への更新は変わらない）
- おもての山札の並びの不変条件が成り立たない状態（構築盤面の入口から入りうる）・`effects.py` の外の条件: 今までどおり `unverified`（`use_condition_not_evaluated`）。その状態での送信の結果がエンジンの経路で分かれること（`STATE_INTEGRITY` の failed など）はエンジン側の独立の課題で、GUI は任意の状態を受け付ける機能・独自の状態の検査を持たない（加えていない）
- 保証文（`guarantees.preconditions`）が変わった。GUI は候補の一覧の「保証の範囲」に文字のまま表示するだけで、合法性・送れるかの条件に使わない（`PT5e.test.tsx` で文を変えても選べるものの可否が同じことを確かめた）

### 16.4 GUI の扱い（製品のコードは変えていない）

- 実行時検証（`validate.ts`）・入力の表示（`DecisionPanel.tsx`）・送る前の check の門（`checkGate.ts`）は既存のまま扱える。変えたのは依存・契約の表の `engine` と `$u7_5_kinds` の説明・版の確かめのテスト・契約のテスト（`_trainer_candidate` が状態を渡して条件を呼ぶかを決めること、処理可能性・理由が既存の語彙だけであること）
- 表示: `may_stop_later` は「送れる（後で止まりうる）」と理由。受理・完走・使えることを予告しない。`not_implemented`・`unresolved_ruling` は選べず、「未実装」「未裁定」と「ゲーム上の禁止ではありません」。選べるものにないカードを手札・カード定義から補わない
- 送信: 今の入力・今の取っ手への check が通ったときだけ（ボタンと送信の入口が同じ条件）。入力・候補を変えたら前の答えを使わない。エンジンの拒否の診断は送った本人だけ。自動で送り直さない（既存のテスト `checkGate.test.tsx`・`U75.test.tsx`・`AppU75.test.tsx` と今回の `PT5e.test.tsx`）

### 16.5 代表応答

エンジンの tests の `table` と同じ盤面（16.6）で client_api の candidates・inputs・check の実応答を取り（証跡の `probe/pt5e_responses.json`）、エンジンのテストの期待（`PASSING`・`STOPPED`・選べるものにない・`CANDIDATE_NOT_EXECUTABLE`）と同じことを確かめた。単体テストの写し（`web/src/test/pt5e.ts`）はこの応答をそのまま使う。

| 盤面 | 手札（プレイヤー 0） | 候補 | 選べるもの |
|---|---|---|---|
| 1 | その2・性格判定・その1・ポリゴン（`ES1-033`。図鑑番号なし） | `may_stop_later` | `o1` その2 `may_stop_later`、`o2` その1 `not_implemented`（性格判定はない） |
| 2 | その3・とりかえっこプリーズ・マサキ（相手の手札なし） | `may_stop_later` | `o1` その3 `unresolved_ruling`、`o2` マサキ `may_stop_later`（とりかえっこプリーズはない） |

### 16.6 構築盤面（テスト専用）

- new_game からの到達ではない。seed の探索はしていない。固定例のデッキに 6 枚はない。`server/tests/pt5e_boards.py` に、エンジンのテストの `table(card, hand=..., opponent_hand=..., flash=False)`（`tests/helpers.py` の `build_test_state`）の形を写した。手札の組み合わせは GUI の側で決めた（エンジンのテストの `ControlTest`・`SameAsDirectTest` の 1 枚ずつの例を 1 つの手札にまとめた）。おもての山札はなく、不変条件の崩れた状態は作らない
- 固定例の表への追加（`p6_boards.install_boards`）と起動の入口（`p6_server.main`）を共用した（`server/tests/pt5e_server.py`）。`web/playwright.config.ts` のテスト専用の入口は決まった 3 つの名前（`tests.p6_server`・`tests.r3a_server`・`tests.pt5e_server`）だけ
- 出典との一致: エンジンの `tests/` を `git archive 6f62700 tests` で作業ツリーの外に取り出し（エンジンの木は読むだけ）、PT-5e の 2 つの盤面（`64cc8d98…`・`55f8f08e…`）と、P6 の 3 つ（`e349918b…`・`4b8214f0…`・`53983e9f…`）・U-R3a の 2 つ（`b72443e4…`・`c826f242…`。14.6・15.6 の値と同じ）で、`state_to_dict(format_version=22)` と乱数の指紋がエンジンの tests の盤面と同じことを確かめた（7 つとも一致。定数も一致）
- 閉じ込め: 製品のコード（`kyuura_gui_server`）はこれらのモジュールを import しない。作成の口が受け取るのは固定例の名前だけで、任意の状態を受け取る口は加えていない。製品のコードもテストも実行時にエンジンの tests を読まない

### 16.7 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を、0.175.0（`81e9e99`。既存の作業場所 `kyuura-engine-gui-wt-r3a` の `.venv` を読むだけで使った）と 0.176.0（`6f62700`）の環境で、同じ GUI のコード（この作業場所）から 1 回ずつ実行し、応答の全体を項目ごとに比べた（15.7 と同じ手順）。14 の固定例の 15 の時点で、全入口の view・candidates と作成の知らせはすべて同じ（`views_sha256` も同じ）。違いは比べた出力の外側の `engine_version` だけ
- 保証文だけの差・候補や入力の差は、どちらもない。どの時点にも `play_trainer` の候補がなく（固定例のデッキに 6 枚もない）、変わった保証文は応答に出ない。差を除外して同じにしたのではない
- 各固定例の JSON の `compatibility` に 0.176.0 の確かめを追記した（`candidates_difference` に PT-5e の選べるもの・保証文・その他を分けて書いた）。記録を作ったエンジン・操作の列・`views_sha256` は書き換えていない。0.175.0 の記録・スナップショットを識別を書き換えて流用していない。再生する固定例の確かめは記録の操作の列を新しい対戦で再生した互換性の確かめで、旧記録の正式な再実行・復元ではない
- カード定義: 0.175.0 と 0.176.0 の導入物のバイト列は同じ（`8ac177e8…`、CRLF 127,782 個。Windows での Git の取り出しによる改行）。正規化した JSON の sha256 は `b82354d6…`、件数 1,374 で同じ

### 16.8 実行した検証（2026-11-10。限定）

実行の前に対象・比べる基準・予算を記録した（証跡の `PLAN.md`）。開発中に新しいテストのファイルを手元で流したもの（記録の対象外）は別にしている。

| 記録 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1・R2 | `10a4879` | 型検査・ビルド | 終了コード 0 |
| R3 | `10a4879` | vitest 6 ファイル（PT5e・U75・AppU75・checkGate・DecisionPanel・validate） | 64 件、失敗 0 |
| R4 | `10a4879` | pytest 7 ファイル（test_contract・test_engine_source・test_bridge・test_card_definitions・test_scenarios・test_u7_5・test_pt5e） | 104 件、失敗 0 |
| R5 | `10a4879` | `python -m kyuura_gui_server.engine_source` | 終了コード 0（`6f62700`・0.176.0・site-packages） |
| R6 | `10a4879` | e2e PT-5e 1 件（構築盤面 1。`tests.pt5e_server`・8791/5191） | **失敗**: テストのコードの誤り（選べるものの行を探す `filter({ has })` に絶対の locator を渡した）。失敗のときの画面の記録では、その2 は「送れる（後で止まりうる）」、その1 は無効で「エンジンが未対応です（ゲーム上の禁止ではありません）」、性格判定はなく、画面は期待どおりだった |
| — | `bbb6c07` | R6 の原因の修正（テストのコードだけ） | — |
| R6b | `bbb6c07` | e2e PT-5e 1 件（失敗した対象だけ） | 成功 |
| R7 | `bbb6c07` | 既存のトレーナーの e2e 1 件（`u75.spec.ts:104` ピッピ人形。通常の入口・8792/5192） | 成功 |

- 全件にしなかった理由: 新しい語彙がなく、製品のコードを変えていない。`unverified` のトレーナーの既存の表示は模擬の応答の単体テスト（`U75.test.tsx`）で確かめた（不変条件の崩れた状態は製品の API へ入れない）
- 専用ポートは実行の前後とも閉じていた。e2e の接続層と Vite は Playwright の webServer が起動・終了した（`reuseExistingServer: false`）。実行のあと、この作業場所を含むコマンド行のプロセスは 0。ほかのプロセスを終了させる処理は使っていない
- 実行していないもの: 全体の e2e・vitest と pytest の全件・preview・エンジンの全体テスト・検証用 AI の実対戦・大量対戦・lockstep・状態の監査・クリーンな環境での全工程の再実行・seed の探索・新しい new_game の固定例

### 16.9 証跡

- 保存先: `C:\dev\kyuura-engine-verification-gui-pt5e`（既存の記録とは別）。`verifier/runs/2026-11-10-pt5e/` に計画・setup・固定例の比べ・盤面の出典の照合・代表応答・各実行（コマンド・コミット・作業ツリーの状態・標準出力・標準エラー・終了コード・時刻・JUnit）、`public/runs/2026-11-10-pt5e/summary.md` に確かめた非機密の集計だけ。`manifest.json`・`sha256.json`・`MANIFEST.md` を置いた
- 本人向けの情報（本人の候補・入力・手札）、比べた応答の全体、詳細の trace は verifier の側だけに置き、public には置かない

### 16.10 未確認・次へ残すこと

- new_game の通常の進行で 6 枚に届くこと（構築盤面だけで確かめた。seed の探索はしていない）
- 実エンジンで通した状況は、その2（通る・受理）・その1（未対応）・その3（未裁定）・性格判定ととりかえっこプリーズ（Illegal で出ない）だけ。カードめくりゲーム・おもての山札がある場面（FU3）・受理のあとの決定の続き・エンジンの `rejected`（受け付ける前の先読みでの拒否）は実エンジンの画面で通していない
- おもての山札の並びの不変条件が崩れた状態（エンジンの独立の課題。GUI は扱わない）
- 既存の 0.175.0 の `.venv` からの入れ替えそのもの、preview、クリーンな環境での再構築
- エンジンを更新するときは、PT-5e・U-R3a・P6 の構築盤面とエンジンの tests の盤面の一致を確かめ直す（README「エンジンの更新の手順」5）
- 残る R-3・R-2・R-4・R-5、P6 で記録した「受理のあと同じ番にもう一度 retreat の候補が出る」観察（14.10）は変わっていない（着手していない）

## 17. 構築した状態の入口の確かめ（PT5E-FROM-STATE-INVARIANT。0.177.0・01317a6 の文書・コードと実際の接続層で確かめた）

基点は GUI の `dbb6456`（`feature/engine-pt5e-trainers`。PT-5e・P6・U-R3a の追従と送る前の check の修正を含む公開コミット。`origin/main`（`088822c`）には入っていない）。作業ブランチは `feature/engine-0177-from-state`（専用の worktree）。エンジン・AI・renderer は読むだけ。

### 17.1 固定と依存の更新（0.176.0 → 0.177.0）

- `server/requirements.txt`・契約の表の `engine` を `01317a6`（0.177.0。公開ブランチ `claude/pt5e-from-state-fix` の「版を 0.177.0 にする」）にした。`npm run setup` で新しい作業場所の新しい `.venv` に入れ、`direct_url.json` のコミットの一致・編集可能でないこと・配布メタデータとパッケージの版（0.177.0）・site-packages からの読み込みを確かめた（`engine_source` と `test_contract.py::test_engine_identity`）
- `6f62700` から `01317a6` までの `kyuura_engine/` の差分は `adapter.py`（`checked_state_copy`・`UnusableStateError`・コードの定数・`HostedGame` の docstring）、`client_api.py`・`legal_actions.py`（`from_state` が `checked_state_copy` を呼ぶ。import とコメント）、版だけ。読んだ文書: エンジンの `docs/pt5e-from-state-invariant-audit.md`（監査と計画）、`docs/implementation-status.md` の v0.177 の節、テスト `tests/test_from_state_integrity_v0_177.py`・`tests/test_legal_actions_pt5e_v0_176.py` の差分
- 契約の識別・形式の版、要求・応答の JSON の形、処理可能性・理由・拒否のコードの語彙は同じ。契約の表は `engine` と `$comment` の説明だけを変えた
- renderer（`af88231`）・`package.json`・lockfile・カード定義の契約は変えていない

### 17.2 エンジンの変化（入口の契約）

- `ClientHub.from_state`・`ActionHost.from_state` は共通の `adapter.checked_state_copy` を呼ぶ: 型（`GameState` そのもの。違えば `TypeError`）→ 複製 → 複製の `check_invariants`。問題があれば `UnusableStateError`（`code` が `STATE_INTEGRITY`、`problems` に問題の文）。複製・確かめの途中の `Exception` は `STATE_CHECK_ERROR`（元の例外は `__cause__`）。`MemoryError` は投げ直し、`KeyboardInterrupt`・`SystemExit` は捕まえない（通常の入力の拒否として扱わない）
- 拒否は hub・ホスト・セッション・取っ手を作る前。渡した状態は変えない
- `UnusableStateError` は `ValueError` の子（`EngineError` の子ではない。処理の途中の不整合 `StateIntegrityError` とは別の型）。`str()` は `code` ごとの決まった文。`problems`（カードの番号・ゾーン・持ち主が入る）と `__cause__` はホスト・検証者だけが読む
- 信頼された内部の直接の組み立て（`HostedGame(state)`・`ClientHub(game)`・`ActionHost(game)`）は今までどおり確かめない
- **受け付ける状態**: 不変条件を満たす `GameState`。受け付けても、合法な対戦から到達できる保証ではない。規約集合・決定の再開先・効果の登録・カードデータ・乱数の確かめは今回の変更に入っていない（規約集合・決定の再開先はコマンドごとに処理の前に確かめる既存のまま）
- 旧版の記録・snapshot は、識別を書き換えて流用しない（GUI は snapshot を使わない。固定例は記録の操作の列を新しい版で再生して比べる）

### 17.3 GUI の入口と製品のコードの要否（変えていない）

| 経路 | エンジンの入口 | 0.177.0 での扱い |
|---|---|---|
| 新しい対戦（`mode: "decks"`） | `ClientHub.start` | `from_state` を使わない。変化なし |
| 固定例のうち new_game から始めるもの（`point: "start"`） | `ClientHub.start` | 同上 |
| 固定例のうち再生するもの | 公開の `new_game`・`apply_command`（各コマンドの終わりで不変条件を確かめる）→ `ClientHub.from_state` | 入口の確かめを通る（17.6） |
| テスト専用の構築盤面（P6 3・U-R3a 2・PT-5e 2） | `ClientHub.from_state`（作るたびに `check_invariants` が空であることも確かめる） | 入口の確かめを通る（17.6）。内部の組み立てへ移していない |

- 作成の口は任意の状態を受け取らない（デッキと規約集合、または名前の決まった固定例だけ）。GUI に状態の検査を二重に作らない（不変条件はエンジンだけが確かめる）
- 拒否の例外は、接続層の既存の middleware（`app.py` の `guard`）が `GUI_INTERNAL_ERROR`（500・決まった文）にし、ホストのログ（`log.exception`）にだけ残す。固定例の作成の前に例外になるので、`registry.replace` を呼ばず、対戦を作らない（前の対戦はそのまま。`GUI_SCENARIO_UNAVAILABLE` の既存の扱いと同じ）。新しい画面の表示・エラーの形は要らない
- そのため製品のコード（`server/kyuura_gui_server`・`web/src`）は変えていない。変えたのは依存・契約の表の `engine`・版のテスト・固定例の来歴の追記・テスト・文書

### 17.4 例外の公開の範囲（接続層のテスト `server/tests/test_from_state.py`）

`str()` が決まった文であることだけを根拠にせず、HTTP の応答の全体を確かめた。

| 対象 | プレイヤー（ブラウザ）向けの応答 | ホスト向けのログ・検証の証跡 |
|---|---|---|
| `problems`（カードの番号・ゾーン） | 出ない（応答の全体が `{"gui_server":1,"ok":false,"error":{"code":"GUI_INTERNAL_ERROR","message":…}}` と一致。問題の文のどれも含まない） | 例外のオブジェクトにある（ログの文には `str()` の決まった文と traceback。`problems` の文は書かれない） |
| `__cause__`（確かめの途中の例外） | 出ない（原因の文に入れた印 `SECRET-CAUSE …` を含まない） | ログの traceback に原因の例外の連鎖が出る（ホストだけ） |
| traceback・例外の型・`code`・エンジンの決まった文 | 出ない（`Traceback`・`UnusableStateError`・`RuntimeError`・`STATE_INTEGRITY`・`STATE_CHECK_ERROR`・エンジンの文を含まない） | ログに出る |
| 対戦・入口 | 新しい hub・入口・取っ手はない（応答に `match` がない）。前の対戦が今の対戦のまま、その入口が使える | — |

- 不整合な状態はテストの中だけで作る（PT-5e の構築盤面 1 の山札の 1 枚目を手札にも置く。カードが 2 か所にある）。確かめの途中の例外は、テストの中だけでエンジンの `adapter.check_invariants` を差し替えて作る。どちらも名前の決まった盤面としてテストの中だけで固定例の表に加える（`p6_boards.install_boards`）。製品の API に任意の状態を受け付ける機能は加えていない。エンジンの tests は import しない
- 正常な診断の表示（デッキの診断・エンジンの拒否の診断を送った本人へ）は変えていない（`test_bridge.py`・既存の固定例のテストが通る）

### 17.5 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を 0.176.0（`6f62700`。既存の作業場所 `kyuura-engine-gui-wt-pt5e` の `.venv` を読むだけ）と 0.177.0 の環境で実行し、項目ごとに比べた。14 の固定例・15 の時点で、全入口の view・candidates・作成の知らせはすべて同じ。違いは比べた出力の外側の `engine_version` の 1 か所だけ（版・識別の差。ゲームの応答の差はない）。`views_sha256` の要約も 15 時点すべて同じ
- 固定例の JSON の `compatibility` に 0.177.0 の確かめを追記した（元の来歴・`engine_commit` は変えていない。CRLF・字下げを保ち、各ファイル 11 行の追加だけ）。再生は記録の操作の列を新しい版の対戦で再生した互換性の確かめで、旧記録の正式な再実行・復元ではない
- カード定義: 正規化した sha256 `b82354d6…`・1,374 件で同じ。導入物のバイト列（`8ac177e8…`・CRLF 127,782）も同じ

### 17.6 構築盤面（テスト専用）

- 7 つの構築盤面（PT-5e 2・P6 3・U-R3a 2）を、0.177.0 の `ClientHub.from_state`・`ActionHost.from_state` の両方がすべて受け付けた（拒否はなし。個別の調査は要らなかった）
- 01317a6 のエンジンの tests（読むだけ。scratchpad へ書き出した）の盤面と、状態の書き出し・乱数の指紋がすべて同じ（PT-5e の `table` は 0.177.0 で変わっていない。変わったのはテストの `queries` が崩れた状態で内部の組み立てを使う点だけ）。盤面の `SOURCE`（写した元のコミット）は変えていない
- 接続層のテスト `test_p6.py`・`test_r3a.py`・`test_pt5e.py` が 0.177.0 の入口を通して通る（17.7 の R3）

### 17.7 実行した検証（2026-11-10。限定）

計画（対象・比べる基準・予算）は実行の前に保存した。記録した実行は各 1 回で、失敗はなかった。

| 記録 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `86e5bcb` | 型検査（`npm run typecheck`） | 終了コード 0 |
| R2 | `86e5bcb` | ビルド（`npm run build`） | 終了コード 0 |
| R3 | `86e5bcb` | 接続層（pytest）: `test_contract`・`test_engine_source`・`test_bridge`（new_game の作成と既存の操作）・`test_card_definitions`・`test_scenarios`（固定例 14）・`test_p6`・`test_r3a`・`test_pt5e`（構築盤面 7）・`test_from_state`（新） | 111 件成功・失敗 0（JUnit） |
| R4 | `86e5bcb` | 導入元の要約（`python -m kyuura_gui_server.engine_source`） | 終了コード 0（git・`01317a6`・0.177.0・site-packages） |

- 記録の前に開発中に手元で流したもの（`test_from_state` と `test_contract`・`test_card_definitions`・`test_scenarios`）は記録の対象外
- 画面のコードを変えていないので、フロントの単体テスト・ブラウザ確認は流していない
- サーバーは起動していない（TestClient）。ポートは使っていない
- 実行のときの作業ツリーの差分は README（この文書と同じコミットに入れた文書の変更）だけ

### 17.8 証跡

GUI のリポジトリの外の `C:\dev\kyuura-engine-verification-gui-0177`（既存の証跡とは別）。非公開の `verifier/`（計画・導入の記録・固定例の新旧の応答の全体・カード定義の比べ・構築盤面の照合と入口の受け付け・各実行の記録と JUnit）と、非機密の集計だけの `public/`。`MANIFEST.md`・`manifest.json`・`sha256.json`。

### 17.9 未確認・次へ残すこと

- 0.176.0 の `.venv` からの入れ替えそのもの（新しい作業場所の新しい `.venv` で確かめた）
- `ActionHost.from_state` の HTTP の経路（GUI は使わない。エンジンの入口としては 17.6 で直接確かめた）・型の違う値の HTTP の経路（作成の口は状態を受け取らないので届かない）
- 確かめの途中の例外のうち、エンジンの本当の不具合で起きるもの（テストでは差し替えで作った）
- フロントの単体テストの全件・e2e・preview・エンジンの全体テスト・クリーンな環境での全工程
- 1〜16 章の確かめを `01317a6` でやり直していない（固定例・構築盤面・選んだ接続層のテストだけ）
- エンジン側: 規約集合・決定の再開先の入口での確かめ（エンジンの監査の 7 章で採否の判断）、信頼された内部の組み立てからの崩れた状態（PT-5e の候補の側のガードが残る）

## 18. 相手のうらのカードを読む特殊能力の候補（UP-5t-C1。0.178.0・8f5329d の文書・コードと実応答で確かめた）

基点は GUI の `0412561`（`feature/engine-0177-from-state`。from_state・PT-5e・P6・U-R3a の追従と送る前の check の修正を含む公開コミット。`origin/main`（`088822c`）には入っていない）。作業ブランチは `feature/engine-0178-up5t-c1`（専用の worktree）。エンジン・AI・renderer は読むだけ。

### 18.1 固定と依存の更新（0.177.0 → 0.178.0）

- `server/requirements.txt`・契約の表の `engine` を `8f5329d`（0.178.0。公開ブランチ `claude/up5t-c1` の「版を 0.178.0 にする」。エンジンの作業で配布物の検査と Git の URL からの通常のインストールを確かめたコミット）にした。後続の文書だけのコミット（`7ef45be`）・検証用 AI の追従（`claude/vai-0178-follow` の `ad2bd43`）へは追従しない
- `npm run setup` で新しい作業場所の新しい `.venv` に入れ、`direct_url.json` のコミットの一致（`vcs_info.commit_id` `8f5329d…`・`requested_revision` も同じ）・編集可能でないこと（`dir_info` なし）・配布メタデータとパッケージの版（0.178.0）・site-packages からの読み込みを確かめた（`engine_source` と `test_contract.py::test_engine_identity`）。lockfile・`package.json` は変わっていない
- `01317a6` から `8f5329d` までの `kyuura_engine/` の差分は `legal_actions.py`（候補の側だけ）と版（`__init__.py`・`pyproject.toml`）だけ。コマンドの処理・効果・裁定のファイルに差はない。読んだ文書: エンジンの `docs/legal-actions-up5t-audit.md` 11 章、`docs/implementation-status.md` の v0.178 の節、検証用 AI の `docs/verification-ai-v0178-follow.md`
- 契約の識別・形式の版、要求・応答の JSON の形、処理可能性・理由・拒否のコードの語彙は同じ。契約の表は `engine` と `$comment` の説明だけを変えた。renderer（`af88231`）・カード定義の契約は変えていない

### 18.2 エンジンの変化（候補の契約）

- `legal_actions._power_verdict`: 特殊能力の候補の確かめ（`check_use_pokemon_power` を状態の複製の上で試す）を、新しい空の `zones.IDENTITY_CONSULTED` のもとで呼ぶ。相手のうらのカードの本当のカードを使ったと記録されたら、受け付ける・拒否・停止のどれでも結果を使わず `unverified`（`face_down_reveal_not_evaluated`）。記録が付くかは公開の値（うらのカードの場所・処理の順）だけで決まる。自分のうらのカード（本人の知識）は数えない
- 確認された秘密依存の判定を候補の側で採用しない補強。エンジンの修正の前の構築盤面でも外へ出る応答の差は再現していない（情報漏れを再現して直したものではない）
- 対象の例: わるいクサイハナ［くさいかふん］（`PMCG4-006`）・スリープ［えんかくさいみん］（`PMCG4-033`）。相手のバトル場がうらのとき `unverified`・入力なし（`no_input`・段なし・`choices_format` `[]`）。おもてなら `may_stop_later`（`continuation_not_evaluated`）。公開の条件で使えない（使う人がこんらん）なら候補に出ない
- `use_power` の `guarantees.preconditions` に 1 文（「v0.178: 確かめが相手のうらのカードの本当のカードを使ったら（状態の複製の上の試行でおもてにした）、その結果を使わない（unverified）」）が加わった
- 送信のときの処理（受け付けるかは本当のカードによらない `_identity_independent`）・裁定は変わっていない

### 18.3 GUI の扱いと製品のコードの要否

| 項目 | 既存の扱い | 0.178.0 での確かめ |
|---|---|---|
| `unverified` の表示 | 「未確認」と説明（保証はない。送れるが使えるかは送るまで分からない） | 実応答で表示（単体・e2e） |
| 理由 `face_down_reveal_not_evaluated` | `REASON_LABELS` の文 | **文を直した**（下） |
| `may_stop_later`（おもての対照） | 「送れる（後で止まりうる）」。受理・完走の保証として書かない | 実応答で表示（単体・e2e） |
| 入力なしの候補 | 「この操作に入力はありません」。`use_power` は `check_before_submit_kinds` にあるので `choices: []` への今の check が通ってから送る | 単体・画面全体・e2e |
| 古い check | 選択（取っ手・候補）ごとに作り直し、入力の鍵が違えば使わない。閲覧者ごとに session を作り直す（遅れた答えも置かない） | 画面全体（閲覧者の切り替え・候補の選び直し） |
| 保証文 | 候補の一覧の details に表示するだけ | 文を変えても送れるかが同じ（単体） |
| 使う人のポケモンの表示 | おもての特殊能力の表示（`PowerInfo`。本人のうらのカードの特殊能力の表示は使わない） | 単体 |
| 表示だけ・入力非公開・実行できない区分 | 送れない（既存） | 既存のテスト（R3a・U75fg・PT5e）が通る |
| 拒否の診断 | 送った本人だけ・自動で再送しない | 画面全体 |

- **製品のコードの変更は 1 か所だけ**: `web/src/labels.ts` の `REASON_LABELS.face_down_reveal_not_evaluated` の文を「うらのカードの本当のカードでは確かめていない（エンジンがおもてにしてから確かめる）」から「うらのカードの本当のカードでは確かめていない（使えるか・どうなるかは送信のあとエンジンが決める）」にした。理由: 0.178.0 からこの理由は相手のうらのカードについても付き、前の文は「おもてになる」予告として読める（エンジンの `REASON_FACE_DOWN` のコメントは自分のうらのカードを前提に書かれていた）。実際には、送信のときに受け付けるかは本当のカードによらず決まり、相手のカードがおもてになるかは効果の結果による。新しい文は自分のうらのカード（P6・U-R3a・R-3）にも当てはまる。表示の文だけで、判定・カード別の分岐・送信の制御・合法性の検査は加えていない
- そのほかは既存の検証・表示・checkGate で扱え、変えていない

### 18.4 情報境界

- 相手のバトル場がうらのとき、使う人・観戦者の観測には `face_down` と場所だけがあり（`real` はない）、GUI は「裏向きのポケモン」と表示する。本当のカードの ID・名前・画像をカード定義から補わない（カード定義に本当のカードがあっても表示しない・描かないことを画面全体のテストで確かめた）
- 使う前に、おもてになるか・残るか・効果が起こるかを予告しない（入力の画面・check の答えの文で確かめた）
- 使う人の候補・入力・検査・診断は相手・観戦者の画面に出ない。相手本人の画面には、本人の知識（観測の `real`）として本当のカードが出る（全員の知識が同じではない）
- 受理のあとの公開・状態の変化は、エンジンの観測のとおりに表示する（e2e は受理のあとの見え方を予告して比べない）

### 18.5 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を 0.177.0（`01317a6`。既存の作業場所 `kyuura-engine-gui-wt-0177` の `.venv` を読むだけ。`direct_url` が `01317a6` であることを先に確かめた）と 0.178.0 の環境で実行し、項目ごとに比べて違いを分類した（差を無条件に除かない）
- 14 の固定例・15 の時点で、全入口の view と作成の知らせはすべて同じ。違いは 2 か所: 比べた出力の外側の `engine_version`（版の文字列）と、`energy_trans` の時点のプレイヤー0 のエナジートランスの `use_power` の候補 1 つの `guarantees.preconditions`（0.177.0 の文に上の 1 文が加わった。新しい文は旧い文で始まる）。処理可能性・理由・入力の公開・段・選べるものの差は 0。ガードが働く候補（相手のバトル場がうらで［くさいかふん］・［えんかくさいみん］を使える時点）は固定例にない
- `views_sha256` の要約（views だけ）も 15 時点すべて同じ（候補の要約は energy_trans だけが保証文の差で違う。固定例の JSON の `views_sha256` は views だけなので入れ直していない）
- 固定例の JSON の `compatibility` に 0.178.0 の確かめを追記した（元の来歴・`engine_commit` は変えていない。CRLF・字下げを保ち、各ファイル 12 行の追加だけ。energy_trans は保証文の差を `candidates_difference` に書いた）。再生は記録の操作の列を新しい版の対戦で再生した互換性の確かめで、旧記録の正式な再実行・復元ではない
- カード定義: 正規化した sha256 `b82354d6…`・1,374 件で同じ。導入物のバイト列は違う（0.177.0 の導入物は CRLF 127,782・3,846,586 バイト、0.178.0 の導入物は CRLF 0・3,718,804 バイト。差はちょうど CRLF の数で、導入のときの改行の違い。内容は同じ）

### 18.6 構築盤面（テスト専用）

- 新しい構築盤面 `server/tests/up5t_boards.py`: 2 能力 × うら 3（コラッタ・ユンゲラー・メタモン）、おもての対照 2、こんらん 2 の 10 盤面。名前は結果を予告しない。製品のコードは import しない。`p6_boards.install_boards` で名前の決まった盤面だけを固定例の表に加える。e2e のテスト専用の入口 `server/tests/up5t_server.py`（`web/playwright.config.ts` の決まった名前の一覧に `tests.up5t_server` を加えた）
- 8f5329d のエンジンの tests（読むだけ。`git archive` で scratchpad へ書き出した）の `opponent_face_down`・`opponent_face_up` の盤面と、状態の書き出し・乱数の指紋が 10 盤面すべて同じ。既存の 7 盤面（PT-5e 2・P6 3・U-R3a 2）も同じ。17 盤面すべてを 0.178.0 の `ClientHub.from_state` が受け付けた

### 18.7 実行した検証（2026-11-10。限定）

計画（対象・比べる基準・予算）は実行の前に保存した。

| 記録 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `8d09e2e` | 型検査（`npm run typecheck`） | 終了コード 0 |
| R2 | `8d09e2e` | ビルド（`npm run build`） | 終了コード 0 |
| R3 | `8d09e2e` | フロントの単体（vitest。変更に関係する 13 ファイル: 新しい `UP5tC1`・`AppUP5tC1`、`R3a`・`AppR3a`・`P6`・`AppP6`・`PT5e`・`U75e`・`AppU75e`・`U75fg`・`DecisionPanel`・`checkGate`・`validate`） | 150 件成功・失敗 0（JUnit） |
| R4 | `8d09e2e` | 接続層（pytest）: `test_contract`・`test_engine_source`・`test_bridge`・`test_card_definitions`・`test_scenarios`（固定例 14）・`test_p6`・`test_r3a`・`test_pt5e`・`test_from_state`・`test_u7_5e`・`test_up5t_c1`（新） | 120 件成功・失敗 0（JUnit） |
| R5 | `8d09e2e` | 導入元の要約（`python -m kyuura_gui_server.engine_source`） | 終了コード 0（git・`8f5329d`・0.178.0・site-packages） |
| R6 | `8d09e2e` | e2e 1 件（`e2e/up5t-c1.spec.ts`。テスト専用の入口 `tests.up5t_server`） | 1 件成功（JUnit） |
| R7 | `8d09e2e` | 既存の特殊能力の e2e 1 件（`e2e/u-r3a.spec.ts` の「コラッタ → 炎エネルギーで送る → 受理」。理由の文を変えた本人のうらのカードの経路） | 1 件成功（JUnit） |

- 1 回目の記録の試み（R1〜R5）は無効: 記録のスクリプトの `cmd` がこの環境の PATH で msys2 の別のプログラムに解決され、コマンドが実行されなかった（出力 0 バイト・0.1 秒）。消さずに証跡の `runs/invalid-attempt-1/` に理由とともに残し、`cmd.exe` を明示して R1〜R5 を取り直した。テストの失敗ではない
- 記録の前に開発中に手元で流したもの（新しい接続層のテスト・新しい単体テストの 2 ファイル・型検査）は記録の対象外。開発中の単体テストの 1 回目は、候補の一覧に表示されるエンジンの保証文（「おもてにしてから確かめる」などの文を含む）まで比べていたテストの誤りで 2 件失敗し、GUI の表示（保証文の details を除く）だけを比べるように直した
- ブラウザ: 接続層 8792・Vite 5192（実行の前に空きを確かめた）。Playwright の webServer が起動・終了したプロセスだけを使い、前後にポートとこの作業場所のプロセスを記録した（R6・R7 のあとともに 0）。ほかのプロセスの検索・終了はしていない
- 実行のときの作業ツリーの差分はない（文書はこのあとのコミット）

### 18.8 証跡

GUI のリポジトリの外の `C:\dev\kyuura-engine-verification-gui-0178`（既存の証跡とは別）。非公開の `verifier/`（計画・導入の記録・固定例の新旧の応答の全体と差の分類・カード定義の比べ・構築盤面の照合と入口の受け付け・実応答の写しの出典・各実行の記録と JUnit・無効な 1 回目の記録・ポートとプロセスの記録）と、非機密の集計だけの `public/`。`MANIFEST.md`・`manifest.json`・`sha256.json`。

### 18.9 未確認・次へ残すこと

- 0.177.0 の `.venv` からの入れ替えそのもの（新しい作業場所の新しい `.venv` で確かめた）
- ［えんかくさいみん］・うらの B・C の盤面のブラウザでの確認（接続層だけ。送信のときの処理は変わっていないので、ブラウザで全部の組を繰り返していない）
- 受理のあとの効果（コインの結果・相手のカードがおもてになるか）の画面での確かめ（結果は予告せず、応答の表示だけを確かめた）
- フロントの単体テストの全件・e2e の全件・preview・エンジンの全体テスト・クリーンな環境での全工程
- 1〜17 章の確かめを `8f5329d` でやり直していない（固定例・構築盤面・選んだテストだけ）
- エンジン側: UP-5t の D（静的な監査だけ）・トレーナーの候補への同じ扱いの拡張（エンジンの別の作業）

## 19. 相手のうらのカードを読むトレーナーの候補（PT-5t-C1。0.179.0・4b6e3fe の文書・コードと実応答で確かめた）

基点は GUI の `a5c6245`（`feature/engine-0178-up5t-c1`。UP-5t-C1・from_state・PT-5e・P6・U-R3a の追従と送る前の check の修正を含む公開コミット。`origin/main`（`088822c`）には入っていない）。作業ブランチは `feature/engine-0179-pt5t-c1`（専用の worktree `kyuura-engine-gui-wt-0179`）。エンジン・AI・renderer は読むだけ。

### 19.1 固定と依存の更新（0.178.0 → 0.179.0）

- `server/requirements.txt`・契約の表の `engine` を `4b6e3fe`（0.179.0。公開ブランチ `claude/pt5t-c1` の「版を 0.179.0 にする」。配布の確認済みのコミット）にした。後続の文書だけのコミット（`c157c7b`）・検証用 AI の追従（`claude/vai-0179-follow` の `bbe3f6c`）・ブランチの先頭へは自動で変えない
- `npm run setup` で新しい作業場所の新しい `.venv` に入れ、`direct_url.json` のコミットの一致（`vcs_info.commit_id`・`requested_revision` とも `4b6e3fe…`）・編集可能でないこと・配布メタデータとパッケージの版（0.179.0）・site-packages からの読み込みを確かめた（`engine_source` と `test_contract.py::test_engine_identity`）
- `8f5329d` から `4b6e3fe` までの `kyuura_engine/` の差分は `legal_actions.py`（`_trainer_candidate` と、共通にした `_probe_recording_identity`、`GUARANTEE_TRAINER` の 1 文）と版だけ。コマンドの処理・効果・裁定のファイルに差はない。読んだ文書: エンジンの `docs/legal-actions-up5t-d-trainer-audit.md` 12 章、`docs/implementation-status.md` の v0.179 の節、テスト `tests/test_legal_actions_pt5t_c1_v0_179.py`、AI の追従の `docs/verification-ai-v0179-follow.md`（`bbe3f6c`。読むだけ）
- 契約の識別・形式の版、要求・応答の JSON の形、処理可能性・理由・拒否のコードの語彙は同じ。契約の表は `engine` と `$comment` の説明だけを変えた。renderer（`af88231`）・`package.json`・lockfile・カード定義の契約は変えていない

### 19.2 エンジンの変化（候補の契約）

- `_trainer_candidate`: 手札のトレーナーカードごとの確かめ（`check_play_trainer` を状態の複製の上で試す）を、`_probe_recording_identity`（UP-5t-C1 の記録の仕組みを確かめの関数によらない形にしたもの）のもとで呼ぶ。相手のうらのカードの本当のカードを使ったと記録されたら、受け付ける・拒否・停止のどれでも結果を使わず、その選べるものを残して `unverified`（`eligible: true`。理由 `continuation_not_evaluated`・`face_down_reveal_not_evaluated`・`preflight_not_evaluated`）にする。拒否でも外さない（外すと選べるものの数・並びが本当のカードによりうる）
- 候補全体の処理可能性は、既存のとおり選べるものの中のいちばんよい区分。**同じ `play_trainer` の候補に `may_stop_later` と `unverified` の選べるものが混ざりうる**（19.5 の実応答）
- 確認された秘密依存の判定を候補の側で採用しない補強。エンジンの修正の前の代表の盤面でも外へ出る応答の差は再現していない（情報漏れを再現して直したものではない）
- 対象の例: ねむれ!ねむれ!（`PMCG4-054`）・トロピカルウインド（`PR1-074`）。相手のバトル場がうら（マチスの秘策）のとき
- `play_trainer` の `guarantees.preconditions` に 1 文（「v0.179: 確かめが相手のうらのカードの本当のカードを使ったら、その結果（受け付ける・拒否・停止）を使わない（unverified。そのあとの公開の確かめの拒否も示さない）」）が加わった
- 入力の形（1 段・本人の手札のカード 1 枚・`input_disclosure` `confirmed`）・送信のときの処理（受け付けるかは本当のカードによらない）・効果・裁定は変わっていない

### 19.3 GUI の扱いと製品のコードの要否（変えていない）

| 項目 | 既存の扱い | 0.179.0 での確かめ |
|---|---|---|
| 候補全体と選べるものごとの区分 | 候補の一覧は候補の `processability`、入力の画面は選べるものごとの `processability`・理由（`DecisionPanel` の選べるものの行の `ProcessabilityBadge`・`reasonsText`） | 混在する実応答で、候補は「送れる（後で止まりうる）」、ねむれ!ねむれ! は「未確認」と理由、マサキは「送れる」（単体・画面全体・e2e） |
| `unverified` の選べるもの | 選べる（`eligible` と実行できる区分。`EXECUTABLE_PROCESSABILITY` に含む）。「未確認」の説明は保証がないこと | 構造の check のあとに送れる（単体・画面全体・e2e） |
| 理由 `face_down_reveal_not_evaluated` | 0.178.0 で直した文「うらのカードの本当のカードでは確かめていない（使えるか・どうなるかは送信のあとエンジンが決める）」 | 同じ文。ゲーム上の禁止と書かない |
| 表示だけ・入力非公開・実行できない区分 | 送れない（既存） | 既存のテスト（PT5e・U75・DecisionPanel）が通る |
| 送る前の check | `play_trainer` は `check_before_submit_kinds`。今の主体・取っ手・候補・入力（`choicesKey`）への答えだけ。入力を変えると `checkEpoch` を進めて答えを捨て、遅れた答えも置かない。送信の入口（`useEndpointSession.submit`）も同じ門 | カードの選び直し・元の入力への戻り・遅れた check・閲覧者の切り替え（画面全体・e2e）、送信の入口が要求を出さない（単体） |
| 保証文 | 候補の一覧の details に表示するだけ | 文を変えても送れるかが同じ（単体） |
| 選べるもの | エンジンが返したものだけ（手札・カード定義から補わない） | 単体・e2e で選べるものが 2 つだけ |
| 拒否の診断 | 送った本人だけ・自動で再送しない | 画面全体・送信の入口 |

- 製品のコード（`server/kyuura_gui_server`・`web/src` の画面・検証・接続層）は変えていない。カード名・ID による分岐や GUI 独自の合法性の判定は加えていない。変えたのは依存・契約の表の `engine` と説明・版のテスト・固定例の来歴の追記・テスト・e2e の入口の許可の表・文書

### 19.4 情報境界

- 相手のバトル場がうらのとき、使う人・観戦者の観測には `face_down` と場所だけがあり（`real` はない）、GUI は「裏向きのポケモン」と表示する。本当のカードの ID・名前・`real`・表面の画像を、カード定義から補わない（カード定義に本当のカードがあっても。画面全体のテストで描画の呼び出しにも出ないことを確かめた）
- 送る前に、おもてになるか・場に残るか・効果が起こるかを予告しない（入力の画面・check の答えの文）
- 使う人の候補・入力・check・診断は相手・観戦者の画面に出ない（画面全体・e2e）。接続層では候補・inputs・check のあとに状態（全員の観測）と全員の更新が変わらない
- 双子の比べの前提: 使う人と観戦者の観測・公開のログ（エンジンの `observe`・`visible_log`。HTTP の view にログはないので接続層のテストで直接）が同じ。相手本人の観測は本当のカード（`real`）を含むので違う（全員の知識が同じとは扱わない）
- 受理のあとの公開・状態の変化は、エンジンの観測のとおりに表示する（e2e は結果を予告して比べない）

### 19.5 代表応答（構築盤面 `pt5t_sleep_a`・`pt5t_tropical_a`。実応答）

| 対象 | 候補全体 | 選べるもの |
|---|---|---|
| 相手のうら（本当のカード 3 つとも同じ） | `may_stop_later`（`continuation_not_evaluated`・`preflight_not_evaluated`）・`confirmed` | トレーナー: `unverified`・`eligible: true`・理由 3 つ（`face_down_reveal_not_evaluated` を含む）。マサキ: `may_stop_later`・理由 2 つ。check はどちらも `valid`（構造だけ） |
| 相手のおもて（2 枚） | `may_stop_later` | トレーナー: `may_stop_later` |
| 本人のうら（イマクニ？） | `may_stop_later` | イマクニ？: `may_stop_later`（本人の知識だけなので未確認にしない） |
| ［アレルギーかふん］ | — | `play_trainer` の候補がない（読む前の公開の拒否） |

送った結果（受理・拒否）は、双子の 3 つで同じ（接続層）。結果の内容は予告せず、応答のまま扱った。

### 19.6 構築盤面（テスト専用）

- 新しい構築盤面 `server/tests/pt5t_boards.py`: 2 枚 × うら 3（コラッタ・ユンゲラー・メタモン。使う人の手札にマサキも置く）、おもての対照 2、本人のうらの対照（イマクニ？）1、［アレルギーかふん］1 の 10 盤面。名前は結果を予告しない。製品のコードは import しない。`p6_boards.install_boards` で名前の決まった盤面だけを固定例の表に加える（テストと e2e の入口 `tests/pt5t_server.py` の中だけ）
- 4b6e3fe のエンジンの tests（読むだけ。`git archive` で scratchpad へ書き出した）の `opponent_face_down(trainer, real, extra_hand=(BILL,))`・`opponent_face_up`・`own_face_down`・`with_allergy_pollen` の盤面と、状態の書き出し・乱数の指紋が 10 盤面すべて同じ。既存の 17 盤面（UP-5t-C1 10・PT-5e 2・P6 3・U-R3a 2）も同じ。27 盤面すべてを 0.179.0 の `ClientHub.from_state` が受け付けた

### 19.7 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を 0.178.0（`8f5329d`。既存の作業場所 `kyuura-engine-gui-wt-0178` の `.venv` を読むだけ。`direct_url` が `8f5329d` であることを先に確かめた）と 0.179.0 の環境で実行し、項目ごとに比べて違いを分類した（保証文・版・その他。差を無条件に除かない）
- 14 の固定例・15 の時点で、全入口の view・candidates・作成の知らせはすべて同じ。違いは比べた出力の外側の `engine_version`（版の文字列）の 1 か所だけ。保証文だけの差・処理可能性・選べるもの・入力の差はない。理由: どの時点にも `play_trainer` の候補がない（時点の候補の種類を数えて確かめた）ので、1 文が加わった保証文も、選べるものごとの扱いの変化も出ない
- 固定例の JSON の `compatibility` に 0.179.0 の確かめを追記した（元の来歴・`engine_commit` は変えていない。CRLF・字下げを保ち、各ファイル 12 行の追加だけ）。再生は記録の操作の列を新しい版の対戦で再生した互換性の確かめで、旧記録の正式な再実行・復元ではない。旧記録・snapshot の識別は書き換えていない
- カード定義: 正規化した sha256 `b82354d6…`・1,374 件で同じ。導入物のバイト列は違う（0.178.0 の導入物は CRLF 0・3,718,804 バイト、0.179.0 の導入物は CRLF 127,782・3,846,586 バイト。差はちょうど CRLF の数で、導入のときの改行の違い。内容は同じ）

### 19.8 実行した検証（2026-11-10。限定）

計画（対象・比べる基準・予算）は実行の前に保存した。記録した実行は各 1 回で、失敗はなかった（再実行なし）。

| 記録 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `da1c230` | 型検査（`npm run typecheck`） | 終了コード 0 |
| R2 | `da1c230` | ビルド（`npm run build`） | 終了コード 0 |
| R3 | `da1c230` | フロントの単体（vitest。関係する 9 ファイル: 新しい `PT5tC1`・`AppPT5tC1`、`PT5e`・`UP5tC1`・`AppUP5tC1`・`U75`・`DecisionPanel`・`checkGate`・`validate`） | 84 件成功・失敗 0（JUnit） |
| R4 | `da1c230` | 接続層（pytest）: `test_contract`・`test_engine_source`・`test_bridge`・`test_card_definitions`・`test_scenarios`（固定例 14）・`test_pt5e`・`test_up5t_c1`・`test_from_state`・`test_pt5t_c1`（新） | 117 件成功・失敗 0（JUnit） |
| R5 | `da1c230` | 導入元の要約（`python -m kyuura_gui_server.engine_source`） | 終了コード 0（git・`4b6e3fe`・0.179.0・site-packages） |
| R6 | `da1c230` | e2e 1 件（`e2e/pt5t-c1.spec.ts`。テスト専用の入口 `tests.pt5t_server`。接続層 8793・Vite 5193） | 1 件成功（JUnit） |
| R7 | `da1c230` | 既存のトレーナーの e2e 1 件（`e2e/pt5e.spec.ts`。`tests.pt5e_server`。8794・5194） | 1 件成功（JUnit） |

- 記録の前に開発中に手元で流したもの（新しい接続層のテスト・新しい単体テストの 2 ファイル・型検査）は記録の対象外。開発中の型検査で、新しい単体テストの応答の型の絞り込みの誤り（テストのコードだけ）を直した
- ブラウザ: 実行の前にポートの空きを確かめ、Playwright の webServer が起動・終了したプロセスだけを使った。R6・R7 のあと、ポートの待ち受けとこの作業場所のプロセスは 0。ほかのプロセスの検索・終了はしていない
- 実行のときの作業ツリーの差分はない（文書はこのあとのコミット）

### 19.9 証跡

GUI のリポジトリの外の `C:\dev\kyuura-engine-verification-gui-0179`（既存の証跡とは別）。非公開の `verifier/`（計画・導入の記録・固定例の新旧の応答の全体と差の分類・カード定義の比べ・構築盤面の照合と入口の受け付け・実応答の写しとその作り方・各実行の記録と JUnit）と、非機密の集計だけの `public/`。`MANIFEST.md`・`manifest.json`・`sha256.json`。

### 19.10 未確認・次へ残すこと

- 0.178.0 の `.venv` からの入れ替えそのもの（新しい作業場所の新しい `.venv` で確かめた）
- トロピカルウインド・うらの B・C の盤面のブラウザでの確認（接続層だけ。ブラウザで全部の組を繰り返していない）
- 受理のあとの効果（コインの結果・相手のカードがおもてになるか・場に残るか）の画面での確かめ（結果は予告せず、応答の表示だけを確かめた）
- 秘密を読んだあとの公開の拒否（リムーブ禁止ジム・MG1）を `unverified` が覆う場合（今の登録の 2 型では起こらない。エンジンの監査 12.4）
- new_game からの到達、フロントの単体テストの全件・e2e の全件・preview・エンジンの全体テスト・クリーンな環境での全工程
- 1〜18 章の確かめを `4b6e3fe` でやり直していない（固定例・構築盤面・選んだテストだけ）

## 20. 本人のうらのバトル場のワザの候補の保証文（F-1。0.180.0・27ba35d の文書・コードと実応答で確かめた）

基点は GUI の `434d1fa`（`origin/main`）です。PR #3 で `feature/engine-0179-pt5t-c1` の `d4773c4` を取り込んだマージコミットで、ツリーは `d4773c4` と同じで、ほかの変更を含みません。作業ブランチ `feature/engine-0179-pt5t-c1` はマージのあと origin から消えていました。作業ブランチは `feature/engine-0180-f1`（専用の worktree `kyuura-engine-gui-wt-0180`）です。エンジン・AI・renderer は読むだけにしました。

### 20.1 固定と依存の更新（0.179.0 → 0.180.0）

- `server/requirements.txt` と契約の表の `engine` を `27ba35d` にした（0.180.0。公開ブランチ `claude/f1-face-down-attack-guarantee` の「版を 0.180.0 にする」。配布の確認済みのコミット）。後続の文書だけのコミット `a042ba3`（`docs/legal-actions-f1-face-down-attack-guarantee.md`）は読んだだけで、追従しない
- `npm run setup` で、新しい作業場所の新しい `.venv` に入れた。確かめたこと:
  - `direct_url.json` のコミットの一致（`commit_id`・`requested_revision` とも `27ba35d…`）
  - 編集可能でないこと
  - 配布メタデータとパッケージの版（0.180.0）
  - site-packages からの読み込み
- 導入物の実装の識別（`replay_record.implementation_identity`）は、`27ba35d` のソース（`git archive`）から計算した識別と同じ。エンジンの文書 7 節の値とも同じ
  - `behavior_digest` `08038e06…`（58 ファイル）
  - `instrumentation_digest` `d3436748…`（4 ファイル）
- `4b6e3fe` から `27ba35d` までの `kyuura_engine/` の差分は、`legal_actions.py` と版だけ。`legal_actions.py` の差は、`GUARANTEE_FACE_DOWN_ATTACK` の追加と、`_attack_candidate` のうらの分岐だけにそれを渡す変更。ほかの差は文書・テスト・`tools/`（配布の対象外）
- 次のものは変わっていない: 契約の識別・形式の版、要求・応答の JSON の形、処理可能性・理由・拒否のコードの語彙、`guarantees` の項目の名前（4 つ）
- renderer（`af88231`）・`package.json`・lockfile・カード定義の契約は変えていない

### 20.2 エンジンの変化（候補の契約）

- **保証の文と実装の対応の修正で、ゲームの処理の変更ではない**
- 0.179.0 まで: 本人のうらのバトル場のポケモンのワザの候補（`_face_down_attack_candidate`）に、おもての `GUARANTEE_ATTACK` が付いていた。その文は「`resolution.flow.check_use_attack` を候補の作成と入力の検査に使う」だが、この分岐は `check_use_attack` を呼ばない（`verify=_not_checked`）
- 0.180.0: うらのときだけ `GUARANTEE_FACE_DOWN_ATTACK` が付く。4 項目の要点:

| 項目 | 要点 |
|---|---|
| preconditions | ワザは本人が知る本当のカードの印刷のワザ。`check_use_attack` と先読みは、候補の作成でも入力の検査でも呼ばない。check は形だけ |
| acceptance | 保証しない。check が valid でも、エンジンの確かめを通したことを意味しない |
| after_acceptance | 評価していない。受理のあとを予告しない |
| supported_scope | `unverified` は、受理・必要なエネルギー・ワザの実行の完了の保証ではない |

- 本当のカード（ワザの有無を含む）で文を分けない。おもてのワザ・使えないワザの候補の文は同じ
- 変わらないもの（エンジンの文書 4 節・テスト）: 候補・選べるものの有無・順序・入力の形・処理可能性と理由・inputs・check・submit の判定・状態遷移・乱数の消費

### 20.3 GUI の扱いと製品のコードの要否（最小の変更 3 つ）

| 項目 | 既存の扱い | 0.180.0 での確かめ |
|---|---|---|
| 保証文の受け付けと表示 | 検証は `guarantees` を文字列の対応表として受ける。候補の一覧の details に、エンジンの文をそのまま並べる | 実応答の 4 項目を受け付け、そのまま表示（単体・画面全体・e2e） |
| 保証文で送れるかを決めない | 送れるかは、候補の `processability`・`input_disclosure`・check の答えだけで決まる | 保証文を入れかえても（おもての文・別の文）、送れるかと GUI の文が同じ（単体） |
| 送る前の check | `use_attack` は `check_before_submit_kinds`。今の主体・取っ手・候補・入力への答えだけを使う。入力を変えると捨て、遅れた答えも置かない。送信の入口も同じ門 | 単体: 送信の入口が要求を出さない。画面全体: 選び直し・元の入力への戻り・遅れた check・閲覧者の切り替え。e2e も |
| check が valid のときの文 | うらの特殊能力と P6 のにげるには「形の検査」の専用の文がある。うらのワザは、おもてと同じ「エンジンの検査を通りました（受理・完走の保証ではありません…）」 | **変えた**（下の 2） |
| うらのワザの選べるものの説明 | 「あなたのうらのバトル場のポケモン（本人だけが知るカード）のワザです。エンジンがおもてにしてから確かめます。」 | **変えた**（下の 1） |
| 印刷のワザがないうら | エンジンは段のない `not_implemented` を返す（U7-4 から）。GUI の検証は `use_attack` の段の並び（`attack`・`declaration_options`）だけを受け、`stages: []` を知らない並びとして止めていた | **変えた**（下の 3） |

製品のコードの変更はコミット `944c683` の 3 つです。判定・送信の制御は変えていません。カード名・ID による分岐、GUI 独自の合法性の判定、保証文の文字列を使う制御も加えていません。

1. **選べるもの（`face_down`）の説明**（`web/src/components/DecisionPanel.tsx`）
   - 前の文「エンジンがおもてにしてから確かめます」は、おもてになることの予告として読める。拒否なら状態はうらのまま。0.178.0 で理由の表示の文を直したのと同じ理由
   - 新しい文: 「必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます（候補と入力の検査では確かめていません）」
2. **check が valid のときの文**（同じファイル）
   - うらのワザかどうかは `isFaceDownAttack` で決める。根拠は、エンジンが返したワザの選べるものの `face_down`
   - うらのワザの新しい文: 「エンジンの形の検査を通りました（ワザの番号が 1 つで、ほかを選ばないことだけ。必要なエネルギーが足りるか・ワザを使えるか・受理・完走の保証ではありません。結果は送信の応答で決まります）」
   - 新しい保証の「check が valid でも、エンジンの確かめを通したことを意味しない」に合わせた。おもてのワザ（`check_use_attack` を使う）の文は変えていない
3. **契約の表の `stage_roles_or_empty` に `use_attack` を加えた**（`use_stadium` と同じ既存の仕組み）
   - 見つけたこと: 0.180.0 の実応答（`f1_face_down_energy`）で、この候補を選ぶとエンドポイントの画面が「応答の形が契約と合わない」になり、候補が消える。0.180.0 で生じたものではなく、U7-4 からの不足
   - 今の表示: 「この操作に入力はありません」と、処理可能性の区分で送れないこと。送れないことは前と同じで、check の答えがあっても送れない
   - `test_contract.py` が、`_face_down_attack_candidate` のソースと照らす

GUI が独自に書く説明と、エンジン由来の保証文は、分けて確かめました。テストは、保証文の details を除いた GUI の文だけを見ます。そこに、受理・エネルギー・完走の保証や、おもてになることの予告がないことを確かめます。エンジンの文の中の「受理」「エネルギー」などの語は、GUI の誤表示として扱いません。

### 20.4 情報境界

- 本人のバトル場がうらのとき、相手・観戦者の観測には `face_down` と場所だけがあり、GUI は「裏向きのポケモン」と表示する
- 本当のカードの ID・名前・ワザ・表面の画像を、カード定義から補わない。カード定義に本当のカードがあっても同じで、画面全体のテストで描画の呼び出しにも出ないことを確かめた
- 本当のカードだけが違う 4 つのうらで、相手・観戦者の観測と相手の候補は同じ（接続層）。本人の観測には本人の知識（`real`）がある
- 本人の候補・入力・check・診断は、相手・観戦者の画面に出ない（画面全体・e2e）
- 候補・inputs・check のあとに、状態（全員の観測）と全員の更新は変わらない（接続層）
- 送る前に、受理・おもてになること・受理のあとを予告しない（入力の画面・check の答えの文）
- 受理のあとは、エンジンの観測のとおりに表示する。e2e では、いわおとしの受理のあと、本人のバトル場が観測のとおり「イワーク」になった

### 20.5 代表応答（0.180.0 の実応答。構築盤面）

| 盤面 | 候補 | 保証の文 | 入力・check |
|---|---|---|---|
| うら（コラッタ・イワーク・ユンゲラー） | `unverified`・理由 `face_down_reveal_not_evaluated`・`confirmed` | `GUARANTEE_FACE_DOWN_ATTACK`（sha256 `aa316b12…`。3 つとも同じ） | 1 段目は本当のカードの印刷のワザ（`face_down: true`・`unverified`）、2 段目は 0 個。各ワザの check は `valid`。`[]`・`["o9"]` などは `CANDIDATE_INPUT_INVALID` |
| うら（炎エネルギー。印刷のワザなし） | `not_implemented`・理由 `face_down_reveal_not_evaluated`・`no_printed_attack` | 同じ文 | `stages: []`。`[]` の check は `CANDIDATE_NOT_EXECUTABLE` |
| おもて（エビワラー） | `may_stop_later`・理由 2 つ | `GUARANTEE_ATTACK`（sha256 `f1e79cef…`。0.179.0 の値） | ジャブ 1 つ。check は `valid` |

送信の結果は予告せず、応答のまま扱いました。

| 送ったもの | 結果 |
|---|---|
| イワークのかたくなる | check は `valid` でも、エンジンが拒否（`INSUFFICIENT_ENERGY`・`invalid_input`）。本人だけに返り、状態はうらのまま、相手と観戦者への更新はない |
| コラッタのかみつく・イワークのいわおとし | 受理（公開の更新） |

フロントの単体テストの fixture `web/src/test/f1.ts` は、導入した 0.180.0 の接続層の HTTP の口から取った実応答を、そのまま写したものです。作り方は証跡の `probe/gen_fixture_f1.py`、元の応答は非公開の証跡にあります。

### 20.6 構築盤面（テスト専用）

`server/tests/f1_boards.py` の盤面:

- P6 の構築盤面 3 つ（`p6_face_down_retreat_a`〜`c`。コラッタ・イワーク・ユンゲラー）を、そのまま再利用した
- 足りない 2 つだけを、P6 の組み立てで加えた
  - `f1_face_down_energy`: `face_down_active(FIRE)`
  - `f1_face_up`: `test_secret_plan_v0_67.board()`。`p6_boards._initial` に、`real` なしを許す引数の変更だけを加えた
- 名前は結果を予告しない。製品のコードは import しない。テストと e2e の入口 `tests/f1_server.py` の中だけで、固定例の表に加える

照合（27ba35d のエンジンの tests は読むだけ。`git archive` で scratchpad へ書き出した）:

- 新しい 2 つと既存の 27（PT-5t-C1 10・UP-5t-C1 10・PT-5e 2・P6 3・U-R3a 2）の 29 盤面すべてで、エンジンの tests の盤面と状態の書き出し・乱数の指紋が同じ
- 29 盤面すべてを、0.180.0 の `ClientHub.from_state` が受け付けた
- 旧版の snapshot は使っていない

### 20.7 依存の更新の影響（固定例の旧版と新版の比べ）

- `server/tools/scenario_views.py --full` を 0.179.0 と 0.180.0 の環境で実行し、項目ごとに比べた
  - 0.179.0（`4b6e3fe`）は、既存の作業場所 `kyuura-engine-gui-wt-0179` の `.venv` を読むだけで使った。`direct_url` が `4b6e3fe` であることを先に確かめた
  - 違いは 6 つに分けた: 版・識別／guarantees／候補・選べるもの・順序／処理可能性・理由／入力／view・通知。どれも除外して同じにはしていない
- 14 の固定例・15 の時点で、違いは比べた出力の外側の `engine_version` の 1 か所だけ。guarantees・候補・選べるもの・順序・処理可能性・理由・入力・view・作成の知らせの差は 0
- **保証文の差は未出現**: 各時点・各入口の候補の行を種類ごとに数えた。`use_attack` の候補は 0 行（うらのワザの候補も 0 行）。指紋（`views_sha256`）が変わらないことだけからは推測していない
- 固定例の JSON の `compatibility` に 0.180.0 の確かめを追記した
  - 元の来歴・`engine_commit` は変えていない。CRLF・字下げを保ち、各ファイル 11 行の追加だけ
  - 再生は、記録の操作の列を新しい版の対戦で再生した互換性の確かめ。旧記録の正式な再実行・復元ではない
  - 旧記録・snapshot の識別は書き換えていない
- カード定義: 正規化した sha256 `b82354d6…`・1,374 件で同じ。導入物のバイト列も同じ（どちらも CRLF 127,782・3,846,586 バイト・`8ac177e8…`）で、改行の差はない

### 20.8 実行した検証（2026-11-13。限定）

計画（対象・比べる基準・予算・ポート）は、変更と実行の前に保存しました。製品の変更が加わったあと、記録する実行の前に、対象のファイルと選んだ理由を追記しました。記録した実行は各 1 回で、失敗はありませんでした（再実行なし）。

| 記録 | コミット | 対象（選んだ理由） | 結果 |
|---|---|---|---|
| R1 | `9a9a932` | 型検査（`npm run typecheck`） | 終了コード 0 |
| R2 | `9a9a932` | ビルド（`npm run build`） | 終了コード 0 |
| R3 | `9a9a932` | フロントの単体（vitest 11 ファイル。下の表） | 151 件成功・失敗 0（JUnit） |
| R4 | `9a9a932` | 接続層（pytest 10 ファイル。下の表） | 120 件成功・失敗 0（JUnit） |
| R5 | `9a9a932` | 導入元の要約（`python -m kyuura_gui_server.engine_source`） | 終了コード 0（git・`27ba35d`・0.180.0・site-packages） |
| R6 | `9a9a932` | e2e 1 件: うらのワザの代表経路（`e2e/f1.spec.ts`。テスト専用の入口 `tests.f1_server`。接続層 8795・Vite 5195） | 1 件成功（JUnit） |
| R7 | `9a9a932` | e2e 1 件: 既存のおもてのワザの代表経路（`e2e/attacks.spec.ts` の 1 件目を `-g` で。通常の入口・seed 21。8796・5196） | 1 件成功（JUnit） |

R3・R4 で選んだファイルと理由:

| 記録 | 理由 | ファイル |
|---|---|---|
| R3 | 新しいテスト | `F1`・`AppF1` |
| R3 | ワザの表示と check の文 | `Attacks`・`AppAttacks` |
| R3 | check の文の隣の分岐 | `P6`・`AppP6`・`R3a` |
| R3 | 段のない入力を受ける既存の種類 | `U75` |
| R3 | 入力の画面・check の門・契約の検証 | `DecisionPanel`・`checkGate`・`validate` |
| R4 | 契約・導入元・版・固定例・入口 | `test_contract`・`test_engine_source`・`test_bridge`・`test_card_definitions`・`test_scenarios`・`test_from_state` |
| R4 | 盤面の組み立てを共用する | `test_p6`・`test_r3a` |
| R4 | おもてのワザ | `test_attacks` |
| R4 | 新しいテスト | `test_f1` |

- 記録の前に開発中に流したものは、記録の対象外: 新しい接続層のテスト、新しい単体テストの 2 ファイル、`test_contract`
- 開発中の新しい単体テストの 1 回目で、印刷のワザがないうらの実応答（`stages: []`）を GUI の検証が止めることを見つけた（20.3 の 3）
- 固定例の比べの 1 回目は、`python -I` が `PYTHONIOENCODING` を無視して cp932 で書き出したため、UTF-8 として読めなかった。`-I` を外して取り直した。1 回目の出力は証跡に残し、比べには使っていない
- ブラウザ:
  - 実行の前にポートの空きを確かめ、Playwright の webServer が起動・終了したプロセスだけを使った
  - R6・R7 の前後とも、専用ポートの待ち受けはなかった。R7 のあと、この作業場所のプロセスは 0
  - ほかのプロセスの検索・終了はしていない
- 実行のときの作業ツリーの差分はない（文書はこのあとのコミット）

### 20.9 証跡

保存先は GUI のリポジトリの外の `C:\dev\kyuura-engine-verification-gui-0180` で、既存の証跡とは別です。

- 非公開の `verifier/`: 計画、導入と識別の記録、固定例の新旧の応答の全体と差の分類、カード定義の比べ、構築盤面の照合と入口の受け付け、実応答と fixture の作り方、各実行の記録と JUnit、ポートとプロセス
- 公開してよい `public/`: 非機密の集計だけ
- `MANIFEST.md`・`manifest.json`・`sha256.json`

### 20.10 未確認・次へ残すこと

- 0.179.0 の `.venv` からの入れ替えそのもの（新しい作業場所の新しい `.venv` で確かめた）
- new_game からの到達（固定例・e2e の seed に、うらのワザの候補はない）
- うらのコラッタ・ユンゲラー・炎エネルギーのブラウザでの確認（接続層・単体だけ）
- 受理のあとの続きの画面での確かめ（ユンゲラーなど、たねでないカードをおもてにしたあとのトラッシュと、バトル場に出す決定）。P6 のにげるの e2e にはあるが、ワザでは確かめていない
- うらの特殊能力の check の文の「エンジンが送信のあとカードをおもてにしてから決めます」（U-R3a・U7-5g-2 の文）は、今回の対象（ワザ）の外なので変えていない。同じ理由でおもてになることの予告として読めるかは、別に判断する
  - 2026-11-13: 予告として読めると判断し、表示の文だけを直した（21 章）
- フロントの単体テストの全件・e2e の全件・preview・エンジンの全体テスト・クリーンな環境での全工程
- 1〜19 章の確かめを、`27ba35d` でやり直していない（固定例・構築盤面・選んだテストだけ）

## 21. 0.180.0 の追従の残り: うらの特殊能力の check の文と、同じ番のにげるの観察の整理（2026-11-13）

20.10 に残した「うらの特殊能力の check の文」と、14.10 の「受理のあと同じ番にもう一度 `retreat` の候補が出る」観察を扱いました。エンジンの固定先は 0.180.0（`27ba35d`）のままで、依存・エンジン版・renderer・カード定義・lockfile は変えていません。

### 21.1 基点と作業場所

- 基点は GUI の `811114b`（`feature/engine-0180-f1`）。`git fetch --all --prune` のあと、origin の作業ブランチの先頭と同じで、新しい公開コミットはない。`origin/main`（`434d1fa`）の祖先ではない（main への取り込みは仮定しない）
- 作業場所は専用の worktree `C:\dev\kyuura-engine-gui-wt-0180fp`、ブランチ `feature/engine-0180-face-down-power-check-text`。利用者の作業ツリー（main・未コミットの変更 0）と既存の worktree は変えていない
- 既存の `kyuura-engine-gui-wt-0180` は、Git for Windows の git（`core.autocrlf=true`）では未コミットの変更 0。別の git（autocrlf の設定なし）からは改行の違いだけで 123 ファイルが変更ありに見える（`--ignore-cr-at-eol` で差 0）。修復・書きかえはしていない

### 21.2 表示の条件とエンジンの処理

check の答えが valid のときの GUI の文（`DecisionPanel` の `.check-result`）は、次の順で決まります。どれもエンジンが返した契約の値で決め、カード名・ID・保証文の文字列は使いません。

1. 費用を評価していない段（`cost_evaluation`。P6 のにげるだけ）
2. `isFaceDownPower`: 種類が特殊能力で、候補の `power.face_down` か `pokemon.face_down` が true
3. `isFaceDownAttack`: ワザの選べるものの `face_down`（20 章）
4. ほか: 汎用の「エンジンの検査を通りました（受理・完走の保証ではありません。結果は送信の応答で決まります）」

| 経路 | 候補の値 | check が valid のときの文 | 今回 |
|---|---|---|---|
| 本人のうらのポケモンの特殊能力（U7-5g-2・U-R3a） | `power.face_down`・`pokemon.face_down`。`unverified`（`face_down_reveal_not_evaluated`） | 2 の文 | **変えた** |
| おもてのポケモンの特殊能力 | `face_down` なし。`may_stop_later` など | 4 の汎用の文 | 変えていない |
| 相手のうらのカードを試行中に読むため `unverified` の特殊能力（UP-5t-C1） | 使うポケモンはおもて（`face_down` なし）。`unverified`（`face_down_reveal_not_evaluated`） | 4 の汎用の文（本人のカードがおもてになるとは書かない） | 変えていない |

`unverified` であることだけでは、本人のうらと同じ状況として扱いません（UP-5t-C1 の候補も `unverified` だが、2 の文にはならない）。

固定先のエンジン（`27ba35d` の `engine.apply_command`・`_reveal_for_action`・`GUARANTEE_FACE_DOWN_POWER`）の処理:

- 入口で、項目・終局・延長戦・停止・決定を確かめる。続けて、番・決定待ちでないことを確かめてから、このポケモンをおもてにする。ここまでの拒否では、おもてにならない
- 本当のカードが「たねポケモン」なら、おもてにしたあとふつうに確かめ（`check_use_pokemon_power`）、受理（特殊能力がおこる）か拒否。拒否なら複製を捨て、状態・ログはもどる（うらのまま・おもてにしたことも公開されない）
- 「たねポケモン」でなければ、ついているカードといっしょにトラッシュして受理（特殊能力はおこらない）
- 保証文の `acceptance` は「保証しない」。check（`_power_input_problem`）は段の数・番号・前の段との依存だけを確かめる

check が valid でも結果は一律ではないことを、保存済みの結果で照らしました（新しい対戦はしていない）。

| 結果 | 出典 |
|---|---|
| check valid → 拒否（`WRONG_ENERGY_TYPE`）、うらのまま、相手・観戦者の観測・更新・ログは変わらない | `server/tests/test_r3a.py` `test_rejected_after_reveal_only_to_sender_and_restored`（0.180.0 で成功。`kyuura-engine-verification-gui-0180` の R4 の JUnit） |
| check valid → 受理、おもてにして特殊能力（炎エネルギーが移る） | 同 `test_accepted_power_moves_the_fire_energy_and_reveals`（0.180.0 で成功） |
| check valid → 受理、たねでないのでトラッシュ（特殊能力はおこらない） | 同 `test_not_basic_is_revealed_and_trashed_without_the_power`（0.180.0 で成功） |
| check valid → 受理、決定待ち（［スパイ］） | `server/tests/test_u7_5fg.py` `test_face_down_power_owner_only_then_reveal`（記録のある最後の実行は 0.175.0 の U-R3a の追従の R4 で成功。0.180.0 では実行していない） |

0.175.0（`81e9e99`）から 0.180.0（`27ba35d`）までの `kyuura_engine/` の差は `__init__.py`・`adapter.py`・`client_api.py`・`legal_actions.py` だけで、コマンドの処理（`engine.py`・`resolution/`・効果）は同じです（`git diff --stat`）。

### 21.3 変えた文（製品のコードは `web/src/components/DecisionPanel.tsx` の 1 行）

| | 文 |
|---|---|
| 前 | エンジンの形の検査を通りました（段の数・番号・前の段との組だけ。特殊能力を使えること・受理・完走の保証ではありません。エンジンが送信のあとカードをおもてにしてから決めます） |
| 後 | エンジンの形の検査を通りました（段の数・番号・前の段との組だけ。特殊能力を使えるか・受理されるか・処理が完了するかは保証しません。送信のあとエンジンが判定します） |

- 理由: 前の文の「エンジンが送信のあとカードをおもてにしてから決めます」は、おもてになることの予告として読める。拒否ならうらのまま、おもてにする前の拒否もある（21.2）。20 章のワザの選べるものの説明を直したのと同じ理由
- 後の文は、依頼の基本形（「入力の形を確認しました。特殊能力を使えるか・受理されるか・処理が完了するかは保証しません。送信後にエンジンが判定します。」）を、隣の文（P6・うらのワザ）と同じ「エンジンの形の検査を通りました（確かめたこと。保証しないこと。…）」の形にした。保証の範囲は基本形と同じ
- 変えていないもの: 表示の条件（`isFaceDownPower`）、処理可能性・理由・入力・check・送信の制御、`checkGatePassed`・`checkEpoch`・遅い応答の無効化、拒否の表示と自動で再送しないこと、エンジンの保証文（候補の一覧の details にそのまま表示）、おもて・UP-5t-C1・ワザ・P6 の文
- 特殊能力の常設の説明（`PowerInfo` の「送ると、エンジンがこのカードをおもてにしてから決めます（受理・拒否・トラッシュ）。…拒否なら状態はもどり、…」）は、check が valid のときの文ではないので、今回は変えていない（21.7）。→ 22 章で直した（2026-11-13）
- テストと e2e の旧文の期待（`R3a.test.tsx`・`AppR3a.test.tsx`・`e2e/u-r3a.spec.ts`）を新しい文にした。e2e は実行していない

### 21.4 同じ番のにげる（14.10 の観察）の整理

14.10 の観察「構築盤面 A で受理のあと、同じ番の候補にまた `retreat`（`supported`）が出た」は、**確認済みの仕様**として残件から外します（観察の記録は 14.10 にそのまま残す）。

- 2000.02.14 版の出典: p.311「「にげる」の宣言は、1回の自分の番の中で、何度でもすることができます。」「1匹のポケモンが何回「にげる」を宣言してもかまいません。」（エンジンの `docs/retreat-confusion-v0.3c.md`・`docs/confusion-v0.3c.md` の転記。`docs/rules-2000-02-14.md` のにげるの節）
- 回数の制限は、こんらんで「にげる」に失敗したポケモンが今の番にもう宣言できないこと（p.311。ポケモンごと）だけ。エンジンは番ごとの回数を持たず、失敗の記録（`retreat_failed_turn`）だけを持つ。エンジンのテスト `tests/test_turns.py` の `test_retreat_many_times_in_one_turn` が、同じ番の 2 回のにげるを受理する
- エンジンの検証用 AI の文書（`docs/verification-ai-reach-policy.md`「同じ番のにげる」）も、同じ出典で同じ番に続けてにげられるとしている
- 観察との一致: 構築盤面 A は本当のカードがたね（にげる 0）のうらのバトル場のポケモンで、受理のあと控えがバトル場に出て同じ番の MAIN にもどる。新しいバトル場のポケモンのにげるの候補が出るのは上の仕様のとおり
- 回数のほかの不整合（区分・理由・こんらんの失敗の記録の扱いなど）は、GUI・エンジンの記録に報告がない。別の残件として分けるものはない
- エンジンへの回数の制限の追加・にげるの候補の抑制はしていない。GUI も回数を数えない（今までどおり）

### 21.5 実行した検証（2026-11-13。限定）

作業場所だけで、変更に関係する対象を実行した。ビルドは、変更が表示の文字列とテストだけ（型・構成・依存は同じ）なので型検査で足りるとして実行していない。接続層（pytest）・ブラウザ・e2e・全件・preview は実行していない。

| 実行 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `11efa7e` | 型検査 `npm run typecheck` | **終了コード 1**（新しいテストの補助の引数の型の誤り） |
| R1b | `44a1434` | 型検査（R1 の修正のあと） | 終了コード 0 |
| R2 | `44a1434` | vitest 11 ファイル（`FaceDownPowerCheck`（新）・`R3a`・`AppR3a`・`U75fg`・`AppU75fg`・`UP5tC1`・`AppUP5tC1`・`F1`・`P6`・`DecisionPanel`・`checkGate`） | 131 件・**失敗 1**（`AppR3a` の受理の 1 件。旧文の期待の直し忘れ）・ほかの 10 ファイル 127 件は成功 |
| R1c | `1a56421` | 型検査（e2e の期待を直したので。`e2e/` も型検査の範囲） | 終了コード 0 |
| R2b | `1a56421` | vitest `AppR3a` だけ（失敗したファイル） | 4 件・失敗 0 |

- 新しい単体 `web/src/components/FaceDownPowerCheck.test.tsx`（8 件）: 新しい文（2 段・入力なし）、予告の語がないこと、通らない check の文は前と同じ、UP-5t-C1 のうら・おもての対照は汎用の文で「おもて」を含まない、エンジンの保証文（0.180.0 の `GUARANTEE_FACE_DOWN_POWER` をソースから写した。UP-5t-C1 の実応答の保証文も）が details にそのまま出る、保証文を入れかえても（3 通り）check の前後の送れるかと文が同じ。予告の語の確かめは GUI の `.check-result` だけに当て、エンジンの保証文の語（おもてにする・トラッシュ）は禁止しない
- 既存の fixture だけを使った（`test/r3a.ts`・`test/u75fg.ts` の `SPY`・`test/up5t.ts` の実応答）。新しい構築盤面・実応答の取り直し・new_game からの対戦はしていない。UP-5t-C1 の実応答の保証文が 0.180.0 の `GUARANTEE_POWER` と同じことは、固定先のソースと照らした（証跡 `source/`）
- 選び直し・閲覧者の切り替え・遅い check・拒否の表示・自動で再送しないことは、既存の `AppR3a`・`AppU75fg`・`AppUP5tC1`・`checkGate` が R2・R2b で成功（変えていない）

### 21.6 証跡

保存先は GUI のリポジトリの外の `C:\dev\kyuura-engine-verification-gui-0180fp`（新しい検証単位。既存の `-gui-0180` のマニフェストは照合だけで変えていない）。

- 非公開の `verifier/`: 計画、表示の条件とエンジンの処理の対応、前後の文、fixture の出典と保証文の照合、各実行の記録（コマンド・コミット・作業ツリー・開始と終了・出力・終了コード・JUnit）、にげるの出典と整理の根拠、失敗と再実行
- 公開してよい `public/`: 確認済みの件数と状態だけ
- `MANIFEST.md`・`manifest.json`・`sha256.json`（ハッシュは `MANIFEST.md` に書く）

### 21.7 未確認・次へ残すこと

- ブラウザ・e2e（`u-r3a.spec.ts` の期待は直したが、実行していない）・vitest の全件・接続層のテスト・preview
- 特殊能力の常設の説明（`PowerInfo`）の「エンジンがこのカードをおもてにしてから決めます（受理・拒否・トラッシュ）」。拒否で状態がもどることは同じ文に書いてあるが、おもてにする前の拒否は書いていない。check が valid のときの文ではないので今回は変えていない。直すかは別に判断する。→ 22 章で直した（2026-11-13。同じ種類のうらのにげるの説明も）
- ［スパイ］（入力なし）の受理を 0.180.0 の実エンジンで通していない（記録のある最後の実行は 0.175.0 の接続層のテスト。コマンドの処理は 0.175.0 と同じ）
- LOST_TARGET・R-2〜R-5 の残り・エンジン・AI・裁定・データの別件

## 22. 送信の前に GUI が書く、うらのカードの公開・使用の説明の静的確認と最小の修正（2026-11-13）

21.7 に残した `PowerInfo` の説明を中心に、GUI が独自に書く「送ればカードがおもてになる」と読める文を一度にまとめて確かめ、実装より強い予告だけを直しました。エンジンの固定先は 0.180.0（`27ba35d`）のままで、依存・エンジン版・renderer・カード定義・lockfile は変えていません。

### 22.1 基点と作業場所

- 基点は GUI の `92ba5da`（`feature/engine-0180-face-down-power-check-text`。21 章）。`git fetch --all --prune` のあと、origin の作業ブランチの先頭と同じで、新しい公開コミットはない。`811114b`（20 章）と `origin/main`（`434d1fa`）を含む
- 作業場所は専用の worktree `C:\dev\kyuura-engine-gui-wt-0180pi`、ブランチ `feature/engine-0180-face-down-preview-text`。利用者の作業ツリー（main・未コミットの変更 0）と既存の worktree は変えていない
- 既存の `kyuura-engine-gui-wt-0180`・`-wt-0180fp` は、21.1 と同じく、autocrlf の設定のない git からは改行の違いだけで多くのファイルが変更ありに見える（`--ignore-cr-at-eol` で差 0）。修復・書きかえはしていない

### 22.2 検索と分類

`92ba5da` の `web/src` の製品のコード（`*.ts`・`*.tsx`。テストと `web/src/test/` を除く）を「おもて|表向き|裏向き|公開|reveal|うら」で検索した（`git grep -n -E`）。一致は 133 行。

| 分類 | 行 | 扱い |
|---|---|---|
| 1. 送信の前に、将来の公開・使用を説明する文 | 7 | 2 つの文（3 行）を直した（22.4）。ほかの 4 行は直さない（22.5） |
| 2. 受理のあとに起きたことを示す文（ログの見出し） | 1 | 変えない |
| 3. 操作名・選択肢名・状態のラベル | 11 | 変えない |
| 4. エンジンの理由・残りの識別子に付ける説明 | 5 | 変えない（将来の公開を確約しない） |
| 6. 今の盤面・情報境界の表示（裏向きのポケモン・おもての山札やサイド・本人だけが知るカード） | 22 | 変えない（将来を述べない） |
| 7. 接続の検証の誤りの文（情報境界の違反で止めるときの文） | 6 | 変えない |
| 0. 表示されないコードの注釈・識別子 | 81 | 変えない |

分類 5（文書・テストの引用・過去の記録）は行ごとには分類せず、直した文の引用の有無だけを確かめた: テスト・fixture・e2e に、直した 2 つの文の期待はない（`U75fg.test.tsx`・`e2e/u75fg.spec.ts` の「「未確認」は使える・受理されるという意味ではありません」は新しい文にも残る。`e2e/p6.spec.ts` は説明の表示だけ）。文書では 14 章（P6）・21.3・21.7 と README の「送信の結果」が前の文やエンジンの処理を書いている。過去の記録は書きかえず、21.3・21.7 と README に 22 章への参照だけを加えた。エンジン由来の保証文（候補の一覧の details にそのまま出す）は分類 4 の外で、文字列として表示するだけ。

### 22.3 エンジンの処理との照合（固定先 `27ba35d`）

`engine._apply_once` → `_reveal_for_action`（うらのカードの特殊能力・にげる・ワザ・進化）と `adapter.submit`:

| 経路 | おもてになるか | 結果 |
|---|---|---|
| 入口の確かめ（項目・終局・延長戦・停止・決定）、続けて番・決定待ちでの拒否 | ならない（おもてにする前） | 拒否 |
| 本当のカードがたねポケモン → おもてにしたあと確かめ（`check_use_pokemon_power`・にげるの確かめ）で拒否 | 処理の途中でおもてにするが、拒否で複製を捨てる | 拒否（`rejected`: 「元の状態（状態・乱数・ログ）を保った」。おもてにしたことも公開されない） |
| たねポケモンで受理 | なる | 受理（特殊能力・にげるがおこる） |
| たねポケモンでない | なる | ついているカードといっしょにトラッシュして受理（特殊能力・にげるはおこらない） |

保証文（`GUARANTEE_FACE_DOWN_POWER`・`GUARANTEE_FACE_DOWN_RETREAT`）の `acceptance` は「保証しない」で、同じ処理を書いている。`rejected` は元の状態を保つ契約なので、拒否のときの文は「状態が変わらないことがあります」ではなく「状態は送信の前のまま」と書ける（`failed`（状態の不整合・内部エラー）は拒否とは別の結果）。

### 22.4 直した文（製品のコードは `web/src/components/DecisionPanel.tsx` の表示の文 2 つ）

| 場所（表示の条件） | 前 | 後 |
|---|---|---|
| `PowerInfo` のうらの説明（候補の `power.face_down`・`pokemon.face_down`） | 送ると、エンジンがこのカードをおもてにしてから決めます（受理・拒否・トラッシュ）。「未確認」は使える・受理されるという意味ではありません。拒否なら状態はもどり、おもてにしたことも相手・観戦者に知らされません。 | この候補では、特殊能力を使えるか・どうなるかを確かめていません。送信のあとにエンジンが判定します（受理・拒否のほか、本当のカードがたねポケモンでなければ、特殊能力を使わずにトラッシュして受理されることもあります）。「未確認」は使える・受理されるという意味ではありません。拒否された場合は状態が送信の前のまま（うらのまま）で、処理の途中でおもてにしたことも相手・観戦者に知らされません。 |
| `FaceDownRetreatInfo` の 2 段落目（段の `cost_evaluation`。P6） | 送ると、エンジンがこのポケモンをおもてにしてから決めます。結果は送信の応答と観測で表示します（ここでは予告しません）。受け付けられなかったときは状態がもどり、おもてにしたことも相手・観戦者には知らされません（結果はあなたにだけ表示します）。 | このにげるが受け付けられるか・どうなるかは、送信のあとにエンジンが判定します（ここでは予告しません）。結果は送信の応答と観測で表示します。拒否された場合は状態が送信の前のまま（うらのまま）で、処理の途中でおもてにしたことも相手・観戦者には知らされません（結果はあなたにだけ表示します）。 |

- 理由: 「おもてにしてから決めます」は、送ればおもてになることの確約として読める。おもてにする前の拒否があり、拒否ならうらのまま（22.3）
- `PowerInfo` は、前の文の受理・拒否・トラッシュの区別を残した（トラッシュは特殊能力を使わない受理）。にげるの前の文はトラッシュの区別を書いていなかったので、加えていない
- 2 つは候補の種類と表示の条件が違うので、文を共通化していない（文字列のための新しい部品は作っていない）
- 拒否の文の「処理の途中でおもてにしたことも」は、おもてにした後の拒否でも公開されないことを書く（おもてにすることの予告ではない）

### 22.5 直さなかった主要な文

| 文（場所） | 分類 | 理由 |
|---|---|---|
| 「おもてにしたあと場に残るか・トラッシュするかは、エンジンが本当のカードで決めます（ここでは予告しません）…」（`kindNote` の `reveal_face_down`） | 1 | 操作そのものが「うらのカードをおもてにする」。候補と check はコマンドと同じ確かめ（`check_reveal_face_down`。公開の値だけを読む）を使い、受け付けたらおもてにする。結果（残る・トラッシュ）は予告していない |
| 「必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます（候補と入力の検査では確かめていません）」（うらのワザの選べるもの） | 1 | 20 章で直した文。確約しない |
| 「保証はありません（例: …）。送れますが、使えるかは送るまで分かりません…」（`unverified` の説明） | 1 | 確約しない |
| 「うらのカードの本当のカードでは確かめていない（使えるか・どうなるかは送信のあとエンジンが決める）」（理由 `face_down_reveal_not_evaluated`） | 1 | 0.178.0 で直した文。確約しない |
| check が valid のときの文（うらの特殊能力・うらのワザ・P6） | — | 21 章・20 章で直した文（「おもて」を含まない）。検索の一致の外 |
| 「うらのカードをおもてにする」（操作名）・「おもてにする自分のうらのカード」（段のラベル）・「表向きの山札のカードを確かめる」 | 3 | 操作名・選択肢名 |
| 盤面の「裏向きのポケモン」「うらのカードです。あなたにだけ見えるカード…」・おもての山札・サイド | 6 | 今の状態。将来を述べない |
| ログの見出し「この閲覧者に届いた公開の更新」・受理のあとの公開のログ（エンジンの更新から） | 2・4 | 受理のあとの出来事 |
| エンジンの保証文（「このポケモンをおもてにする」「トラッシュ」を含む） | 4 | エンジンの文をそのまま表示（GUI の誤表示として扱わない） |
| `types.ts` の注釈「エンジンがおもてにしてから決める」 | 0 | 表示されない |

### 22.6 変えていないもの

表示の条件（`isFaceDownPower`・`costNotEvaluated`）、処理可能性・理由・入力の形、候補・選べるもの・順序、check・submit・送信の制御、`checkGate`・`checkEpoch`・遅い応答の無効化、拒否の表示と自動で再送しないこと、エンジンの保証文・ログ、操作名、依存・エンジン版・renderer・lockfile・カード定義。カード名・ID・保証文の文字列による分岐は加えていない。製品のコードの差は `DecisionPanel.tsx` の JSX の文字列 2 か所（3 行）だけ。

### 22.7 実行した検証（2026-11-13。限定）

| 実行 | コミット | 対象 | 結果 |
|---|---|---|---|
| R1 | `061b360` | 型検査 `npm run typecheck` | 終了コード 0 |
| R2 | `061b360` | vitest 13 ファイル（`FaceDownPreviewText`（新）・`FaceDownPowerCheck`・`U75fg`・`AppU75fg`・`R3a`・`AppR3a`・`P6`・`AppP6`・`UP5tC1`・`AppUP5tC1`・`U75e`・`AppU75e`・`DecisionPanel`） | 149 件成功・失敗 0 |

- 新しい単体 `web/src/components/FaceDownPreviewText.test.tsx`（11 件）: `PowerInfo` の新しい文（入力なし・2 段）、確約の語がないこと（GUI の説明の段落だけに当てる）、受理・拒否・トラッシュの区別と「送信の前のまま」の文、相手のうらを読む候補（UP-5t-C1 の実応答の写し）とおもての特殊能力には説明が出ないこと、check の門（check の前は送れない・valid のあとだけ・送信は 1 回）、保証文を入れかえても説明と送れるかが同じ、エンジンの保証文が details にそのまま出ること、にげるの新しい文とほかの段落が変わらないこと・check の門・おもてのにげるに説明が出ないこと、操作名のラベル
- 既存の fixture だけを使った（`test/u75fg.ts` の `SPY`・`test/r3a.ts`・`test/up5t.ts`・`test/p6.ts`・`test/u73.ts`）。新しい構築盤面・実応答の取り直し・対戦はしていない
- 開発中に新しいテストを 1 回だけ流した（記録する実行の前。11 件成功）
- ビルドは、変更が表示の文字列とテストだけなので実行していない。接続層・ブラウザ・e2e・全件・preview は実行していない。e2e に変えた文の期待はない

### 22.8 証跡

保存先は GUI のリポジトリの外の `C:\dev\kyuura-engine-verification-gui-0180pi`（新しい検証単位。既存の `-gui-0180`・`-gui-0180fp` のマニフェストは照合だけで変えていない）。非公開の `verifier/` に、計画、検索のコマンドと一致の全行、分類の一覧、エンジンの処理との照合、前後の文、fixture の出典、各実行の記録（コマンド・コミット・作業ツリー・開始と終了・出力・終了コード・JUnit）。公開してよい `public/` は確認済みの件数と状態だけ。

### 22.9 未確認

- ブラウザ・e2e・vitest の全件・接続層のテスト・preview
- 新しい文をブラウザで表示したところ（JSX の改行は空白 1 つになる。単体テストで文字列を確かめた）
- 14 章（P6）・21 章・README の、エンジンの処理を書いた過去の記述は書きかえていない（参照を加えただけ）
