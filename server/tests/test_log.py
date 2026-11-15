"""0.183.0 の読み取りの要求 log を、接続層の既存の主体別の口（``POST /api/seat/{token}``・``/api/host/{token}``）がエンジンの入口へ渡し、
契約の形と出来事の hidden のマスクを確かめてから返すこと（実際の固定版のエンジン。模擬の応答を使わない。docs/engine-contract.md 25 章）。

- 盤面: ``tests/trader_boards.py``（エンジンのテストの交換おじさん・パソコン通信の盤面を写した構築盤面）、``tests/keep_boards.py`` の keep_er_c、既存の固定例。
  どれも new_game からの到達ではない。操作は HTTP の口（candidates・inputs・check・submit）だけで、入力は選べるものの id と card_id だけで作る
- 状態・乱数・ログ・決定が log で変わらないことだけは、テストの中で控えた ClientHub の状態で確かめる（``test_keep.py`` と同じ）
- 安全検査（``safety.masked_hidden``・``forbidden_paths``）の正負は、実応答と、それを写して値を変えた人工の応答（出典を分けた）で確かめる
"""

from __future__ import annotations

import copy
import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.rng import rng_fingerprint
from kyuura_engine.serialize import state_to_dict

from kyuura_gui_server import local_match, scenarios
from kyuura_gui_server.app import create_app
from kyuura_gui_server.log_contract import RESPONSE_KEYS, log_response_problems
from kyuura_gui_server.safety import forbidden_paths, masked_hidden

from . import keep_boards as KB
from . import trader_boards as TB
from .conftest import ENVELOPE, tokens
from .p6_boards import install_boards

SEATS = (0, 1, "spectator", "host")
MASK_TEXT = '"hidden": {"seed": null}'


class LogBridge:
    """HTTP の口だけを使う（log の応答は禁じた名前の検査を masked_hidden の結果で行う。ほかは conftest の Bridge と同じ確かめ）。"""

    def __init__(self, client: TestClient):
        self.client = client

    def create(self, scenario):
        created = self.client.post("/api/local-match", json={"mode": "scenario", "scenario": scenario}).json()
        assert created["ok"], created
        return tokens(created["match"])

    def post(self, t, who, kind, **fields):
        route = "host" if who == "host" else "seat"
        return self.client.post(f"/api/{route}/{t[who]}", json={**ENVELOPE, "type": kind, **fields})

    def log(self, t, who, start=None, **extra):
        response = self.post(t, who, "log", **({} if start is None else {"from": start}), **extra)
        body = response.json()
        if body.get("ok") and body.get("type") == "log":
            _, masks = masked_hidden(body)
            assert forbidden_paths(body, masks=masks) == []
            assert response.text.replace(MASK_TEXT.replace(" ", ""), "").count('"seed"') == 0  # seed は確かめたマスクの名前としてだけ
        return response.status_code, body

    def read_all(self, t, who, start=None):
        pages = []
        while True:
            status, body = self.log(t, who, start)
            assert status == 200 and body["ok"], body
            pages.append(body)
            if body["complete"]:
                return [e for p in pages for e in p["entries"]], pages
            start = body["next"]

    def updates(self, t, who):
        route = "host" if who == "host" else "seat"
        return self.client.get(f"/api/{route}/{t[who]}/updates", params={"after": 0}).json()

    def act(self, t, kind, pick):
        cands = self.post(t, 0, "candidates").json()["response"]
        cand = next(x for x in cands["candidates"] if x["kind"] == kind)
        h = {"game": cands["game"], "revision": cands["revision"], "candidate": cand["id"]}
        inputs = self.post(t, 0, "inputs", **h).json()["response"]
        choices = [o for st in inputs["stages"] for o in pick(st)]
        assert self.post(t, 0, "check", **h, choices=choices).json()["response"]["valid"]
        return self.post(t, 0, "submit", **h, choices=choices, operation_id=f"t-{kind}").json()


def by_card_id(*ids, count=1):
    return lambda st: [o["id"] for o in st["options"] if o.get("card_id") in ids][:count]


