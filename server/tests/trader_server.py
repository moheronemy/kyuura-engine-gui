"""e2e（web/e2e/trader-log.spec.ts）専用の接続層の起動の入口。テスト専用で、通常の起動（``python -m kyuura_gui_server``）とは別。

``tests/trader_boards.py`` の名前の決まった構築盤面（0.183.0 の log・交換おじさんとパソコン通信）を、このプロセスの中だけで固定例の表に加えてから、
通常と同じ app を 127.0.0.1 で待ち受ける（起動は ``tests/p6_server.py`` の main を共用）。作成の口（``POST /api/local-match``）が受け取るのは固定例の名前だけで、
任意の状態は受け取らない。

    cd server && .venv/Scripts/python -m tests.trader_server --port 8811   # Playwright の webServer が起動・終了する（KYUURA_E2E_SERVER_MODULE=tests.trader_server）
"""

from __future__ import annotations

from . import trader_boards
from .p6_server import main as _main


def main(argv=None) -> None:
    _main(argv, install=trader_boards.install, description="0.183.0 の log の構築盤面（交換おじさん・パソコン通信）の e2e 用の接続層（テスト専用。127.0.0.1 だけ）")


if __name__ == "__main__":
    main()
