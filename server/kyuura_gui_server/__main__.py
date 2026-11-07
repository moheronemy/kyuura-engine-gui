"""ローカル接続層を起動する（127.0.0.1 だけで待ち受ける）。

    python -m kyuura_gui_server            # 既定のポート 8765
    python -m kyuura_gui_server --port 8800

公開サーバーとして使わない（認証・通信の暗号化・重複の排除・永続化はない）。待ち受けの住所は変えられないようにしている。
"""

from __future__ import annotations

import argparse
import logging

import uvicorn

HOST = "127.0.0.1"


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description="kyuura-engine-gui のローカル接続層（127.0.0.1 だけ）")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)
    uvicorn.run("kyuura_gui_server.app:app", host=HOST, port=args.port, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
