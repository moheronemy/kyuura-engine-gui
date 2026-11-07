# kyuura-engine-gui

[kyuura-engine](https://github.com/moheronemy/kyuura-engine) の公開クライアント API（`kyuura_engine.client_api`、契約 `kyuura-client-api`・形式 1）を使う、**ローカル確認用の最初の GUI** です。

> **ローカル専用です。** 一台の端末でプレイヤー0・プレイヤー1・観戦者の表示を切り替えて確かめるためのもので、認証済みのオンライン対戦・公開サーバーではありません。画面の切り替えと、接続層が渡す入口の識別子は、本人確認・強固な認証ではありません。この切り替えの仕組みを、将来の公開サーバーの権限制御に流用しないでください。

エンジンの処理は GUI へ移植していません。ゲーム規則・合法性の判定・カード効果は、すべてエンジンの `ClientHub` が行います。

## 構成

```
web/       フロントエンド（Vite・React・TypeScript）。/api を Vite のプロキシで接続層へ送る
  src/api/       契約の値（contract.ts）・JSON の型（types.ts）・実行時検証（validate.ts）・通信層（transport.ts）
  src/state/     入口ごとの画面の状態（取っ手・取り直し・遅れた応答の破棄）・送信の門・ログの要約
  src/components 盤面・状態・候補・coverage・決定の入力・診断・ログ・作成の画面
  src/cards/     カード画像（公開カード定義の検証・kyuura-card-renderer の入口・描画の部品）
  e2e/           実エンジンへのブラウザの接続確認（Playwright）
server/    ローカル接続層（Python・FastAPI）。ClientHub を包む薄い層。127.0.0.1 だけで待ち受ける
  kyuura_gui_server/  app.py（HTTP の口）・local_match.py（入口の保持・直列化・更新の保持）・decks.py・scenarios.py・safety.py・card_definitions.py（描画用の公開カード定義）
  tests/              接続層のテスト（実際の固定版エンジンへつなぐ）
  tools/              検証用の固定例の作り直し
contract/  GUI が前提にする契約の値の表（TypeScript と Python のテストが同じ表を読む）
scripts/   setup・dev・test の補助（Node）
```

ブラウザは Python を import しません。ブラウザ →（Vite のプロキシ）→ 接続層（HTTP の要求・応答）→ 入口の `handle(dict)` → エンジン、の順です。WebSocket は使いません。

## 必要なもの

- Node.js 20 以上（確認: 24.18.0・npm 11.16.0）
- Python 3.11 以上（確認: 3.14.6）
- git（エンジンを固定コミットから取得する）
- 接続確認（`npm run e2e`）だけ: Microsoft Edge（既定）。ほかのブラウザは `KYUURA_E2E_CHANNEL=chrome` など

## エンジンの固定

- **版**: kyuura-engine 0.166.0（`kyuura_engine.__version__`・配布メタデータの版）。API の契約（`kyuura-client-api`・形式 1）とあわせて、画面が前提にする機能の範囲を表す
- **完全なコミット**: `9506d6305e90ec262fbe77740d9aa57f04b980b6`（公開ブランチ `claude/u7-4-attacks` の「版を 0.166.0 にする」。U7-3（番の基本の操作）と U7-4（ワザの宣言）を含む。通常のインストールとワザの宣言を確かめたコミット。エンジンの main にはまだ入っていない）。導入する中身を一意に決める。版の番号だけでは中身を決められない（過去に同じ版の番号で中身の違う配布物があった）ので、固定にはコミットを使う
- 依存の定義: [`server/requirements.txt`](server/requirements.txt)（Git の URL からの通常のインストール）
  ```
  kyuura-engine @ git+https://github.com/moheronemy/kyuura-engine@9506d6305e90ec262fbe77740d9aa57f04b980b6
  ```
- 導入元の確かめ: 接続層のテスト（`server/tests/test_contract.py`）と `python -m kyuura_gui_server.engine_source` が、配布メタデータの `direct_url.json`（`vcs_info.vcs` が git・`vcs_info.commit_id` が上のコミット・編集可能でない）と版 0.166.0（配布メタデータとパッケージの両方）、読み込んだ `kyuura_engine` が site-packages の導入物であることを確かめる。確認できなければ失敗する
- 固定先は自動で変えない（エンジンの main の先頭・文書だけが違う後続のコミット・別のマージコミットへ追従しない）。変えるときは「エンジンの更新の手順」に従う

### 通常の利用と開発用の編集可能インストール

- **通常の利用**（GUI を動かす・テストする）: 上の通常のインストールだけを使う（`npm run setup`）。エンジンのソースの clone は要らない
- **エンジン自体を同時に開発する場合**だけ、手元のエンジンの作業ツリーを編集可能で入れてよい（`server/.venv` の Python で `python -m pip install -e <エンジンの作業ツリー>`）。この状態では導入元の確かめ（`test_engine_identity`）が「編集可能インストール」として失敗するので、GUI の確認の前に `npm run setup` で通常のインストールへ戻す

### 既存の環境からの更新

0.165.0（`b4e62d9`）・0.164.0（`ffcc5ca`）の通常インストールで作った `server/.venv` は、`npm run setup` をそのまま実行し直すと 0.166.0（`9506d63`）に入れ替わる（Git の URL のコミットが変わるため。0.165.0 からの入れ替えは別の一時的な環境で確かめた）。最後に下の `engine_source` で確かめる。renderer（`af88231`）は変わらないので、web の依存はそのまま（`npm run setup` が `npm install` を実行し直すだけ）。起動は今までどおり `npm run dev`。

### 古い仮想環境からの切り替え

さらに前の版の GUI（`-e git+…@d0c5cfa…` の編集可能インストール）で作った `server/.venv` は、次のどちらかで切り替える。

1. そのまま入れ直す: `npm run setup`（pip 26.3 で、編集可能の導入が通常の導入に置きかわることを確かめた）。残った古い clone `server/.venv/src/kyuura-engine` はもう読み込まれないので、不要なら消してよい
2. 作り直す: `server/.venv` を消してから `npm run setup`

どちらも最後に確かめる:

```sh
# Windows は server\.venv\Scripts\python
cd server && .venv/bin/python -m kyuura_gui_server.engine_source
# → {"install": "git", "commit_id": "9506d6305e90ec262fbe77740d9aa57f04b980b6", "version": "0.166.0", "module": ".../site-packages/kyuura_engine/__init__.py"}
```

## カード画像の renderer の固定

- **kyuura-card-renderer** の完全なコミット: `af882310059c7f33bc371d31b859b09f5428f6d1`（エンジンを 0.165.0・0.166.0 に更新したときも変えていない。同じ Canvas では最後に始めた要求だけが描く、非同期の描画の修正を含む）。renderer の main の先頭へは自動で追従しない
- 依存の定義: `web/package.json` の `"kyuura-card-renderer": "github:moheronemy/kyuura-card-renderer#af882310059c7f33bc371d31b859b09f5428f6d1"`。`web/package-lock.json` も同じコミット。導入のときに renderer の `prepare`（`npm run build:lib`。tsc で `dist-lib/` を作り、素材画像を写す）が動く。npm の `allowScripts` で、このコミットの `prepare` だけを許可している
- 固定の記録: [`contract/kyuura-gui-card-definitions-v2.json`](contract/kyuura-gui-card-definitions-v2.json) の `renderer.commit`（接続層のテストが `package.json`・lockfile と照らす）
- 使う公開 API（パッケージの入口の export だけ。`src/` の中を直接 import しない）: `fromEngineCard`・`renderToCanvas`・`cancelRenderToCanvas`・型 `EngineCardRecord`・`RenderableCard` など（`web/src/cards/renderer.ts`）
- `renderToCanvas` の戻り値: `true` は描いた、`false` は同じ Canvas へのあとの要求・キャンセルで無効になった（エラーではない）、reject は有効な要求の読み込み・描画の失敗
- `dist-lib` はバンドルしていない ESM（素材画像と Web フォントの CSS を import する）なので、Vite が扱う。Vitest でも Vite の変換を通す（`vite.config.ts` の `test.server.deps.inline`）

## 導入と起動

```sh
npm run setup     # server/.venv を作り、固定版エンジン・FastAPI などを入れ、web の npm の依存を入れる（グローバルには入れない）
npm run dev       # 接続層（127.0.0.1:8765）と Vite（127.0.0.1:5173）を一緒に起動。Ctrl+C で両方止まる
```

ブラウザで <http://127.0.0.1:5173/> を開きます。

本番ビルドの確認: `npm run build` のあと、接続層を起動して `cd web && npx vite preview`（<http://127.0.0.1:4173/>。開発時と同じく `/api` を接続層へプロキシする）。

個別に起動する場合:

```sh
# 接続層（Windows は server\.venv\Scripts\python）
cd server && .venv/bin/python -m kyuura_gui_server --port 8765
# フロントエンド（別の端末）
cd web && npm run dev
```

接続層のポートを変えるときは `KYUURA_GUI_SERVER_PORT`（dev.mjs と Vite のプロキシが読む）。待ち受けの住所は 127.0.0.1 に固定です。

## 現在できる操作

| 場面 | 操作 | 入口 |
|---|---|---|
| 対戦の作成 | 2 人分のカード ID と枚数の入力（エンジンの固定デッキをサンプルとして読み込める）・規約集合の選択・検証用の固定例 | 作成の画面 |
| 準備 | 最初のポケモンを置く（バトル場・ベンチ。ベンチは選んだ順）・切り直しの補償の枚数 | プレイヤー |
| 先攻 | ジャンケンの結果の入力（エンジンの外で行った結果） | **ローカルホスト（別枠）** |
| 番 | 番を終える・たねポケモンをベンチに出す・エネルギーをつける・進化させる・にげる（U7-3）・ワザの宣言（U7-4。ワザ → 宣言といっしょに選ぶもの）。エンジンが候補に出したときだけ | プレイヤー |
| 決定 | 決定への回答（サイドを取る・バトル場に出す・ワザの宣言のあとの決定（対象・トラッシュ・山札から選ぶ・写すワザ・任意の効果）・その他の決定。単一・複数・順序付き・辞退・0 枚） | 決める人 |
| 停止・終局 | 停止の診断・終局の結果の表示 | すべて |
| サドン・デス | 延長戦の開始 | **ローカルホスト（別枠）** |

表示: 相手のバトル場・ベンチ・各領域の公開枚数、自分のバトル場・ベンチ・手札、HP・ダメージ・特殊状態・エネルギー、段階・入力待ちの主体、操作候補と処理可能性・保証の範囲・入力の公開区分、coverage（対応範囲と未対応の種類）、診断、閲覧者に届いた公開の更新の要約。

## 番の基本の操作（U7-3）

エンジン 0.165.0（U7-3）で加わった 4 種類を、エンジンの候補（`candidates`）→ 入力の制約（`inputs`）→ 検査（`check`）→ 送信（`submit`）だけで扱います。候補は公開の `kind` で表示を決めます（`c1` などの番号や並びの先頭には依存しない）。GUI はベンチの空き・つけられる先・進化の元・にげるの費用を推測しません。

| 操作 | 段（送る順） | 画面 |
|---|---|---|
| たねポケモンをベンチに出す（`play_basic`） | 1. 手札のカード | 候補の選べるものだけ。`bench` の数と上限は表示だけ |
| エネルギーをつける（`attach_energy`） | 1. 手札のエネルギーカード → 2. 自分の場のポケモン | 2 段目は 1 段目で選んだ番号の `options_by_choice` の組だけ |
| 進化させる（`evolve`） | 1. 手札の進化カード → 2. 自分の場のポケモン | 同上。本人のうらのポケモンは裏面（カード ID なし・`unverified`） |
| にげる（`retreat`） | 1. 入れ替えるベンチのポケモン → 2. トラッシュするエネルギー（0 枚以上・選んだ順） | 枚数（`count`）と個数（`units` の合計・`total_units`）を分けて表示。送る前に check が必須 |

- **2 段の入力**（`depends_on_stage`・`options_by_choice`）: 1 段目を選ぶまで 2 段目は選べない。2 段目は組ごとの `eligible`・`processability`・`reasons` で表示する（同じポケモンでも、1 段目のカードによって区分が違うことがある）。1 段目を変えたら 2 段目の選択を捨てる
- **にげるの費用**: 必要な個数（`total_units`）と、選んでいるカードの個数の合計・枚数を表示する。1 枚で 2 個を出すカード（`units: 2`）・特殊エネルギー（`special`）・0 個（エネルギーを選ばずに送る）・こんらん（`confused`。受理のあとにコイン）を扱う。個数が範囲内でも合法とは表示しない（余る個数・読み方で変わる数などの未裁定はエンジンの検査が決め、GUI は決めない）。**今の入力への check が通るまで送信できない**。トラッシュの並びは選んだ順のまま送る
- **check の扱い**: check の答えは、どの入力への答えかを持つ。表示・送信の条件に使うのは、今の取っ手（選び直すと作り直す）・今の入力と同じ入力への答えだけ。入力を変えたら前の答えは使わない。遅れて届いた答えも、今の入力と違えば使わない。check が通っても受理・完走の保証ではなく、結果は submit の応答で決まる
- 受理のあとは選択と古い候補を捨てて取り直す。`refetch_required`（check・inputs・submit）でも取り直す。二重クリック・並行送信は送信の門で止め、submit は自動で再送しない。「やめる」は選択を捨てるだけで何も送らない
- **coverage**（U7-3 からの意味）: `scope_kinds` は「評価した種類（番を終える・基本の 4 種類。U7-4 でワザも）」と「未対応の種類（`not_covered_kinds`。U7-4 で 7 種類）」。`offered_kinds` は候補に出した種類だけで、評価して出さなかった種類（この状態ではゲーム上できない）は「評価して候補に出さなかった種類」と分けて表示する。番の候補は `partial`
- **処理可能性**: `supported` は候補の `guarantees` にある範囲の保証（受理のあとの全分岐の完走ではない）、`may_stop_later` は受理のあとに止まりうる（`reactions_not_evaluated`）、`unverified` は保証なし（最終の判定はエンジン）、`unresolved_ruling`・`not_implemented`・`technical_limit` は送れない（ゲーム上の禁止とは表示しない）。入力の公開区分（`input_disclosure`）は別の軸として表示する
- **知らない入力**: 入力の段に契約の表（`contract/kyuura-client-api-v1.json` の `stage_keys`）にない項目があれば「不明な応答」として操作を止める。GUI が入力の画面を持たない種類（`gui_operable_kinds` にない種類。将来のトレーナーなど）の候補は表示だけで選べない

## ワザの宣言（U7-4）

エンジン 0.166.0（U7-4）のワザの宣言（`use_attack`）を、候補 → 入力 → check → submit だけで扱います。入力の画面は段の `role`（`attack` → `declaration_options`）・`addon`・`options_by_choice` から組み立て、カード名・ワザの名前で画面を分けません。

| 段（送る順） | 内容 | 画面 |
|---|---|---|
| 1. ワザ（`role: attack`・1 個） | バトル場のポケモンが今持つワザ（エンジンの `available_attacks`） | 名前（`name_ja`）・必要なエネルギー（`cost`）・**印刷のダメージの表示**（`damage`）・説明（`text_ja`）・出どころ（`route`・`provider`・`payer`・`grantors`）・処理可能性と理由 |
| 2. 宣言といっしょに選ぶもの（`role: declaration_options`・0 個以上・選んだ順） | `addon`: `stadium_coin`（場のスタジアムのコイン）・`attack_power`（ワザを使うポケモン自身の特殊能力）・`with_power`（自分の場のポケモンの特殊能力。`power` の名前） | 1 段目のワザの `options_by_choice` の組だけ。1 つもなければ入力を求めない |

- **ダメージ**: `damage` は印刷の表示（「20」「30×」「10+」・なし）で、与えるダメージの予測ではありません。弱点・抵抗力・効果を GUI で計算しません。受理のあとのダメージ・HP は観測の値で表示します
- **持ち方**: コピー・変身・許可のワザ（`recall`・`psylink`・`prehistoric`・`puppet`・`mimic`）は、エンジンが返した値をそのまま表示します。画像・カード名からワザを補いません
- **宣言といっしょに選ぶもの**: 0 個で送れます。選んだ順のまま送ります（`with_power` は選んだ順に宣言）。重なり・併用の可否は GUI で決めず、入力の検査（エンジンの確かめ）に任せます。ワザを変えたら 2 段目の選択を捨て、前の check の答えも使いません
- **送る前に check**: ワザは、今の入力・今の取っ手への check が通るまで送信できません（`contract/kyuura-client-api-v1.json` の `check_before_submit_kinds`）。ワザの候補は原則 `may_stop_later`（`preflight_not_evaluated`: エンジンの宣言の前の先読みを候補では評価しない）で、check が通っても宣言の受理・完走の保証ではありません
- **宣言のあとの決定**: ワザの対象・トラッシュするエネルギー・山札から選ぶカード・写すワザ・任意の効果は、宣言の前に聞きません。受理のあとにエンジンが出す決定（`answer_decision`・`take_prize` など）に、既存の決定の入力で答えます。本人の回答待ち（「次: あなた（プレイヤー0）の決定への回答」）と相手の回答待ち（相手の画面は「ほかのプレイヤーの操作待ち」）を分けます。山札の中身は、検索が始まって本人の決定の選べるものとして来たものだけを表示します
- **コイン**: 入力にしません。エンジンが投げます
- **本人のうらのバトル場のポケモン**: 本人が知る本当のカードの印刷のワザ（候補にあるカード ID だけ）を `unverified` で示し、宣言といっしょに選ぶものは出しません（エンジンの U7-4 の扱い）。相手の画面・観戦者の画面には出ません
- **知らない形**: ワザの段の並び・`route`・`addon`・`cost` の値・選べるものの項目が契約の表（`stage_roles`・`attack_routes`・`declaration_addons`・`energy_types`・`attack_option_keys`・`addon_option_keys`）にないときは「不明な応答」として操作を止めます

### 拒否と受理のあとの停止

送信の結果は、エンジンの `outcome` と `result.status` のまま区別して表示します（`web/src/state/outcome.ts`）。

| 応答 | 表示 | 状態・取っ手 |
|---|---|---|
| `refused` | 「送らなかった（ホストの段の拒否）」。U7 の段で止め、エンジンに渡していない | 状態は変わらない。`refetch_required` でなければ取っ手は使える |
| `rejected` | 「拒否（エンジン）」。区分（未裁定など）は「ゲーム上の禁止ではありません」と添える | 状態は変わらない。取っ手はエンジンの応答に従う |
| `accepted`・`in_progress` | 「受理」と次の操作（例: プレイヤー1の番の操作） | 古い候補・入力を捨てて取り直す |
| `accepted`・`awaiting_decision` | 「受理（決定待ち）」と、本人か相手かの区別 | 決定の候補を取り直す |
| `accepted`・`halted` | 「受理（そのあと停止）」。宣言の拒否ではないことと、停止の区分・文 | 候補はなくなる。全員の観測が停止を示す |
| `accepted`・`game_over` | 「受理（対戦が終わりました）」 | 終局 |
| `failed`・接続層の誤り | 「処理できない結果」・利用できない表示 | 操作を止める |

拒否では、相手・観戦者への通知・更新を作りません（エンジンの契約。接続層のテスト `server/tests/test_attacks.py` で確かめる）。

## カード画像

カード画像は、**エンジンのカード定義から kyuura-card-renderer で作る、非公式のカード風の画像**です。実際のカードの画像・公式の画像ではなく、画像を外部から取得・収集する機能もありません。

- renderer の制限: イラスト枠は白（エンジンのデータにイラストがない）、エネルギーは仮の表示（エネルギーの枠の素材がない）、ベイビィはたねの枠（ベイビィの枠がない）
- 画像を出す場所: 自分の手札、公開のバトル場・ベンチ、おもてのサイド、トラッシュ（開いたときだけ）、スタジアム・使用中のトレーナー、決定の選択肢のうち本人に `card_id` が公開されたもの
- 裏面: 枚数だけが公開された領域（相手の手札・山札・サイド）と、観測が `face_down` のポケモン（最初の番の前の相手の場など）。手札は枚数分（最大 8 枚＋残りの数）、サイドは位置ごと（おもての位置だけ表面）、山札は 1 枚
- 印刷の画像と今の状態: 画像は印刷の値（印刷の HP・ワザ）で、今の HP・ダメージ・特殊状態・ついているエネルギーは画像の隣に観測の値を文字で出す（「印刷の画像」と「今の状態（観測の値）」）。画像の値を今の状態の代わりに使わない
- 画像の選択: 決定の選択肢の画像を押すと、その選択肢の入力（radio・checkbox）を選ぶだけ。送るのは候補の入力の選択肢の id で、画像・カード名から値やコマンドを決めない
- 文字の表示への切り替え: カード定義を取得できない・表にないカード・renderer が変換できない・Canvas や素材画像・フォントの読み込みや描画に失敗した、のどの場合も、カード名と理由を文字で表示する。操作は続けられる。失敗したカードは自動で描き直さない（ページを読み込み直すと描き直す）
- 読み上げ: 表面の Canvas は「〈名前〉の印刷のカード画像（非公式のカード風の画像）」、裏面は場所と枚数（「プレイヤー1・手札（裏向き 7 枚）」）。カード名・ID・HP などは今までどおり文字でも表示する

### 公開カード定義の取得（接続層の拡張）

`GET /api/card-definitions` は **GUI の接続層の拡張の口**です（エンジンの client_api にある入口ではありません）。接続層が、導入済みの kyuura-engine の同梱データ `kyuura_engine/data/kyuura_cards.json` を `importlib.resources` で読み（ソースの checkout・`.venv/src` には依存しない）、描画に使う項目だけを写して返します。

- 識別: `schema: "kyuura-gui-card-definitions"`・`schema_version: 2`、`source`（`format: "kyuura-engine card extract 1"`・`engine_version`・`sha256_method`・同梱データの内容の `sha256`）。表は [`contract/kyuura-gui-card-definitions-v2.json`](contract/kyuura-gui-card-definitions-v2.json)
- `sha256` の方式（`sha256_method: "kyuura-gui canonical-json 1"`）: 読んだ JSON を、キーの並べ替え・空白なしの区切り・ASCII に直さない UTF-8 で直列化したバイト列の sha256。正規化はこの直列化だけで、値・記録の追加と削除・並びの違いは別の値になります（内容の違いを隠さない）。`schema_version: 1` の `sha256` はバイト列の sha256 で方式の識別がなかったので、1 と 2 の値を同じ意味として比べません（画面は知らない方式・版を受け付けない）。同梱データは 0.165.0 と 0.166.0 でバイト列も同じ
- 記録の項目: `id`・`jp_set`・`category`・`name`・`pokemon`（段階・進化元・HP・タイプ・弱点・抵抗力・にげる・ルール文・ポケモンパワー・ワザ）・`trainer`（文）・`energy`（基本／特殊・タイプ・文）・`jp_print`（LV・レアリティ）。出典の記録・メモ・URL などは写さない
- **全体の表**（固定版のエンジンでは 1374 件）を返す。対戦の状態（山札・サイド・手札の配分・デッキリスト）を読まず、対戦で使っているカードだけの表は作らない（対戦の構成が分かってしまうため）。プロセスの中で 1 回だけ作り、使い回す
- 形の合わない記録・同じ ID の重なった記録は表に入れず `omitted` に数える（画面は「カード定義にないカード」）。同梱データを読めなければ `GUI_CARD_DATA_UNAVAILABLE`（503）
- フロントは応答を項目ごとに確かめて renderer の `EngineCardRecord` の形に組み立て直す（`as` で型を決めつけない。`web/src/cards/definitions.ts`）。観測やカード名の表（`/api/cards`）は描画に要る形ではないので使わない
- **表を持っていることと、非公開のカードが何かを知ってよいことは別**です。表面を描くのは、閲覧者の観測にカード ID があるカードだけ。表（キャッシュ）で表示の権限を判定しない

### 非同期の描画と非公開の情報

renderer の世代の管理（同じ Canvas では最後の要求だけが描く）は、**すでに描かれたピクセルを消しません**。GUI は次のようにします（`web/src/cards/CardImages.tsx`）。

1. 描く内容ごとに別の Canvas を作る（カード ID が変わる・表面から裏面になる・閲覧者を切り替えて画面ごと作り直す、のどれでも古い Canvas を使い回さない）
2. 内容の変更・部品の破棄では、effect の cleanup で `cancelRenderToCanvas` で待機中の描画を無効にし（キャンセル）、同時に Canvas をすぐに隠して幅・高さを 0 にしてピクセルを消す（消去）。キャンセルは「古い内容をこれから描かせない」、消去は「今見えている古い内容を消す」役割で、両方を行う
3. 新しい内容は、描けた（`true`）ときだけ表示する。それまでは文字の「画像を準備中」

- キャンセル後の `false` はエラーとして表示しない。cleanup のあとに終わった古い要求の完了・失敗は、その effect の目印で無視する（新しい表示を変えない）。React の StrictMode（effect の 2 回の実行）でも同じ
- 裏面の部品はカード ID・名前を受け取らない（props・DOM の属性・`title`・`aria-label`・画像の名前に入りようがない）。裏面の画像は 1 回だけ描いて全部の裏向きのカードで共有する（カードの情報を含まない静的な画像。裏向きのカードごとに Canvas を作らない）
- 表面の描ける内容の使い回しは、公開カード定義の表のカード ID だけをキーにする（閲覧者・秘密の状態をキーに入れない）。同じカードは同じ内容のオブジェクトなので、親の再描画で描き直さない

## 未対応の操作

この API の版（U7-1〜U7-4）が評価も候補の作成もしない、番の通常の操作は **作っていません**: トレーナー・ポケモンパワー（特殊能力）・スタジアム・ばけるを外す・場のカードをトラッシュ・裏のカードを表にする・表向きの山札のカードの確認（7 種類。U7-5）。U7-3 の範囲外の操作（化石・人形を場に出す・特殊能力やカツラでのエネルギーの追加・トレーナーでの進化・にげる以外の入れ替え）も作っていません。画面では coverage の `not_covered_kinds` として「未対応（ゲーム上の禁止ではない）」と表示します。ダミーの対戦処理はありません。

ワザで終局・停止まで進められますが、トレーナー・特殊能力などは未対応で、通常の対戦機能の完成ではありません。

決定待ち（サイドを取る・宣言のあとの決定）は、U7-4 から通常の new_game の画面操作でも届きます（e2e `attacks.spec.ts`）。サドン・デスなど通常の操作で届かない場面のために、**検証用の固定例**も残しています（エンジンのテストの既存の固定例。ピカチュウのデッキ・seed 9 で受理された操作の列を接続層が公開の `new_game`・`apply_command` で再生し、`ClientHub.from_state` で包む。再生は API の外のホストの側の準備で、ブラウザへ seed・デッキリスト・操作の列は返しません）。停止の固定例は、たねポケモン 1 枚のデッキ同士（seed 1）で準備の補償が記録で決まらず停止する例です。固定例は記録したエンジン（`ffcc5ca`）の来歴を書き換えず、新しい版で確かめた結果を `compatibility` に追記しています（0.165.0・0.166.0。0.166.0 での違いは候補の `implemented_kinds` に `use_attack` が加わったことだけ）。

## 接続層の責任と HTTP の口

接続層（`server/kyuura_gui_server`）は ClientHub を包む薄い層です。

- ClientHub の作成と保持。初版は単一の対戦だけを持ち、新しい対戦を作ると古い対戦（hub・入口・更新）を捨てる
- プレイヤー0・1・観戦者・ホストの入口を Python 側で保持し、ブラウザにはローカル用の関連付けの識別子だけを渡す。ホストは別の口
- 要求に actor・viewer を書いて主体を選ぶ口はない（書けばエンジンが `CLIENT_FIELD_UNKNOWN`）
- 要求（client_api の JSON）を入口の `handle` へそのまま渡し、応答を送り手へそのまま返す
- 閲覧者ごとの公開の更新を、要求のたびに hub から取り出して上限つき（閲覧者ごと 100 件）で保持する。保持の範囲より古い位置は `gap` で、view の取り直しへ誘導する
- 同じ対戦への要求を対戦ごとの鍵で 1 つずつ処理する
- 誤りは決まった文（`GUI_*`）。例外の文・traceback を返さない。ブラウザ向けの応答に、エンジンの閲覧用記録の禁止項目（seed・乱数・確認値・コマンド・デッキリストなど）が入っていないことを最後に確かめる
- seed は接続層が `secrets` で決め、返さない・受け取らない。テスト専用の起動の設定 `--test-fixed-seed N`（e2e が使う）だけが固定する（seed はブラウザへ返らない。`npm run dev` では使わない）
- ClientHub の内部状態には触れない（使うのは `start`・`from_state`・`player`・`spectator`・`host`・入口の `handle` だけ）

| 口 | 内容 |
|---|---|
| `GET /api/health` | 接続層・エンジンの版、契約の識別 |
| `GET /api/decks/presets` | エンジンの固定デッキ（サンプル）と規約集合 |
| `GET /api/cards` | カード名の表（ID・日本語名・分類・段階・HP） |
| `GET /api/card-definitions` | 描画用の公開カード定義の全体の表（GUI 接続層の拡張。「カード画像」） |
| `GET /api/scenarios` | 検証用の固定例の一覧 |
| `POST /api/local-match` | 対戦の作成（`{"mode":"decks","decks":[{"entries":[{"card_id","count"}]},…],"conventions"?}` か `{"mode":"scenario","scenario"}`）。古い対戦を捨てる |
| `DELETE /api/local-match` | 対戦を捨てる |
| `POST /api/seat/{token}` | プレイヤー・観戦者の入口へ client_api の要求（view・candidates・inputs・check・submit） |
| `GET /api/seat/{token}/updates?after=n` | その閲覧者の保持中の公開の更新 |
| `POST /api/host/{token}`・`GET /api/host/{token}/updates` | ホストの入口（プレイヤーの識別子では使えない） |

## 主体・秘密の情報・拒否・取っ手の扱い

- 閲覧者の画面は (対戦, 入口) ごとに作り直すので、切り替えると前の閲覧者の手札・候補・診断・ログはフロントエンドの状態から消える。主体の違う応答をキャッシュで混ぜない
- 切り替え前・取り直し前の応答が遅れて届いても、世代の番号で捨てる
- 拒否（エンジンの拒否・ホストの段の拒否・要求の誤り）は送り手の画面だけに表示し、他の閲覧者の更新は作られない（エンジンの契約。接続層のテストで確かめる）
- 受理のあとは古い候補・入力を捨てて取り直す。`refetch_required` の拒否でも取り直す
- `operation_id` は対応付け用（重複の排除はない）。submit は自動で再送しない。結果の分からない通信失敗は「送信の結果が分かりません」と表示し、今の観測を取り直す
- 二重クリック・並行送信は、画面の送信の門（閲覧者とホストで共有）と接続層の鍵で防ぐ
- 更新の番号はエンジンの `number`（受理でだけ進む）。状態のハッシュは使わない。再取得は現在の view を基準にし、接続前の秘密の情報を履歴として作らない
- 処理可能性（`supported`・`may_stop_later`・`unresolved_ruling`・`not_implemented`・`technical_limit`・`unverified`）と入力の公開区分（`input_disclosure`）を分けて表示する。未裁定・未実装を「ルール上禁止」とは表示しない。`supported` でも guarantees の範囲を超えて完走を保証しない。coverage の `complete` は「明示した種類の候補がそろう」意味で、全合法手の完成ではない

## テスト

```sh
npm test            # 接続層（pytest。実際の固定版エンジン）＋ フロントの単体テスト（vitest。模擬の応答）
npm run typecheck   # TypeScript の型検査
npm run build       # 型検査と Vite のビルド
npm run e2e         # 実エンジンへのブラウザの接続確認（Playwright・Edge。接続層と Vite を別のポートで自動起動）
# 本番ビルドで: npm run build のあと、web で KYUURA_E2E_PREVIEW=1 npx playwright test e2e/card-images.spec.ts e2e/turn-basics.spec.ts e2e/attacks.spec.ts
```

- フロントの単体テストは模擬の応答を使います。実エンジンとの接続確認（`server/tests`・`web/e2e`）とは別です
- カード画像の単体テストは、実際の renderer の変換（`src/cards/realRenderer.test.ts`。jsdom には Canvas 2D がないので描画はしない）と、模擬の描画で非同期の扱いを確かめる部品のテスト（`CardImages.test.tsx`・`AppCardImages.test.tsx`）に分けています。実際の描画は `e2e/card-images.spec.ts`（実 renderer・実エンジン。素材画像・カード定義の遅れと失敗はブラウザの通信の差し替えで作る）
- e2e の接続層はテスト専用の設定で seed を固定して起動します（`web/playwright.config.ts` の `E2E_FIXED_SEED`。21）。ランダムな対戦を作り直して探すことはしません。`e2e/attacks.spec.ts`（プリセットのデッキでジャブ → 番の移り → きぜつ → サイド → 終局、ファイヤーのデッキ `ES2-005 4`・`PMCG1-098 56` 対 プリセットの 1 番目でドライアップ → 対象の決定 → 受理のあと停止、狭い画面）・`e2e/turn-basics.spec.ts`・`e2e/card-images.spec.ts`・`e2e/local-flow.spec.ts` の準備と番を終えるまでは、**通常の new_game からの画面の操作の列**です。`e2e/local-flow.spec.ts` の決定待ち・停止・サドン・デスは**検証用の固定例**（記録した操作の列を接続層が再生した盤面）です。構築盤面（エンジンのテストの直接作った盤面）は使っていません
- エンジン側の全体テスト・状態の監査・lockstep・大規模対戦は実行しません
- lint（ESLint など）の仕組みはこのリポジトリにありません。TypeScript の型検査（`strict`・`noUncheckedIndexedAccess`）と単体テストで確かめています

## エンジンの更新の手順

1. 新しい固定コミットを決め、公開済みの完全なハッシュにする
2. `server/requirements.txt` のコミットと `contract/kyuura-client-api-v1.json` の `engine` を直し、`npm run setup` で入れ直す。`python -m kyuura_gui_server.engine_source` で導入元を確かめる。配布の修正だけのコミットなら、API の契約は変わったものとして扱わない
3. エンジンの文書（`docs/client-api-*.md`・`docs/legal-actions-*.md`）と `kyuura_engine/client_api.py`・`legal_actions.py` の差分を読む。契約の識別・形式の版（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）が変わったら、`web/src/api/types.ts`・`validate.ts` を直す（知らない版は画面が「不明な応答」として止まる）
4. 区分の値（処理可能性・状況・候補の種類・拒否のコードなど）が変わったら `contract/kyuura-client-api-v1.json` を直す。`server/tests/test_contract.py` がエンジンの定数と照らす
5. 検証用の固定例の互換性を確かめる: 古いエンジンの環境と新しいエンジンの環境で `server/tools/scenario_views.py` を実行し、各時点の全入口の観測（`views`）を比べる。同じなら固定例の JSON の `compatibility` に確かめた結果を追記する（記録を作ったエンジン `engine_commit` は書き換えない）。違うときだけ、新しい固定コミットを checkout したエンジンの作業ツリーで `server/tools/build_scenarios.py --engine <作業ツリー>` で作り直し、`views_sha256` を入れ直して差分を確かめる。e2e の seed（21）で同じ操作に届くかも `server/tests/test_turn_basics.py`・`server/tests/test_attacks.py` で確かめる（届かなければ seed を探し直し、`conftest.py` と `playwright.config.ts` をそろえる）
6. `npm test`・`npm run typecheck`・`npm run e2e` を通す
7. 新しい操作の種類（U7-5 など）が加わったら、[docs/engine-contract.md](docs/engine-contract.md) の「次の操作の種類への対応」に従う。画面を作るまでは `gui_operable_kinds` に入れない（候補は表示だけ）
8. カード画像: 同梱データの形式（`kyuura_cards.json` の `format`）・記録の項目が変わっていないかを確かめる。`python -m kyuura_gui_server.card_definitions`（`server` で実行）で `omitted` が 0 であること、`server/tests/test_card_definitions.py` が通ることを確かめる。形式が変わったら `contract/kyuura-gui-card-definitions-v2.json` と写す項目（`card_definitions.py`・`web/src/cards/definitions.ts`）を直し、`schema_version` を上げる

## renderer の更新の手順

1. renderer の README・`src/lib/index.ts` の公開の export・`fromEngineCard` の入力の型（`EngineCardRecord`）・`renderToCanvas` の約束（`true`・`false`・reject、キャンセルとピクセル）の差分を読む。main の先頭へは自動で追従しない
2. 公開済みの完全なコミットを決め、`web` で `npm install --save-exact "github:moheronemy/kyuura-card-renderer#<40 桁>"`。`npm approve-scripts kyuura-card-renderer` で `allowScripts` を新しいコミットに直す（`prepare` の内容を確かめてから）
3. `contract/kyuura-gui-card-definitions-v2.json` の `renderer.commit` を直す（`server/tests/test_card_definitions.py` が `package.json`・lockfile と照らす）
4. `npm test`・`npm run typecheck`・`npm run build`・`npx playwright test e2e/card-images.spec.ts`（開発サーバーと `KYUURA_E2E_PREVIEW=1` の本番ビルド）を通す

## 制限

- 単一の対戦だけ。永続化・オンラインの再接続・認証・通信の暗号化・重複の排除はない
- エンジンの対戦ログ（`visible_log`）は client_api 形式 1 の応答に含まれないため、ログ欄は閲覧者に届いた公開の更新の要約（段階・番・入力待ち・公開の枚数・停止・結果）で、完全な対戦ログではない（ワザのコインの結果・ダメージの計算の経過などは載らない。受理のあとの状態は観測で表示する）
- カード画像は非公式のカード風の画像（イラスト枠は白・エネルギーは仮の表示・ベイビィはたねの枠）。実際のカードの画像ではない。描けないときは文字の表示。カード名はエンジンの同梱のカードデータの表
- 本番ビルドは Web フォント（Noto Sans JP の文字の範囲ごとのファイル）と素材画像を含むため大きい（約 21 MB・548 ファイル。フォントは使う文字の範囲だけを読み込む）
- デッキの検査はエンジンの `deck_problems` の結果をそのまま表示する。広いデッキビルダーはない
- パッケージの公開・外部公開・デプロイはしない
