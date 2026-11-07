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
  e2e/           実エンジンへのブラウザの接続確認（Playwright）
server/    ローカル接続層（Python・FastAPI）。ClientHub を包む薄い層。127.0.0.1 だけで待ち受ける
  kyuura_gui_server/  app.py（HTTP の口）・local_match.py（入口の保持・直列化・更新の保持）・decks.py・scenarios.py・safety.py
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

- **版**: kyuura-engine 0.164.0（`kyuura_engine.__version__`・配布メタデータの版）。API の契約（`kyuura-client-api`・形式 1）とあわせて、画面が前提にする機能の範囲を表す
- **完全なコミット**: `ffcc5cab5df1ebde0faed3fd23b481295374e1f9`（公開ブランチ `claude/packaging-subpackages` の先頭）。導入する中身を一意に決める。同じ版の番号 0.164.0 で中身の違う配布物（配布の修正の前と後）があるため、固定にはコミットを使う
- 依存の定義: [`server/requirements.txt`](server/requirements.txt)（Git の URL からの通常のインストール）
  ```
  kyuura-engine @ git+https://github.com/moheronemy/kyuura-engine@ffcc5cab5df1ebde0faed3fd23b481295374e1f9
  ```
- 導入元の確かめ: 接続層のテスト（`server/tests/test_contract.py`）と `python -m kyuura_gui_server.engine_source` が、配布メタデータの `direct_url.json`（`vcs_info.vcs` が git・`vcs_info.commit_id` が上のコミット・編集可能でない）と版 0.164.0、読み込んだ `kyuura_engine` が site-packages の導入物であることを確かめる。確認できなければ失敗する
- 固定先は自動で変えない（エンジンの main の先頭・別のマージコミットへ追従しない）。変えるときは「エンジンの更新の手順」に従う

### 通常の利用と開発用の編集可能インストール

- **通常の利用**（GUI を動かす・テストする）: 上の通常のインストールだけを使う（`npm run setup`）。エンジンのソースの clone は要らない
- **エンジン自体を同時に開発する場合**だけ、手元のエンジンの作業ツリーを編集可能で入れてよい（`server/.venv` の Python で `python -m pip install -e <エンジンの作業ツリー>`）。この状態では導入元の確かめ（`test_engine_identity`）が「編集可能インストール」として失敗するので、GUI の確認の前に `npm run setup` で通常のインストールへ戻す

### 古い仮想環境からの切り替え

以前の版の GUI（`-e git+…@d0c5cfa…` の編集可能インストール）で作った `server/.venv` は、次のどちらかで切り替える。

1. そのまま入れ直す: `npm run setup`（pip 26.3 で、編集可能の導入が通常の導入に置きかわることを確かめた）。残った古い clone `server/.venv/src/kyuura-engine` はもう読み込まれないので、不要なら消してよい
2. 作り直す: `server/.venv` を消してから `npm run setup`

どちらも最後に確かめる:

```sh
# Windows は server\.venv\Scripts\python
cd server && .venv/bin/python -m kyuura_gui_server.engine_source
# → {"install": "git", "commit_id": "ffcc5cab5df1ebde0faed3fd23b481295374e1f9", "version": "0.164.0", "module": ".../site-packages/kyuura_engine/__init__.py"}
```

## 導入と起動

```sh
npm run setup     # server/.venv を作り、固定版エンジン・FastAPI などを入れ、web の npm の依存を入れる（グローバルには入れない）
npm run dev       # 接続層（127.0.0.1:8765）と Vite（127.0.0.1:5173）を一緒に起動。Ctrl+C で両方止まる
```

ブラウザで <http://127.0.0.1:5173/> を開きます。

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
| 番 | 番を終える | プレイヤー |
| 決定 | 決定への回答（サイドを取る・バトル場に出す・その他の決定。単一・複数・順序付き・辞退・0 枚） | 決める人 |
| 停止・終局 | 停止の診断・終局の結果の表示 | すべて |
| サドン・デス | 延長戦の開始 | **ローカルホスト（別枠）** |

表示: 相手のバトル場・ベンチ・各領域の公開枚数、自分のバトル場・ベンチ・手札、HP・ダメージ・特殊状態・エネルギー、段階・入力待ちの主体、操作候補と処理可能性・保証の範囲・入力の公開区分、coverage（対応範囲と未対応の種類）、診断、閲覧者に届いた公開の更新の要約。

## 未対応の操作

現行の API（U7-1・U7-2）が候補に出さない、番の通常の操作は **作っていません**: たねポケモンをベンチに出す・エネルギーをつける・進化・にげる・ワザ・トレーナー・ポケモンパワー・スタジアム・ばけるを外す・場のカードをトラッシュ・裏のカードを表にする・表向きの山札のカードの確認。画面では coverage の `not_covered_kinds` として「未対応（ゲーム上の禁止ではない）」と表示し、ワザ名などは表示だけです。ダミーの対戦処理はありません。

