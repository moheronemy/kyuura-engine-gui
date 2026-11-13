"""e2e（web/e2e/f1.spec.ts）専用の接続層の起動の入口。テスト専用で、通常の起動（``python -m kyuura_gui_server``）とは別。

``tests/f1_boards.py`` の名前の決まった構築盤面（P6 の 3 つと F-1 の 2 つ）を、このプロセスの中だけで固定例の表に加えてから、通常と同じ app を 127.0.0.1 で待ち受ける。
作成の口（``POST /api/local-match``）が受け取るのは固定例の名前だけで、任意の状態は受け取らない。

    cd server && .venv/Scripts/python -m tests.f1_server --port 8795   # Playwright の webServer が起動・終了する（KYUURA_E2E_SERVER_MODULE=tests.f1_server）
"""

from __future__ import annotations

from . import f1_boards
from .p6_server import main as p6_main


def main(argv=None) -> None:
    p6_main(argv, install=f1_boards.install, description="F-1 の構築盤面の e2e 用の接続層（テスト専用。127.0.0.1 だけ）")


if __name__ == "__main__":
    main()
