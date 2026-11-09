"""e2e（web/e2e/p6.spec.ts）専用の接続層の起動の入口。テスト専用で、通常の起動（``python -m kyuura_gui_server``）とは別。

``tests/p6_boards.py`` の名前の決まった 3 つの構築盤面を、このプロセスの中だけで固定例の表に加えてから、通常と同じ app を 127.0.0.1 で待ち受ける。
作成の口（``POST /api/local-match``）が受け取るのは固定例の名前だけで、任意の状態は受け取らない。

    cd server && .venv/Scripts/python -m tests.p6_server --port 8786   # Playwright の webServer が起動・終了する（KYUURA_E2E_SERVER_MODULE=tests.p6_server）
"""

from __future__ import annotations

import argparse
import logging

import uvicorn

from kyuura_gui_server import scenarios
from kyuura_gui_server.__main__ import HOST
from kyuura_gui_server.app import create_app

from . import p6_boards


def main(argv=None, *, install=p6_boards.install, description="P6 の構築盤面の e2e 用の接続層（テスト専用。127.0.0.1 だけ）") -> None:
    """``install`` は名前の決まった構築盤面を固定例の表に加える関数（P6 は p6_boards.install、U-R3a は tests/r3a_server.py から r3a_boards.install）。"""
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)
    install(scenarios)
    uvicorn.run(create_app(), host=HOST, port=args.port, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
