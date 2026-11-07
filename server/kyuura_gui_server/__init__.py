"""kyuura-engine-gui のローカル接続層（ClientHub を包む薄い層）。

ローカルの一台の端末で両プレイヤーを切り替えて確かめるためのもの。認証済みのオンライン対戦・公開サーバーではない。
ゲーム規則・合法性の判定・カード効果を再実装しない（判定はすべて kyuura_engine.client_api）。
"""

GUI_SERVER_FORMAT = 1
