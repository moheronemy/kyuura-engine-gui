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
    # 番では「番を終える」を選ぶ（公開の kind で選ぶ。並びの先頭に依存しない）。番以外は候補が 1 つ
    cand = next((c for c in response["candidates"] if c["kind"] == "end_turn"), response["candidates"][0])
    inputs = send(token, "inputs", game=response["game"], revision=response["revision"], candidate=cand["id"])
    assert inputs["ok"] and "withheld" not in inputs["response"]
    choices = choose(cand["kind"], inputs["response"]["stages"])
    result = send(token, "submit", game=response["game"], revision=response["revision"], candidate=cand["id"], choices=choices,
                  operation_id=f"t-{len(bridge.responses)}")
    if trace is not None:
        trace.append((cand["kind"], result["outcome"]))
    return result


# ---------------------------------------------------------------- seed を固定した new_game（テスト専用の設定。e2e と同じ seed・同じ選び方）

FIXED_SEED = 21  # プリセットの 1・2 番目のデッキ、下の選び方で: 補償 1 回 → 番 1 にベンチ・エネルギー → 番 3 に進化・にげる（web/playwright.config.ts と同じ）


@pytest.fixture()
def fixed_bridge():
    return Bridge(TestClient(create_app(fixed_seed=FIXED_SEED), base_url="http://127.0.0.1"))


def candidate_of(response, kind):
    """公開の kind で候補を選ぶ（c1 などの番号・並びの先頭に依存しない）。"""
    return next((c for c in response["candidates"] if c["kind"] == kind), None)


def send_kind(bridge, token, kind, pick, *, host=False, check=True):
    """kind の候補の inputs を取り、pick(stages) で選び、check → submit。(check の応答, submit の応答)。"""
    call = bridge.host if host else bridge.seat
    response = call(token, "candidates")["response"]
    cand = candidate_of(response, kind)
    assert cand is not None, (kind, [c["kind"] for c in response["candidates"]])
    handle = {"game": response["game"], "revision": response["revision"], "candidate": cand["id"]}
    stages = call(token, "inputs", **handle)["response"]["stages"]
    choices = pick(stages)
    checked = call(token, "check", **handle, choices=choices) if check else None
    result = call(token, "submit", **handle, choices=choices, operation_id=f"t-{len(bridge.responses)}")
    return checked, result


def first_eligible(stage):
    return next(o["id"] for o in stage["options"] if o.get("eligible", True))


MOLTRES_DECK = {"entries": [{"card_id": "ES2-005", "count": 4}, {"card_id": "PMCG1-098", "count": 56}]}  # ファイヤー（ドライアップ）4 枚・炎エネルギー 56 枚


def reach_first_turn(bridge, decks=None):
    """固定の seed の new_game を、e2e と同じ選び方でプレイヤー0の最初の番まで進める（初期配置: 最初の eligible だけ、補償: 最大、ジャンケン: 0）。"""
    created = bridge.create(mode="decks", decks=decks or bridge.preset_decks())
    assert created["ok"] and created["start"]["status"] != "halted"
    t = tokens(created["match"])
    for seat in (0, 1):
        _, result = send_kind(bridge, t[seat], "place_starting", lambda s: [first_eligible(s[0])])
        assert result["outcome"] == "accepted"
    mulligans = 0
    for seat in (0, 1):
        while candidate_of(bridge.seat(t[seat], "candidates")["response"], "mulligan_draw"):
            _, result = send_kind(bridge, t[seat], "mulligan_draw", lambda s: [s[0]["range"]["max"]])
            assert result["outcome"] == "accepted"
            mulligans += 1
    _, result = send_kind(bridge, t["host"], "report_janken", lambda s: [0], host=True)
    assert result["outcome"] == "accepted"
    t["mulligans"] = mulligans
    return t
