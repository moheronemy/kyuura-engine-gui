"""0.183.0 の読み取りの要求 ``log`` の応答を、エンジンの契約（docs/client-api-visible-log-v0.183.md 2 章。契約の表の ``log``）どおりか確かめる。

接続層は log を貯めない・作らない・書きかえない（貯めるのは ClientHub）。既存の主体別の口（``POST /api/seat/{token}``・``/api/host/{token}``）が
エンジンの入口から受け取った応答を、ブラウザへ返す前にこの関数で確かめ、合わなければ返さない（``GUI_LOG_RESPONSE_INVALID``）。
完全な記録・内部の状態・カードの対応表は読まない。log のために candidates・inputs・check を呼ばない。

確かめること:

- 誤りの応答（ok が偽）は封筒と ``error`` の ``code``・``message`` だけ（エンジンの診断はそのまま渡す）
- 受理の応答の項目はちょうど ``contract``・``format``・``type``・``ok``・``entries``・``next``・``end``・``complete``・``baseline_end``
- ``entries`` は最大 256。各項目はちょうど ``segment``・``log_index``・``event``（``event`` はオブジェクトで ``kind`` が文字列）
- 位置（``next``・``end``・``baseline_end`` と各項目）は 0 以上 2**31 未満の整数（真偽は整数として扱わない）
- 位置の連続: 最初の項目は要求の ``from``（省けば (0, 0)）か、その後ろの区間の 0 番。続く項目は同じ区間の次の番号か、後ろの区間の 0 番。
  ``next`` は最後の項目の次（か後ろの区間の 0 番）。項目がなければ ``from`` か後ろの区間の 0 番
- ``complete`` は ``next == end``。項目が 256 未満なら complete。``next``・``baseline_end`` は ``end`` を越えない
"""

from __future__ import annotations

from typing import Any

from kyuura_engine.client_api import MAX_LOG_ENTRIES

POSITION_KEYS = frozenset({"segment", "index"})
POSITION_LIMIT = 2**31
RESPONSE_KEYS = frozenset({"contract", "format", "type", "ok", "entries", "next", "end", "complete", "baseline_end"})
ERROR_KEYS = frozenset({"contract", "format", "type", "ok", "error"})
ENTRY_KEYS = frozenset({"segment", "log_index", "event"})


def _int(value: Any) -> bool:
    return type(value) is int and 0 <= value < POSITION_LIMIT


def _position(value: Any) -> tuple[int, int] | None:
    if isinstance(value, dict) and set(value) == POSITION_KEYS and _int(value["segment"]) and _int(value["index"]):
        return value["segment"], value["index"]
    return None


def _follows(prev: tuple[int, int], here: tuple[int, int]) -> bool:
    """``here`` が位置 ``prev``（「その番号の出来事の前」）に続く位置か: 同じ位置か、後ろの区間の 0 番。"""
    return here == prev or (here[0] > prev[0] and here[1] == 0)


def log_response_problems(answer: Any, request: Any) -> list[str]:
    """log の応答の契約の問題（なければ空）。``request`` はブラウザから受けた要求（from の値を位置の確かめに使う）。"""
    if not isinstance(answer, dict) or answer.get("type") != "log" or type(answer.get("ok")) is not bool:
        return ["$"]
    if answer["ok"] is False:
        error = answer.get("error")
        if set(answer) != ERROR_KEYS or not isinstance(error, dict) or set(error) != {"code", "message"} or not all(isinstance(error[k], str) for k in error):
            return ["$.error"]
        return []
    if set(answer) != RESPONSE_KEYS:
        return ["$ の項目"]
    problems: list[str] = []
    nxt, end, base = _position(answer["next"]), _position(answer["end"]), _position(answer["baseline_end"])
    for name, pos in (("next", nxt), ("end", end), ("baseline_end", base)):
        if pos is None:
            problems.append(f"$.{name}")
    entries = answer["entries"]
    if not isinstance(entries, list) or len(entries) > MAX_LOG_ENTRIES:
        problems.append("$.entries")
        return problems
    start = _position(request.get("from")) if isinstance(request, dict) and "from" in request else (0, 0)
    if start is None:
        return problems + ["$（要求の from が位置でないのに受理の応答）"]
    cursor = start
    for i, entry in enumerate(entries):
        where = f"$.entries[{i}]"
        if not isinstance(entry, dict) or set(entry) != ENTRY_KEYS or not _int(entry["segment"]) or not _int(entry["log_index"]):
            problems.append(where)
            return problems
        event = entry["event"]
        if not isinstance(event, dict) or not isinstance(event.get("kind"), str):
            problems.append(f"{where}.event")
        here = (entry["segment"], entry["log_index"])
        if not _follows(cursor, here):
            problems.append(f"{where} の位置")
            return problems
        cursor = (here[0], here[1] + 1)
    if problems or None in (nxt, end, base):
        return problems
    if not _follows(cursor, nxt):
        problems.append("$.next の位置")
    if type(answer["complete"]) is not bool or answer["complete"] != (nxt == end):
        problems.append("$.complete")
    elif not answer["complete"] and len(entries) < MAX_LOG_ENTRIES:
        problems.append("$.complete（256 件未満で続きがある）")
    if nxt > end or base > end:
        problems.append("$.end")
    return problems
