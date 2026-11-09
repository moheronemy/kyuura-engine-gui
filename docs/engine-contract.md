# エンジンの契約と GUI の対応（kyuura-engine v0.174.0・P6。v0.172.0・U7-5f・g までは 13 章まで）

GUI が使うエンジンの公開の境界と、その確かめ方・更新の方法の記録です。推測でなく、固定コミットの文書・コードと実際の応答で確かめた内容だけを書きます。

## 0. 固定と導入

- 版 0.174.0、導入する完全なコミット `f7bf450580bf0d02573b4d032271be6b8e12d699`（公開ブランチ `claude/p6-face-down-retreat` の「版を 0.174.0 にする」。P6 と 0.173.0 の CN-1 の修正を含む。Git の URL からの通常のインストール。14 章）。文書だけの後続のコミット・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
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

## 1. 参照した資料（1〜5 章は固定コミット d0c5cfa で確かめ、b4e62d9・9506d63・0885d66・74c8e1f・e26df79 で変わっていないことを確かめた。U7-3 は 9 章、U7-4 は 10 章、U7-5 は 11 章、U7-5e は 12 章、U7-5f・g は 13 章、P6（0.174.0）は 14 章。14 章では 1〜13 章の確かめを f7bf450 でやり直していない）

- `docs/client-api-v0.164.md`（入口・要求と応答・更新・導入）
- `docs/legal-actions-u7-1.md`（決定への回答・番を終える・取っ手・処理可能性・coverage）
- `docs/legal-actions-u7-2.md`（初期配置・補償・ジャンケン・延長戦・ホストの入口）
- `docs/legal-actions-u7-3.md`（番の基本の操作 4 種類。b4e62d9）
- `docs/legal-actions-u7-4.md`（ワザの宣言。9506d63）・`docs/client-api-v0.164.md` の v0.166 の追記・`resolution/flow.py` の `check_use_attack`
- `docs/legal-actions-u7-5ab.md`（場の 3 操作）・`docs/legal-actions-u7-5c.md`（手札のトレーナー）・`docs/legal-actions-u7-5d.md`（場のスタジアムと GUI への引き継ぎ。0885d66）・`legal_actions.py` の `_board_candidates`・`_trainer_candidate`・`_stadium_candidate`・`_pokemon_option`・`_card_option`
- `docs/legal-actions-u7-5e.md`（特殊能力・型ごとの宣言・3 段の依存。74c8e1f）・`legal_actions.py` の `_power_candidates`・`_power_candidate`・`_public_pokemon`・`_power_domain`・`stage_dependency_problems`・`_power_input_problem`・`effects.POWER_INPUT_STAGES`
- `docs/legal-actions-u7-5fg.md`・`docs/legal-actions-u7-5fg-spec.md`（U7-5f・g。文書は `05a6749`）・`legal_actions.py`（e26df79）の `_face_up_candidate`・`_add_energy2_stage`・`_path_stage_problems`・`_face_down_power_candidates`・`RESIDUAL_CLASSES`・`_residual_present`・`_unverified_paths`・`_candidates`
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

- `unverified` のトレーナー（PT-5e の 5 つ）と、未登録のトレーナー（`not_implemented`）
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
- R-5 のほかの候補（入力を返さない候補）と R-2〜R-4 は変わらない