番を終えるだけで進めると山札がなくなって終局しますが、これは通常の対戦機能の完成ではありません。

決定待ち・サドン・デスへは通常の画面操作では到達できないため、**検証用の固定例**を用意しています（エンジンのテストの既存の固定例。ピカチュウのデッキ・seed 9 で受理された操作の列を接続層が公開の `new_game`・`apply_command` で再生し、`ClientHub.from_state` で包む。再生は API の外のホストの側の準備で、ブラウザへ seed・デッキリスト・操作の列は返しません）。停止の固定例は、たねポケモン 1 枚のデッキ同士（seed 1）で準備の補償が記録で決まらず停止する例です。

## 接続層の責任と HTTP の口

接続層（`server/kyuura_gui_server`）は ClientHub を包む薄い層です。

- ClientHub の作成と保持。初版は単一の対戦だけを持ち、新しい対戦を作ると古い対戦（hub・入口・更新）を捨てる
- プレイヤー0・1・観戦者・ホストの入口を Python 側で保持し、ブラウザにはローカル用の関連付けの識別子だけを渡す。ホストは別の口
- 要求に actor・viewer を書いて主体を選ぶ口はない（書けばエンジンが `CLIENT_FIELD_UNKNOWN`）
- 要求（client_api の JSON）を入口の `handle` へそのまま渡し、応答を送り手へそのまま返す
- 閲覧者ごとの公開の更新を、要求のたびに hub から取り出して上限つき（閲覧者ごと 100 件）で保持する。保持の範囲より古い位置は `gap` で、view の取り直しへ誘導する
- 同じ対戦への要求を対戦ごとの鍵で 1 つずつ処理する
- 誤りは決まった文（`GUI_*`）。例外の文・traceback を返さない。ブラウザ向けの応答に、エンジンの閲覧用記録の禁止項目（seed・乱数・確認値・コマンド・デッキリストなど）が入っていないことを最後に確かめる
- seed は接続層が `secrets` で決め、返さない・受け取らない
- ClientHub の内部状態には触れない（使うのは `start`・`from_state`・`player`・`spectator`・`host`・入口の `handle` だけ）

| 口 | 内容 |
|---|---|
| `GET /api/health` | 接続層・エンジンの版、契約の識別 |
| `GET /api/decks/presets` | エンジンの固定デッキ（サンプル）と規約集合 |
| `GET /api/cards` | カード名の表（ID・日本語名・分類・段階・HP） |
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
```

- フロントの単体テストは模擬の応答を使います。実エンジンとの接続確認（`server/tests`・`web/e2e`）とは別です
- エンジン側の全体テスト・状態の監査・lockstep・大規模対戦は実行しません

## エンジンの更新の手順

1. 新しい固定コミットを決め、公開済みの完全なハッシュにする
2. `server/requirements.txt` のコミットと `contract/kyuura-client-api-v1.json` の `engine` を直し、`npm run setup` で入れ直す。`python -m kyuura_gui_server.engine_source` で導入元を確かめる。配布の修正だけのコミットなら、API の契約は変わったものとして扱わない
3. エンジンの文書（`docs/client-api-*.md`・`docs/legal-actions-*.md`）と `kyuura_engine/client_api.py`・`legal_actions.py` の差分を読む。契約の識別・形式の版（`kyuura-client-api`・1、`kyuura_legal_actions_format` 1、`kyuura_diagnostic_schema` 1）が変わったら、`web/src/api/types.ts`・`validate.ts` を直す（知らない版は画面が「不明な応答」として止まる）
4. 区分の値（処理可能性・状況・候補の種類・拒否のコードなど）が変わったら `contract/kyuura-client-api-v1.json` を直す。`server/tests/test_contract.py` がエンジンの定数と照らす
5. 検証用の固定例を作り直す: 新しい固定コミットを checkout したエンジンの作業ツリーを用意し（エンジンのテストのモジュールは配布物に入らないため）、`server/.venv/Scripts/python server/tools/build_scenarios.py --engine <作業ツリー>`（macOS・Linux は `server/.venv/bin/python`）。差分を確かめる
6. `npm test`・`npm run typecheck`・`npm run e2e` を通す
7. 新しい操作の種類（U7-3 以後）が加わったら、[docs/engine-contract.md](docs/engine-contract.md) の「U7-3 以後への対応」に従う

## 制限

- 単一の対戦だけ。永続化・オンラインの再接続・認証・通信の暗号化・重複の排除はない
- エンジンの対戦ログ（`visible_log`）は client_api 形式 1 の応答に含まれないため、ログ欄は閲覧者に届いた公開の更新の要約（段階・番・入力待ち・公開の枚数・停止・結果）
- カード画像は使わない（テキストの表示）。カード名はエンジンの同梱のカードデータの表
- デッキの検査はエンジンの `deck_problems` の結果をそのまま表示する。広いデッキビルダーはない
- パッケージの公開・外部公開・デプロイはしない
