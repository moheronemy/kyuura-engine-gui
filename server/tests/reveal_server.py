"""e2e（web/e2e/reveal-identify.spec.ts・0.185.0 の web/e2e/fossil-slot.spec.ts）専用の接続層の起動の入口。テスト専用で、通常の起動（``python -m kyuura_gui_server``）とは別。

``tests/reveal_boards.py`` の名前の決まった構築盤面（0.184.0 の代表 3・0.185.0 の代表 3 と、trader_boards の 3）を、このプロセスの中だけで固定例の表に加えてから、通常と同じ app を
127.0.0.1 で待ち受ける（起動は ``tests/p6_server.py`` の main を共用）。作成の口（``POST /api/local-match``）が受け取るのは固定例の名前だけで、任意の状態は受け取らない。

    cd server && .venv/Scripts/python -m tests.reveal_server --port 8821   # Playwright の webServer が起動・終了する（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）
"""

from __future__ import annotations

from . import reveal_boards
from .p6_server import main as _main


def main(argv=None) -> None:
    _main(argv, install=reveal_boards.install, description="0.184.0・0.185.0 の見せたカードの代表の構築盤面の e2e 用の接続層（テスト専用。127.0.0.1 だけ）")


if __name__ == "__main__":
    main()
