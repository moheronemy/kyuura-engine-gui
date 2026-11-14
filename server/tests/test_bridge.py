"""接続層: 実際の固定版のエンジンへの接続・入口の分離・拒否・直列化・ブラウザ向けの応答。"""

from __future__ import annotations

import threading
import time

import kyuura_engine
from kyuura_engine.client_api import ClientHub
from kyuura_gui_server import local_match
from kyuura_gui_server.local_match import LocalMatch
from kyuura_gui_server.safety import forbidden_paths

from .conftest import ENVELOPE, act, tokens

import json as _json
from pathlib import Path as _Path

EXPECTED_VERSION = _json.loads((_Path(__file__).resolve().parents[2] / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))["engine"]["version"]



def test_pinned_engine_is_used(bridge):
    health = bridge.client.get("/api/health").json()
    assert (health["engine_version"], health["client_contract"], health["client_format"], health["local_only"]) == (EXPECTED_VERSION, "kyuura-client-api", 1, True)
    assert kyuura_engine.__version__ == EXPECTED_VERSION == "0.181.0"


def test_full_local_flow_until_game_over(bridge):
    """new_game → 両者の初期配置 → 補償 → ホストのジャンケン → 番を終えるだけで山札切れの終局まで（通常の対戦機能の完成ではない）。"""
    t = _match_that_did_not_halt_at_start(bridge)
    trace = []
    for _ in range(400):
        view = bridge.seat(t["spectator"], "view")
        if view["status"]["status"] in ("game_over", "halted"):
            break
        if any(act(bridge, t[p], trace=trace) for p in (0, 1)):
            continue
        if act(bridge, t["host"], host=True, trace=trace):
            continue
        raise AssertionError("だれにも候補がない")
    kinds = {k for k, _ in trace}
    assert {"place_starting", "report_janken", "end_turn"} <= kinds
    assert all(outcome == "accepted" for _, outcome in trace)
    assert view["status"]["status"] == "game_over" and view["observation"]["result"]["outcome"] == "win"
    accepted = len(trace)
    for seat in (0, 1, "spectator"):
        got = bridge.updates(t[seat], 0)
        assert got["latest"] == accepted and not got["gap"]
        assert [u["number"] for u in got["updates"]] == list(range(1, accepted + 1))
    # 閲覧者ごとの観測: プレイヤー 0 の更新に相手の手札の中身はない
    last = bridge.updates(t[0], accepted - 1)["updates"][0]["observation"]
    assert last["viewer"] == 0 and last["players"][1]["hand"]["cards"] is None
    host_updates = bridge.updates(t["host"], 0, host=True)
    assert host_updates["latest"] == accepted


def test_seat_and_host_entries_are_separate(bridge):
    t = _match_that_did_not_halt_at_start(bridge)
    # ホストの識別子はプレイヤーの口で、プレイヤーの識別子はホストの口で使えない
    assert bridge.client.post(f"/api/seat/{t['host']}", json={**ENVELOPE, "type": "view"}).json()["error"]["code"] == "GUI_SEAT_UNKNOWN"
    assert bridge.client.post(f"/api/host/{t[0]}", json={**ENVELOPE, "type": "view"}).json()["error"]["code"] == "GUI_SEAT_UNKNOWN"
    # 要求に actor・viewer を書いて主体を変えることはできない（エンジンが拒否する）
    for field in ("actor", "viewer"):
        assert bridge.seat(t[0], "view", **{field: 1})["error"]["code"] == "CLIENT_FIELD_UNKNOWN"
    # 観戦者は候補・送信を持たない
    assert bridge.seat(t["spectator"], "candidates")["error"]["code"] == "CLIENT_REQUEST_UNKNOWN"
    # 各入口の主体は識別子で決まる
    assert bridge.seat(t[0], "view")["viewer"] == 0 and bridge.seat(t[1], "view")["viewer"] == 1
    assert bridge.seat(t["spectator"], "view")["viewer"] == "spectator" and bridge.host(t["host"], "view")["viewer"] == "host"
    assert bridge.host(t["host"], "candidates")["response"]["actor"] == "host"
    # ホストの取っ手をプレイヤーの入口で使えない
    for p in (0, 1):
        act(bridge, t[p])
    while act(bridge, t[0]) or act(bridge, t[1]):
        pass
    r = bridge.host(t["host"], "candidates")["response"]
    assert r["candidates"][0]["kind"] == "report_janken"
    wrong = bridge.seat(t[0], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=[0])
    assert (wrong["outcome"], wrong["refusal"]["code"], wrong["refetch_required"]) == ("refused", "CANDIDATES_WRONG_ACTOR", True)
    # updates はエンジンへ通さず、接続層の保持から取る
    assert bridge.client.post(f"/api/seat/{t[0]}", json={**ENVELOPE, "type": "updates"}).json()["error"]["code"] == "GUI_USE_UPDATES_ROUTE"


