"""接続層のテストの共通部品。実際の固定版のエンジン（requirements.txt の固定コミット）へつなぐ。模擬の応答は使わない。"""

from __future__ import annotations

import warnings

import pytest

warnings.filterwarnings("ignore", category=DeprecationWarning)

from fastapi.testclient import TestClient  # noqa: E402

from kyuura_gui_server.app import create_app  # noqa: E402
from kyuura_gui_server.safety import forbidden_paths  # noqa: E402

ENVELOPE = {"contract": "kyuura-client-api", "format": 1}
SECRET_WORDS = ('"seed"', '"rng', '"traceback"', "Traceback", '"state_sha256"', '"decklists"', '"commands"')


class Bridge:
    """ブラウザの代わりに HTTP の口だけを使う（接続層の内部・hub に触れない）。応答はすべて禁じた項目を確かめる。"""

    def __init__(self, client: TestClient):
        self.client = client
        self.responses: list = []

    def _keep(self, response, *, sender=False):
        body = response.json()
        self.responses.append(body)
        assert forbidden_paths(body, sender=sender) == [], forbidden_paths(body, sender=sender)
        text = response.text
        for word in SECRET_WORDS:
            assert word not in text, word
        return body

    def create(self, **body):
        return self._keep(self.client.post("/api/local-match", json=body))

    def presets(self):
        return self.client.get("/api/decks/presets").json()["presets"]

    def preset_decks(self, a=0, b=1):
        presets = self.presets()
        return [{"entries": [{"card_id": e["card_id"], "count": e["count"]} for e in presets[i]["entries"]]} for i in (a, b)]

    def seat(self, token, kind, **fields):
        return self._keep(self.client.post(f"/api/seat/{token}", json={**ENVELOPE, "type": kind, **fields}), sender=True)

    def host(self, token, kind, **fields):
        return self._keep(self.client.post(f"/api/host/{token}", json={**ENVELOPE, "type": kind, **fields}), sender=True)

    def updates(self, token, after=0, *, host=False):
        route = "host" if host else "seat"
        return self._keep(self.client.get(f"/api/{route}/{token}/updates", params={"after": after}))


@pytest.fixture()
def bridge():
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1"))


def tokens(match):
    seats = match["seats"]
    return {0: seats["player0"]["token"], 1: seats["player1"]["token"], "spectator": seats["spectator"]["token"], "host": match["host"]["token"]}


def choose(kind, stages):
    """候補の入力の制約だけから選ぶ（テストの決まった選び方。エンジンの参照クライアントと同じ考え方）。"""
    if not stages:
        return []
    stage = stages[0]
    if stage["input"] == "choose_value":
        return [stage["range"]["max"] if kind == "mulligan_draw" else stage["range"]["min"]]
    if kind == "place_starting":
        return [o["id"] for o in stage["options"] if o.get("eligible")][:2]
    return [o["id"] for o in stage["options"]][: stage["count"]["min"]]


def act(bridge, token, *, host=False, trace=None):
    """候補の 1 つめを、inputs → submit で送る。送れたら submit の応答。"""
    send = bridge.host if host else bridge.seat
    response = send(token, "candidates")["response"]
    if not response["candidates"]:
        return None
    cand = response["candidates"][0]
    inputs = send(token, "inputs", game=response["game"], revision=response["revision"], candidate=cand["id"])
    assert inputs["ok"] and "withheld" not in inputs["response"]
    choices = choose(cand["kind"], inputs["response"]["stages"])
    result = send(token, "submit", game=response["game"], revision=response["revision"], candidate=cand["id"], choices=choices,
                  operation_id=f"t-{len(bridge.responses)}")
    if trace is not None:
        trace.append((cand["kind"], result["outcome"]))
    return result
