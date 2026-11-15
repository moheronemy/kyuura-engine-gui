"""ブラウザへ返す JSON の最後の確かめ（防御の重ね。エンジンの応答はもともと安全な形だが、接続層の誤りで混ぜないため）。

エンジンの閲覧用記録の「入ってはいけない項目」（``view_record.FORBIDDEN_KEYS``。seed・乱数・確認値・traceback・コマンド・
デッキリストなど）を、ブラウザ向けの応答のどの深さにも含めない。送り手への submit の応答だけは ``operation_id`` を持ってよい
（client_api の契約。対応付け用）。

0.183.0（読み取りの要求 log。docs/engine-contract.md 25 章）: 可視ログの出来事の ``hidden``（見えない項目の名前と、並びなら枚数）は、
名前が禁じた名前と同じでも値は出ない（``game_created`` の ``{"hidden": {"seed": null}}``）。この例外は ``masked_hidden`` が
**log の応答の ``$.entries[i].event.hidden`` の位置にあり、マスクの構造として確かめた辞書**（その辞書の物そのもの）だけに限る。
確かめる構造（エンジンの ``observation.visible_event`` が作る形。閲覧用記録の検査 ``view_record._forbidden`` の値の規則より狭い）:

- 出来事の種類がエンジンの ``observation.PRIVATE_FIELDS`` にあり、``hidden`` の名前はその種類の見えない項目だけ（空でない）
- 隠した名前は、出来事の本体に残っていない
- 値は None か、真偽でない 0 以上の整数（並びの枚数）。禁じた名前と同じ名前（seed）の値は None だけ（値のある seed は通さない）

ほかの場所の ``hidden``（出来事の外・入れ子の中・log 以外の応答）と、``hidden`` の外の seed などの禁じた名前は、今までどおり拒否する。
"""

from __future__ import annotations

from typing import Any

from kyuura_engine.observation import PRIVATE_FIELDS
from kyuura_engine.view_record import FORBIDDEN_KEYS

# ブラウザ向けに加えて禁じる名前（エンジンの FORBIDDEN_KEYS にないが、接続層が混ぜてはいけないもの）
EXTRA_FORBIDDEN = frozenset({"state", "game_state", "snapshot", "replay", "exception", "stack"})
SENDER_ALLOWED = frozenset({"operation_id"})
ALL_FORBIDDEN = FORBIDDEN_KEYS | EXTRA_FORBIDDEN


def forbidden_paths(value: Any, *, sender: bool = False, path: str = "$", masks: frozenset[int] = frozenset()) -> list[str]:
    """禁じた名前の項目の場所（なければ空）。``masks`` は ``masked_hidden`` が確かめた hidden の辞書の ``id``（その辞書の中の名前だけを見ない）。"""
    forbidden = ALL_FORBIDDEN - (SENDER_ALLOWED if sender else frozenset())
    found: list[str] = []
    stack = [(path, value)]
    while stack:
        here, item = stack.pop()
        if isinstance(item, dict):
            if id(item) in masks:
                continue  # 確かめたマスクの構造（名前は隠した項目の名前。値は None か枚数だけ）
            for key, child in item.items():
                if key in forbidden:
                    found.append(f"{here}.{key}")
                stack.append((f"{here}.{key}", child))
        elif isinstance(item, list):
            for index, child in enumerate(item):
                stack.append((f"{here}[{index}]", child))
    return found


def _mask_value_ok(name: str, value: Any) -> bool:
    if value is None:
        return True
    if name in ALL_FORBIDDEN:
        return False  # 禁じた名前（seed）は名前だけ。値があれば秘密の値かもしれないので通さない
    return type(value) is int and value >= 0


def masked_hidden(answer: Any) -> tuple[list[str], frozenset[int]]:
    """log の応答の各出来事の ``hidden`` を、マスクの構造として確かめる。(問題の場所, 確かめた hidden の辞書の id)。

    見るのは ``$.entries[i].event.hidden`` だけ。ほかの位置の ``hidden`` はここで許さない（``forbidden_paths`` が普通に調べる）。"""
    problems: list[str] = []
    masks: set[int] = set()
    entries = answer.get("entries") if isinstance(answer, dict) else None
    if not isinstance(entries, list):
        return problems, frozenset()
    for i, entry in enumerate(entries):
        event = entry.get("event") if isinstance(entry, dict) else None
        if not isinstance(event, dict) or "hidden" not in event:
            continue
        where = f"$.entries[{i}].event.hidden"
        hidden, kind = event["hidden"], event.get("kind")
        fields = PRIVATE_FIELDS.get(kind, ((),))[0] if isinstance(kind, str) else ()
        if not isinstance(hidden, dict) or not hidden or not fields:
            problems.append(where)
            continue
        if any(name not in fields or name in event or not _mask_value_ok(name, value) for name, value in hidden.items()):
            problems.append(where)
            continue
        masks.add(id(hidden))
    return problems, frozenset(masks)
