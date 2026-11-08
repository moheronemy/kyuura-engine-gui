"""検証用の固定例を、導入済みのエンジンで再生したときの公開の応答の要約（エンジンの更新のときの互換性の確かめ）。

固定例の各時点で、client_api の公開の入口（プレイヤー0・1・観戦者・ホスト）の view と candidates の応答を集め、
取っ手の識別子（game・revision。対戦ごとに変わる値）を除いて正規化した JSON の sha256 を出す。
古いエンジンの環境と新しいエンジンの環境でこのスクリプトを実行し、値を比べる（同じなら、固定例の操作の列・到達点は変わっていない）。

    server/.venv/Scripts/python server/tools/scenario_views.py          # 各時点の sha256（JSON）
    server/.venv/Scripts/python server/tools/scenario_views.py --full   # 比べるための応答の全体（ローカルの確認用。外へ出さない）
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import kyuura_engine  # noqa: E402

from kyuura_gui_server import scenarios  # noqa: E402

ENVELOPE = {"contract": "kyuura-client-api", "format": 1}


def snapshot(scenario_id: str) -> dict:
    """固定例の時点の全入口の view・candidates（取っ手の識別子を除く）と、作成の知らせ。比べる値は scenarios.build と同じ作り方。"""
    hub, notice = _build_unverified(scenario_id)
    out = {"notice": notice, "views": scenarios.views(hub), "candidates": {}}
    for name, entry in (("player0", hub.player(0)), ("player1", hub.player(1)), ("host", hub.host())):
        out["candidates"][name] = scenarios._strip(entry.handle({**ENVELOPE, "type": "candidates"}))
    return out


def _build_unverified(scenario_id: str):
    """記録の views_sha256 と照らさずに作る（照らす値そのものを作るため）。"""
    original = scenarios._verify_views
    scenarios._verify_views = lambda *args: None
    try:
        return scenarios.build(scenario_id)
    finally:
        scenarios._verify_views = original


digest = scenarios.digest


def main() -> int:
    full = "--full" in sys.argv
    result = {"engine_version": kyuura_engine.__version__, "points": {}}
    for scenario_id in scenarios.SCENARIOS:
        snap = snapshot(scenario_id)
        result["points"][scenario_id] = snap if full else {k: digest(v) for k, v in snap.items()}
    print(json.dumps(result, ensure_ascii=False, indent=1 if not full else None))
    return 0


if __name__ == "__main__":
    sys.exit(main())
