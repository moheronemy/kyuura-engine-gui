# エンジンの契約と GUI の対応（kyuura-engine v0.166.0・U7-4）

GUI が使うエンジンの公開の境界と、その確かめ方・更新の方法の記録です。推測でなく、固定コミットの文書・コードと実際の応答で確かめた内容だけを書きます。

## 0. 固定と導入

- 版 0.166.0、導入する完全なコミット `9506d6305e90ec262fbe77740d9aa57f04b980b6`（公開ブランチ `claude/u7-4-attacks` の「版を 0.166.0 にする」。通常のインストールとワザの宣言を確かめたコミット。Git の URL からの通常のインストール。`server/requirements.txt`）。文書だけが違う後続のコミット・エンジンの main へは自動で変えない。renderer の固定（`af88231`）は変えていない
- `b4e62d9`（0.165.0）から `9506d63` までの差分: `kyuura_engine/legal_actions.py`（U7-4 のワザの候補・入力・検査）・`resolution/flow.py`（ワザの宣言の前の確かめを `check_use_attack` に分けた。処理は同じ）・版の番号・文書・テスト。同梱のカードデータ（`kyuura_engine/data`）は変わっていない（バイト列も同じ）。契約の識別・形式の版は同じで、応答は加える方向だけ（10 章）
- `ffcc5ca`（0.164.0）から `b4e62d9` までの差分: `kyuura_engine/legal_actions.py`（U7-3 の候補・入力・検査）・`engine.py`（コマンドの処理の前半を `check_*` の関数に分けた）・版の番号・文書・テスト。同梱のカードデータの内容は同じ（正規化した JSON の sha256 が同じ）。契約の識別・形式の版（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）は同じで、応答は加える方向だけ（9 章）
- 契約の確かめ（1〜5 章）は `d0c5cfa` で行った。`d0c5cfa` から `ffcc5ca` までの差分は配布の設定（`pyproject.toml`・`MANIFEST.in`）・文書・配布物の確かめの道具とテストだけで、`kyuura_engine/` の中身は変わっていない。API の契約は変わっていないものとして扱い、接続層のテスト・ブラウザの接続確認を `ffcc5ca` の通常のインストールで通した
- 導入元は `direct_url.json` の `vcs_info.commit_id` で確かめる（`kyuura_gui_server/engine_source.py`）。site-packages で `git rev-parse` をしない（GUI 自身の HEAD を返しうる）

## 1. 参照した資料（1〜5 章は固定コミット d0c5cfa で確かめ、b4e62d9・9506d63 で変わっていないことを確かめた。U7-3 は 9 章、U7-4 は 10 章）

- `docs/client-api-v0.164.md`（入口・要求と応答・更新・導入）
- `docs/legal-actions-u7-1.md`（決定への回答・番を終える・取っ手・処理可能性・coverage）
- `docs/legal-actions-u7-2.md`（初期配置・補償・ジャンケン・延長戦・ホストの入口）
- `docs/legal-actions-u7-3.md`（番の基本の操作 4 種類。b4e62d9）
- `docs/legal-actions-u7-4.md`（ワザの宣言。9506d63）・`docs/client-api-v0.164.md` の v0.166 の追記・`resolution/flow.py` の `check_use_attack`
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

新しい操作の種類（トレーナー・パワーなど）が candidates に出るようになったら（U7-4 のワザはこの手順で 10 章のとおり加えた）:

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