def test_rejections_do_not_create_updates_for_others(bridge):
    """拒否（ホストの段の拒否・別の主体の取っ手・古い取っ手・要求の誤り）は送り手への応答だけで、他の閲覧者の更新を作らない。"""
    t = tokens(bridge.create(mode="scenario", scenario="decision")["match"])
    before = {s: bridge.updates(t[s], 0)["latest"] for s in (0, 1, "spectator")}
    r = bridge.seat(t[0], "candidates")["response"]
    assert r["candidates"][0]["kind"] == "take_prize"
    assert bridge.seat(t[0], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=["o99"])["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    assert bridge.seat(t[0], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=[])["outcome"] == "refused"
    assert bridge.seat(t[1], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=["o1"])["refusal"]["code"] == "CANDIDATES_WRONG_ACTOR"
    assert bridge.host(t["host"], "submit", game=r["game"], revision=r["revision"], candidate="c1")["refusal"]["code"] == "CANDIDATES_WRONG_ACTOR"
    assert bridge.seat(t[0], "submit", game=r["game"], revision="0" * 32, candidate="c1", choices=["o1"])["refusal"]["code"] == "CANDIDATES_STALE"
    assert bridge.seat(t[0], "submit", game="x", revision=r["revision"], candidate="c1", choices=["o1"])["refusal"]["code"] == "CANDIDATES_WRONG_GAME"
    assert bridge.seat(t[0], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=[1.5])["error"]["code"] == "CLIENT_FIELD_INVALID"
    after = {s: bridge.updates(t[s], 0)["latest"] for s in (0, 1, "spectator")}
    assert after == before
    # 拒否では取っ手は失効しない（同じ取っ手で受理できる）
    done = bridge.seat(t[0], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=["o1"], operation_id="op-7")
    assert (done["outcome"], done["refetch_required"], done["result"]["operation_id"]) == ("accepted", True, "op-7")
    for s in (0, 1, "spectator"):
        got = bridge.updates(t[s], before[s])["updates"]
        assert [u["number"] for u in got] == [before[s] + 1]
        assert "op-7" not in str(got)  # operation_id は送り手への応答だけ
    # 受理のあとは古い取っ手は失効（取り直しを求める）
    stale = bridge.seat(t[0], "submit", game=r["game"], revision=r["revision"], candidate="c1", choices=["o1"])
    assert (stale["outcome"], stale["refusal"]["code"], stale["refetch_required"]) == ("refused", "CANDIDATES_STALE", True)
    # 次は相手がバトル場に出すポケモンを選ぶ決定（決める人だけに候補）
    assert bridge.seat(t[1], "candidates")["response"]["candidates"][0]["kind"] == "promote_active"
    other = bridge.seat(t[0], "candidates")["response"]
    assert (other["candidates"], other["situation"]) == ([], "waiting_for_player")


def test_same_match_requests_are_serialized():
    """同じ対戦への要求は 1 つずつ処理する（同時に送った番を終えるのうち受理は 1 つ。handle が重ならない）。"""
    from .conftest import ENVELOPE as E

    hub, _ = ClientHub.start(*[[c for c, n in deck for _ in range(n)] for deck in _two_presets()], 3)
    match = LocalMatch(hub, origin={"kind": "test"})
    _advance_to_turn(match)
    seat = "player0" if match.handle("player0", {**E, "type": "candidates"})["response"]["candidates"] else "player1"
    r = match.handle(seat, {**E, "type": "candidates"})["response"]
    assert r["candidates"][0]["kind"] == "end_turn"
    inside, overlap, results = [0], [], []
    gate = threading.Barrier(8)

    def hook(event):
        if event == "enter":
            inside[0] += 1
            if inside[0] > 1:
                overlap.append(True)
            time.sleep(0.01)
        else:
            inside[0] -= 1

    def submit():
        gate.wait()
        results.append(match.handle(seat, {**E, "type": "submit", "game": r["game"], "revision": r["revision"], "candidate": "c1"}, hook=hook))

    threads = [threading.Thread(target=submit) for _ in range(8)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    assert overlap == []
    outcomes = sorted(x["outcome"] for x in results)
    assert outcomes.count("accepted") == 1 and outcomes.count("refused") == 7
    assert match.updates_after("spectator", 0)["latest"] == _accepted_so_far(match)


def test_new_match_discards_old_and_updates_are_bounded(bridge, monkeypatch):
    monkeypatch.setattr(local_match, "MAX_UPDATES_PER_SEAT", 5)
    first = _match_that_did_not_halt_at_start(bridge)
    for _ in range(12):
        if not (act(bridge, first[0]) or act(bridge, first[1]) or act(bridge, first["host"], host=True)):
            break
    got = bridge.updates(first["spectator"], 0)
    assert got["gap"] and got["updates"] == [] and got["latest"] >= 6  # 保持の範囲より古い位置 → view の取り直しへ
    recent = bridge.updates(first["spectator"], got["latest"] - 2)
    assert not recent["gap"] and [u["number"] for u in recent["updates"]] == [got["latest"] - 1, got["latest"]]
    second = tokens(bridge.create(mode="scenario", scenario="halt")["match"])
    for token in (first[0], first["spectator"]):
        assert bridge.client.post(f"/api/seat/{token}", json={**ENVELOPE, "type": "view"}).json()["error"]["code"] == "GUI_SEAT_UNKNOWN"
    assert bridge.client.post(f"/api/host/{first['host']}", json={**ENVELOPE, "type": "view"}).json()["error"]["code"] == "GUI_SEAT_UNKNOWN"
    assert bridge.seat(second["spectator"], "view")["status"]["status"] == "halted"


def test_fixed_examples_halt_and_sudden_death(bridge):
    halt = bridge.create(mode="scenario", scenario="halt")
    t = tokens(halt["match"])
    view = bridge.seat(t["spectator"], "view")
    assert (view["status"]["status"], view["status"]["halt"]["category"]) == ("halted", "unresolved_ruling")
    assert bridge.seat(t[0], "candidates")["response"]["empty_reason"] == "game_ended"
    sd = bridge.create(mode="scenario", scenario="sudden_death")
    assert sd["start"] is None and sd["match"]["origin"]["kind"] == "fixed_example"
    t = tokens(sd["match"])
    view = bridge.seat(t[0], "view")
    assert (view["status"]["status"], view["status"]["waiting"]) == ("sudden_death_pending", [{"kind": "start_sudden_death", "by": "host"}])
    assert bridge.seat(t[0], "candidates")["response"]["empty_reason"] == "host_operation"
    result = act(bridge, t["host"], host=True)
    assert result["outcome"] == "accepted" and result["result"]["role"] == "host"
    status = bridge.seat(t["spectator"], "view")["status"]
    assert status["segment"] == 1 and status["phase"].startswith("setup")


def test_invalid_decks_get_safe_diagnostics(bridge):
    good = bridge.preset_decks()
    bad = bridge.create(mode="decks", decks=[{"entries": [{"card_id": "PMCG1-035", "count": 10}]}, good[1]])
    assert not bad["ok"] and bad["start"]["outcome"] == "rejected" and "match" not in bad
    assert [d["code"] for d in bad["deck_diagnostics"][0]] == ["DECK_SIZE", "TOO_MANY_COPIES"] and bad["deck_diagnostics"][1] == []
    shape = bridge.client.post("/api/local-match", json={"mode": "decks", "decks": [{"entries": [{"card_id": 5, "count": 1}]}, good[1]]}).json()
    assert shape["error"]["code"] == "GUI_DECK_INPUT_INVALID"
    unknown = bridge.client.post("/api/local-match", json={"mode": "decks", "decks": good, "seed": 1}).json()
    assert unknown["error"]["code"] == "GUI_FIELD_INVALID"  # seed を外から渡す口はない
    # 正しいデッキの対戦の観測に、相手のデッキリストは入らない
    t = tokens(bridge.create(mode="decks", decks=good)["match"])
    text = bridge.client.post(f"/api/seat/{t[0]}", json={**ENVELOPE, "type": "view"}).text
    assert "entries" not in text and "deck_diagnostics" not in text


def test_safe_errors_and_local_host_only(bridge):
    assert bridge.client.post("/api/local-match", content=b"{not json").json()["error"]["code"] == "GUI_REQUEST_INVALID"
    assert bridge.client.post("/api/local-match", content=b"x" * 40000).json()["error"]["code"] == "GUI_REQUEST_INVALID"
    from fastapi.testclient import TestClient
    from kyuura_gui_server.app import create_app

    remote = TestClient(create_app(), base_url="http://evil.example").get("/api/health")
    assert remote.status_code == 403 and remote.json()["error"]["code"] == "GUI_HOST_FORBIDDEN"


def test_forbidden_key_scan():
    assert forbidden_paths({"a": [{"seed": 1}]}) == ["$.a[0].seed"]
    assert forbidden_paths({"operation_id": "x"}) == ["$.operation_id"]
    assert forbidden_paths({"operation_id": "x"}, sender=True) == []


# ---------------------------------------------------------------- 補助


def _match_that_did_not_halt_at_start(bridge):
    """seed は接続層が決める（外から渡せない）。準備の段階でエンジンが止める seed もある（切り直しの補償が記録で決まらない）ので、
    開始直後に停止した対戦は停止の表示を確かめてから作り直す。"""
    for _ in range(20):
        created = bridge.create(mode="decks", decks=bridge.preset_decks())
        assert created["ok"] and created["start"]["outcome"] == "accepted"
        t = tokens(created["match"])
        status = bridge.seat(t["spectator"], "view")["status"]
        if status["status"] != "halted":
            return t
        assert status["halt"]["category"] and status["waiting"] == []
    raise AssertionError("20 回とも準備で停止した")


def _two_presets():
    from kyuura_engine import preset_deck

    return [preset_deck("hitmonchan-dewgong").entries, preset_deck("venusaur-parasect").entries]


def _advance_to_turn(match):
    from .conftest import choose

    for _ in range(40):
        moved = False
        for seat in ("player0", "player1", "host"):
            r = match.handle(seat, {**ENVELOPE, "type": "candidates"})["response"]
            if not r["candidates"] or r["candidates"][0]["kind"] == "end_turn":
                continue
            c = r["candidates"][0]
            stages = match.handle(seat, {**ENVELOPE, "type": "inputs", "game": r["game"], "revision": r["revision"], "candidate": c["id"]})["response"]["stages"]
            res = match.handle(seat, {**ENVELOPE, "type": "submit", "game": r["game"], "revision": r["revision"], "candidate": c["id"],
                                      "choices": choose(c["kind"], stages)})
            assert res["outcome"] == "accepted"
            moved = True
            break
        if not moved:
            return
    raise AssertionError("番に届かない")


def _accepted_so_far(match):
    return match.updates_after("player0", 0)["latest"]
