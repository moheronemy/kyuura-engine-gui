"""ローカル対戦の保持（ClientHub と各入口のローカル用の関連付け）。

この層の責任（README「接続層の責任」）:

- ClientHub の作成と保持。初版は単一の対戦だけを持ち、新しい対戦を作ると古い対戦（hub・入口・更新）を捨てる
- プレイヤー 0・1・観戦者・ホストの入口を Python 側で持ち、ブラウザには **ローカル用の関連付けの識別子** だけを渡す。
  これは本人確認・認証ではない（同じ端末の画面の切り替えに使うだけ。公開サーバーの権限制御に流用しない）
- 要求（JSON のオブジェクト）を、識別子に結びついた入口の ``handle`` へそのまま渡し、応答をそのまま送り手へ返す。
  要求に actor・viewer を書いて主体を選ぶ口は作らない（書けばエンジンが ``CLIENT_FIELD_UNKNOWN`` で拒否する）
- 閲覧者ごとの公開の更新を、各要求のあとで hub から取り出し、閲覧者ごとの上限つきの箱に入れる
- 同じ対戦への操作を 1 つずつ処理する（対戦ごとの鍵）

ClientHub の内部（``_host``・``_state`` など）には触れない。使うのは ``ClientHub.start``・``ClientHub.from_state``・
``player``・``spectator``・``host`` と入口の ``handle`` だけ。
"""

from __future__ import annotations

import secrets
import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable

from kyuura_engine.client_api import CONTRACT, FORMAT, ClientHub

SEAT_PLAYER0 = "player0"
SEAT_PLAYER1 = "player1"
SEAT_SPECTATOR = "spectator"
SEAT_HOST = "host"
VIEWER_SEATS = (SEAT_PLAYER0, SEAT_PLAYER1, SEAT_SPECTATOR)
MAX_UPDATES_PER_SEAT = 100  # 閲覧者ごとに保持する公開の更新の上限（古いものから捨てる）
# ブラウザから接続層へ通す要求の種類（updates は接続層が先に取り出して保持するので、更新の取得口を使う）
PASSTHROUGH_TYPES = frozenset({"view", "candidates", "inputs", "check", "submit"})


@dataclass
class _Seat:
    name: str
    endpoint: Any
    updates: deque = field(default_factory=lambda: deque(maxlen=MAX_UPDATES_PER_SEAT))
    latest: int = 0  # この閲覧者が受け取った最新の更新の番号（エンジンの number。受理でだけ進む）


class LocalMatch:
    """1 つのローカル対戦。入口の識別子 → 入口の対応と、閲覧者ごとの更新の箱を持つ。"""

    def __init__(self, hub: ClientHub, *, origin: dict[str, Any]):
        self.match_id = secrets.token_hex(8)
        self.origin = origin  # 表示用の出どころ（new_game か固定例か。seed・デッキリストを入れない）
        self._lock = threading.Lock()
        self._closed = False
        self._seats: dict[str, _Seat] = {
            SEAT_PLAYER0: _Seat(SEAT_PLAYER0, hub.player(0)),
            SEAT_PLAYER1: _Seat(SEAT_PLAYER1, hub.player(1)),
            SEAT_SPECTATOR: _Seat(SEAT_SPECTATOR, hub.spectator()),
            SEAT_HOST: _Seat(SEAT_HOST, hub.host()),
        }
        self._tokens = {secrets.token_urlsafe(18): name for name in self._seats}

    # ------------------------------------------------------------ 関連付け

    def token_of(self, seat: str) -> str:
        return next(token for token, name in self._tokens.items() if name == seat)

    def seat_of(self, token: str) -> str | None:
        return self._tokens.get(token)

    def public_info(self) -> dict[str, Any]:
        """ブラウザ（同じ端末のローカル画面）へ渡す関連付け。識別子は認証ではない。"""
        return {"match_id": self.match_id, "origin": self.origin,
                "seats": {seat: {"token": self.token_of(seat)} for seat in VIEWER_SEATS},
                "host": {"token": self.token_of(SEAT_HOST)}}

    # ------------------------------------------------------------ 要求

    def handle(self, seat: str, request: Any, *, hook: Callable[[str], None] | None = None) -> dict[str, Any]:
        """入口へ要求を渡す（同じ対戦の要求は 1 つずつ）。応答はエンジンの応答のまま。"""
        with self._lock:
            if self._closed:
                raise MatchClosed()
            if hook is not None:
                hook("enter")
            try:
                answer = self._seats[seat].endpoint.handle(request)
            finally:
                self._drain()
                if hook is not None:
                    hook("leave")
            return answer

    def updates_after(self, seat: str, after: int) -> dict[str, Any]:
        """``after`` より新しい保持中の更新。保持の範囲より古い位置なら ``gap``（view を取り直す）。"""
        with self._lock:
            if self._closed:
                raise MatchClosed()
            self._drain()
            box = self._seats[seat]
            retained = list(box.updates)
            oldest = retained[0]["number"] if retained else box.latest + 1
            gap = after < oldest - 1 or after > box.latest
            items = [] if gap else [u for u in retained if u["number"] > after]
            return {"latest": box.latest, "oldest_retained": oldest if retained else None, "gap": gap, "updates": items}

    def close(self) -> None:
        with self._lock:
            self._closed = True
            for box in self._seats.values():
                box.updates.clear()
            self._seats.clear()
            self._tokens.clear()

    def _drain(self) -> None:
        """hub の箱から各閲覧者の更新を取り出して保持する（hub の箱を無制限に溜めない）。"""
        for box in self._seats.values():
            answer = box.endpoint.handle({"contract": CONTRACT, "format": FORMAT, "type": "updates"})
            if not answer.get("ok"):
                continue  # 処理できない結果のあとの CLIENT_GAME_UNAVAILABLE（更新は作られない）
            for update in answer["updates"]:
                box.updates.append(update)
                box.latest = max(box.latest, update["number"])


class MatchClosed(Exception):
    """新しい対戦で置き換えられた・捨てた対戦への要求。"""


class MatchRegistry:
    """単一の対戦を持つ（新しい対戦で古い対戦を捨てる）。"""

    def __init__(self):
        self._lock = threading.Lock()
        self._match: LocalMatch | None = None

    def replace(self, match: LocalMatch | None) -> None:
        with self._lock:
            old, self._match = self._match, match
        if old is not None:
            old.close()

    def resolve(self, token: str) -> tuple[LocalMatch, str] | None:
        with self._lock:
            match = self._match
        if match is None:
            return None
        seat = match.seat_of(token)
        return None if seat is None else (match, seat)

    def current(self) -> LocalMatch | None:
        with self._lock:
            return self._match
