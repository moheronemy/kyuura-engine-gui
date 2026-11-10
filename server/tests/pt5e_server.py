"""e2e（web/e2e/pt5e.spec.ts）専用の接続層の起動の入口。テスト専用で、通常の起動（``python -m kyuura_gui_server``）とは別。

``tests/pt5e_boards.py`` の名前の決まった構築盤面を、このプロセスの中だけで固定例の表に加えてから、通常と同じ app を 127.0.0.1 で待ち受ける
（起動は ``tests/p6_server.py`` の main を共用）。作成の口（``POST /api/local-match``）が受け取るのは固定例の名前だけで、任意の状態は受け取らない。

    cd server && .venv/Scripts/python -m tests.pt5e_server --port 8791   # Playwright の webServer が起動・終了する（KYUURA_E2E_SERVER_MODULE=tests.pt5e_server）
"""

from __future__ import annotations

from . import pt5e_boards
from .p6_server import main as _main


def main(argv=None) -> None:
    _main(argv, install=pt5e_boards.install, description="PT-5e の構築盤面の e2e 用の接続層（テスト専用。127.0.0.1 だけ）")


if __name__ == "__main__":
    main()
