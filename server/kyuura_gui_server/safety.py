"""ブラウザへ返す JSON の最後の確かめ（防御の重ね。エンジンの応答はもともと安全な形だが、接続層の誤りで混ぜないため）。

エンジンの閲覧用記録の「入ってはいけない項目」（``view_record.FORBIDDEN_KEYS``。seed・乱数・確認値・traceback・コマンド・
デッキリストなど）を、ブラウザ向けの応答のどの深さにも含めない。送り手への submit の応答だけは ``operation_id`` を持ってよい
（client_api の契約。対応付け用）。
"""

from __future__ import annotations

from typing import Any

from kyuura_engine.view_record import FORBIDDEN_KEYS

# ブラウザ向けに加えて禁じる名前（エンジンの FORBIDDEN_KEYS にないが、接続層が混ぜてはいけないもの）
EXTRA_FORBIDDEN = frozenset({"state", "game_state", "snapshot", "replay", "exception", "stack"})
SENDER_ALLOWED = frozenset({"operation_id"})


def forbidden_paths(value: Any, *, sender: bool = False, path: str = "$") -> list[str]:
    """禁じた名前の項目の場所（なければ空）。"""
    forbidden = (FORBIDDEN_KEYS | EXTRA_FORBIDDEN) - (SENDER_ALLOWED if sender else frozenset())
    found: list[str] = []
    stack = [(path, value)]
    while stack:
        here, item = stack.pop()
        if isinstance(item, dict):
            for key, child in item.items():
                if key in forbidden:
                    found.append(f"{here}.{key}")
                stack.append((f"{here}.{key}", child))
        elif isinstance(item, list):
            for index, child in enumerate(item):
                stack.append((f"{here}[{index}]", child))
    return found