@pytest.fixture()
def lb(monkeypatch):
    hubs = {}

    def capture(builder):
        def build(board_id):  # テストの中だけ: 作った ClientHub を控える（状態・乱数・ログ・決定の確かめのため）
            hub = builder(board_id)
            hubs[board_id] = hub
            return hub
        return build

    boards = {b: (TB.LABELS[b], TB.DESCRIPTION, capture(TB.build)) for b in TB.LABELS}
    boards["keep_er_c"] = (KB.LABELS["keep_er_c"], KB.DESCRIPTION, capture(KB.build))
    install_boards(scenarios, boards, monkeypatch)
    return LogBridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def full(hub):
    state = hub._state()
    exported = json.dumps(state_to_dict(state, format_version=22), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(exported.encode()).hexdigest(), rng_fingerprint(state.rng), len(state.log), state.decision.id if state.decision else None


def trader_events(entries):
    return [(e["event"]["kind"], e["event"].get("card_id")) for e in entries if e["event"]["kind"] in ("return_to_deck", "reveal_from_deck")]


# ---------------------------------------------------------------- 主体別の取得（実応答）


def test_trader_cards_are_identified_for_every_viewer_when_shown(lb):
    b, hubs = lb
    t = b.create("trader_log")
    for who in SEATS:
        entries, pages = b.read_all(t, who)
        assert entries == [] and pages[0]["baseline_end"] == pages[0]["end"] == {"segment": 0, "index": 0}
    assert b.act(t, "play_trainer", by_card_id(TB.POKEMON_TRADER))["outcome"] == "accepted"
    for who in SEATS:
        assert trader_events(b.read_all(t, who)[0]) == []  # 使った直後（もどすカードを選ぶ前）には出ない
    assert b.act(t, "answer_decision", by_card_id(TB.DEWGONG))["outcome"] == "accepted"
    for who in SEATS:
        assert trader_events(b.read_all(t, who)[0]) == [("return_to_deck", TB.DEWGONG)]  # 探す前には探すカードを出さない
    before = {who: b.read_all(t, who)[1][-1]["next"] for who in SEATS}
    assert b.act(t, "answer_decision", by_card_id(TB.IVYSAUR))["outcome"] == "accepted"
    for who in SEATS:
        entries, pages = b.read_all(t, who)
        assert trader_events(entries) == [("return_to_deck", TB.DEWGONG), ("reveal_from_deck", TB.IVYSAUR)]
        assert [(e["segment"], e["log_index"]) for e in entries] == [(0, i) for i in range(len(entries))]
        assert set(pages[-1]) == RESPONSE_KEYS  # 接続層の項目（match_id・識別子など）を混ぜない
        tail, _ = b.read_all(t, who, before[who])  # 保持した next からの追記だけ
        assert [e["event"]["kind"] for e in tail] == ["reveal_from_deck", "shuffle", "discard_trainer"]
    assert b.read_all(t, "host")[0] == b.read_all(t, "spectator")[0]  # ホストの入口は観戦者の写し
    assert hubs["trader_log"] is not None


def test_computer_search_result_stays_hidden_from_others(lb):
    b, _ = lb
    t = b.create("computer_search_log")
    assert b.act(t, "play_trainer", by_card_id(TB.COMPUTER_SEARCH))["outcome"] == "accepted"
    assert b.act(t, "answer_decision", by_card_id(TB.FIRE, TB.PONYTA, count=2))["outcome"] == "accepted"
    assert b.act(t, "answer_decision", by_card_id(TB.BILL))["outcome"] == "accepted"
    own = [e["event"] for e in b.read_all(t, 0)[0] if e["event"]["kind"] == "search_deck"]
    assert len(own) == 1 and isinstance(own[0]["card"], int) and "hidden" not in own[0]
    for who in (1, "spectator", "host"):
        search = [e["event"] for e in b.read_all(t, who)[0] if e["event"]["kind"] == "search_deck"]
        assert search == [{"kind": "search_deck", "turn": TB.TURN, "player": 0, "hidden": {"card": None}}]
        assert TB.BILL not in json.dumps(b.read_all(t, who)[0])


def test_own_rejection_diagnostic_is_not_in_any_log(lb):
    b, hubs = lb
    t = b.create("keep_er_c")
    assert b.act(t, "play_trainer", by_card_id(KB.ENERGY_REMOVAL))["outcome"] == "accepted"
    logs_before = {who: b.read_all(t, who)[0] for who in SEATS}
    state_before = full(hubs["keep_er_c"])
    opp = b.post(t, 0, "view").json()["observation"]["players"][1]
    bench_cards = {e["card"] for e in opp["bench"][0]["energy"]}
    rejected = b.act(t, "answer_decision", lambda st: [o["id"] for o in st["options"] if o["card"] in bench_cards][:1])
    assert rejected["outcome"] == "rejected" and rejected["result"]["diagnostic_id"] == "UNRESOLVED_KEEP_PROTECTED_TARGET"
    assert full(hubs["keep_er_c"]) == state_before
    for who in SEATS:
        entries = b.read_all(t, who)[0]
        assert entries == logs_before[who]  # 拒否はログを変えない
        assert "UNRESOLVED_KEEP_PROTECTED_TARGET" not in json.dumps(entries)


def test_baseline_end_marks_events_projected_when_the_hub_was_made(lb):
    b, _ = lb
    t = b.create("trader_log_baseline")
    for who in SEATS:
        entries, pages = b.read_all(t, who)
        assert pages[-1]["baseline_end"] == pages[-1]["end"] == {"segment": 0, "index": len(entries)}
        assert trader_events(entries) == [("return_to_deck", TB.DEWGONG), ("reveal_from_deck", TB.IVYSAUR)]


def test_fixed_example_log_with_masked_seed_passes_and_pages(lb):
    """既存の固定例（sudden_death。681 件）: game_created の hidden.seed（名前だけ・値は null）が通り、256・256・169 のページで complete まで読める。"""
    b, _ = lb
    t = b.create("sudden_death")
    for who in SEATS:
        entries, pages = b.read_all(t, who)
        assert [len(p["entries"]) for p in pages] == [256, 256, 169]
        assert entries[0]["event"]["kind"] == "game_created" and entries[0]["event"]["hidden"] == {"seed": None}
        assert "seed" not in {k for k in entries[0]["event"] if k != "hidden"}


# ---------------------------------------------------------------- エンジンの診断をそのまま渡す


def test_engine_diagnostics_are_passed_through(lb):
    b, _ = lb
    t = b.create("trader_log")
    cases = [({"from": {"segment": 0, "index": 1}}, "CLIENT_LOG_POSITION_UNKNOWN"), ({"from": {"segment": 3, "index": 0}}, "CLIENT_LOG_POSITION_UNKNOWN"),
             ({"from": {"segment": 0, "index": True}}, "CLIENT_FIELD_INVALID"), ({"from": {"segment": 0}}, "CLIENT_FIELD_INVALID"),
             ({"from": {"segment": 0, "index": -1}}, "CLIENT_FIELD_INVALID"), ({"from": {"segment": 0, "index": 2**31}}, "CLIENT_FIELD_INVALID"),
             ({"viewer": 1}, "CLIENT_FIELD_UNKNOWN")]
    for fields, code in cases:
        for who in SEATS:
            response = b.post(t, who, "log", **fields)
            body = response.json()
            assert response.status_code == 200 and body["ok"] is False and body["type"] == "log" and body["error"]["code"] == code, (fields, body)


# ---------------------------------------------------------------- 読み取りだけ（状態・乱数・更新の箱を変えない）


def test_log_does_not_change_state_rng_or_update_queues(lb):
    b, hubs = lb
    t = b.create("trader_log")
    assert b.act(t, "play_trainer", by_card_id(TB.POKEMON_TRADER))["outcome"] == "accepted"
    before = full(hubs["trader_log"])
    updates = {who: b.updates(t, who) for who in SEATS}
    views = {who: b.post(t, who, "view").json() for who in SEATS}
    for _ in range(3):
        for who in SEATS:
            b.read_all(t, who)
            b.log(t, who, {"segment": 0, "index": 0})
            b.log(t, who, {"segment": 9, "index": 0})  # 範囲外（誤り）でも変えない
    assert full(hubs["trader_log"]) == before
    assert {who: b.updates(t, who) for who in SEATS} == updates
    assert {who: b.post(t, who, "view").json() for who in SEATS} == views


# ---------------------------------------------------------------- 安全検査（限定の例外）


def _sudden_death_first_page(lb):
    b, _ = lb
    t = b.create("sudden_death")
    return b.log(t, "spectator")[1]


def test_masked_hidden_accepts_only_the_mask_structure_at_event_position(lb):
    real = _sudden_death_first_page(lb)  # 実応答
    problems, masks = masked_hidden(real)
    assert problems == [] and len(masks) >= 1
    assert forbidden_paths(real, masks=masks) == []
    assert forbidden_paths(real) != []  # 例外なしなら hidden.seed は禁じた名前（前の挙動）
    # 人工の応答（実応答を写して値を変えた）
    bad_values = [{"seed": 1234}, {"seed": "1234"}, {"seed": {"value": 1}}, {"seed": [1]}, {"seed": True}, {"rng": None}, {"state": None}, {}, "seed"]
    for hidden in bad_values:
        tampered = copy.deepcopy(real)
        tampered["entries"][0]["event"]["hidden"] = hidden
        problems, masks = masked_hidden(tampered)
        assert problems == ["$.entries[0].event.hidden"], hidden
        assert forbidden_paths(tampered, masks=masks) != [] or hidden in ({}, "seed"), hidden


def test_hidden_rules_follow_the_event_kind(lb):
    real = _sudden_death_first_page(lb)
    shuffle = next(i for i, e in enumerate(real["entries"]) if e["event"]["kind"] == "shuffle")
    draw = next(i for i, e in enumerate(real["entries"]) if e["event"]["kind"] == "draw" and "hidden" in e["event"])
    # 人工: 公開の出来事に hidden・見えない項目でない名前・隠した名前が本体にも残る・負の枚数・真偽の枚数
    cases = []
    t = copy.deepcopy(real); t["entries"][shuffle]["event"]["hidden"] = {"cards": None}; cases.append((t, shuffle))
    t = copy.deepcopy(real); t["entries"][draw]["event"]["hidden"] = {"card": 1}; cases.append((t, draw))
    t = copy.deepcopy(real); t["entries"][draw]["event"]["cards"] = [1]; cases.append((t, draw))
    t = copy.deepcopy(real); t["entries"][draw]["event"]["hidden"] = {"cards": -1}; cases.append((t, draw))
    t = copy.deepcopy(real); t["entries"][draw]["event"]["hidden"] = {"cards": True}; cases.append((t, draw))
    for tampered, index in cases:
        assert masked_hidden(tampered)[0] == [f"$.entries[{index}].event.hidden"]
    # 枚数（並びの hidden）は通る（実応答の draw は相手・観戦者には {"cards": 枚数}）
    assert isinstance(real["entries"][draw]["event"]["hidden"]["cards"], int)


def test_forbidden_names_outside_the_verified_mask_are_still_rejected(lb):
    real = _sudden_death_first_page(lb)
    cases = []
    t = copy.deepcopy(real); t["entries"][0]["event"]["seed"] = None; cases.append(t)  # hidden の外の seed（値なしでも）
    t = copy.deepcopy(real); t["entries"][0]["hidden"] = {"seed": None}; cases.append(t)  # 出来事の外の hidden
    t = copy.deepcopy(real); t["entries"][0]["event"]["extra"] = {"hidden": {"seed": None}}; cases.append(t)  # 入れ子の hidden
    t = copy.deepcopy(real); t["hidden"] = {"seed": None}; cases.append(t)  # 応答の直下の hidden
    t = copy.deepcopy(real); t["entries"][1]["event"]["traceback"] = "x"; cases.append(t)
    for tampered in cases:
        _, masks = masked_hidden(tampered)
        assert forbidden_paths(tampered, masks=masks) != []
    # log 以外の応答（view など）の hidden.seed は、今までどおり禁じた名前
    assert forbidden_paths({"type": "view", "observation": {"hidden": {"seed": None}}}) != []


def _tampered_bridge(monkeypatch, lb, change):
    """接続層の安全検査の確かめ: エンジンの入口の log の応答を、テストの中だけで書きかえる（人工の応答）。"""
    b, _ = lb
    t = b.create("sudden_death")
    original = local_match.LocalMatch.handle

    def handle(self, seat, request, **kw):
        answer = original(self, seat, request, **kw)
        if isinstance(request, dict) and request.get("type") == "log" and answer.get("ok"):
            answer = copy.deepcopy(answer)
            change(answer)
        return answer

    monkeypatch.setattr(local_match.LocalMatch, "handle", handle)
    return b, t


@pytest.mark.parametrize("change, code", [
    (lambda a: a["entries"][0]["event"]["hidden"].update(seed=42), "GUI_RESPONSE_WITHHELD"),
    (lambda a: a["entries"][0]["event"].update(seed=42), "GUI_RESPONSE_WITHHELD"),
    (lambda a: a["entries"][0]["event"]["hidden"].update(seed="secret"), "GUI_RESPONSE_WITHHELD"),
    (lambda a: a["entries"].pop(3), "GUI_LOG_RESPONSE_INVALID"),
    (lambda a: a.update(complete=True), "GUI_LOG_RESPONSE_INVALID"),
    (lambda a: a.update(next={"segment": 0, "index": 300}), "GUI_LOG_RESPONSE_INVALID"),
    (lambda a: a.update(match_id="m"), "GUI_LOG_RESPONSE_INVALID"),
    (lambda a: a["entries"][0].update(segment=True), "GUI_LOG_RESPONSE_INVALID"),
])
def test_bridge_withholds_bad_log_answers(monkeypatch, lb, change, code):
    b, t = _tampered_bridge(monkeypatch, lb, change)
    status, body = b.log(t, "spectator")
    assert status == 500 and body == {"gui_server": 1, "ok": False, "error": {"code": code, "message": body["error"]["message"]}}
    text = json.dumps(body, ensure_ascii=False)
    assert "secret" not in text and "seed" not in text and "entries" not in text  # 返さなかった応答の中身を誤りに写さない


def test_log_contract_problems_on_real_pages(lb):
    b, _ = lb
    t = b.create("sudden_death")
    entries, pages = b.read_all(t, 1)
    starts = [None, pages[0]["next"], pages[1]["next"]]
    for page, start in zip(pages, starts):
        assert log_response_problems(page, {} if start is None else {"from": start}) == []
    assert log_response_problems(pages[1], {}) != []  # 違う from の応答として読めば位置が合わない
    tail = b.log(t, 1, pages[-1]["end"])[1]
    assert tail["entries"] == [] and tail["complete"] and log_response_problems(tail, {"from": pages[-1]["end"]}) == []
