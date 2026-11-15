"""0.186.0（開発用の規約集合 CS-KYUURA-PLAY-TR3@1）を、接続層の既存の口でそのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。docs/engine-contract.md 29 章）。

- 盤面: ``tests/tr3_boards.py`` の 12（エンジンの v0.186 の回帰テストの盤面と同じ状態・同じ規約集合）。new_game からの到達ではない
- 接続層の変更は、新しい対戦で選べる集合（``app.CONVENTION_SETS``）に TR3 を加えたことだけ。安全検査（禁じた項目・秘密の語）は変えていない（conftest の Bridge がすべての応答で確かめる）
- 通常の使用と代用の使用の判定そのものは、エンジンの回帰テストに依る（GUI は新しい経路を作らない）
"""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.rng import rng_fingerprint
from kyuura_engine.serialize import FORMAT_VERSIONS, state_to_dict

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import CONVENTION_SETS, create_app

from . import tr3_boards as TB
from .conftest import ENVELOPE, Bridge, tokens
from .p6_boards import install_boards

CONVENTION = {"gust": "PC-GUST-WITHOUT-OPPONENT-BENCH@1", "switch": "PC-SWITCH-WITHOUT-BENCH@1", "potion": "PC-POTION-WITHOUT-DAMAGE@1"}
CARD = {"gust": TB.GUST, "switch": TB.SWITCH, "potion": TB.POTION}
TR3_REF = {"id": "CS-KYUURA-PLAY-TR3", "version": 1, "digest": "sha256:a7b800cff2a8614d7b181cc3a8a39f68ec4e17be9ceab0a04e75a48c4358ffb4"}
CURRENT_REF = {"id": "CS-KYUURA-CURRENT", "version": 1, "digest": "sha256:9a9b95c689d86fa01a5b710984560efda3c08f4dbf1d7c6218094ac8666f3cee"}


def full(hub):
    """状態（最新の書き出しの形式。形式 22 は TR3 の集合を表せない）・乱数・ログの長さ・決定。拒否で変わらないことの確かめだけに使う（tests/test_log.py の full と同じ考え方）。"""
    state = hub._state()
    exported = json.dumps(state_to_dict(state, format_version=max(FORMAT_VERSIONS)), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(exported.encode()).hexdigest(), rng_fingerprint(state.rng), len(state.log), state.decision.id if state.decision else None


@pytest.fixture()
def tb(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = TB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (TB.LABELS[b], TB.DESCRIPTION, build) for b in TB.BOARDS}, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def open_trainer(b, board):
    t = tokens(b.create(mode="scenario", scenario=board)["match"])
    cands = b.seat(t[0], "candidates")["response"]
    cand = next(c for c in cands["candidates"] if c["kind"] == "play_trainer")
    h = {"game": cands["game"], "revision": cands["revision"], "candidate": cand["id"]}
    inputs = b.seat(t[0], "inputs", **h)
    return t, cand, h, inputs["response"]["stages"][0]["options"]


def by_card(options):
    return {o["card_id"]: o for o in options}


@pytest.mark.parametrize("kind", ["gust", "switch", "potion"])
def test_tr3_without_target_is_excluded_by_convention(tb, kind):
    """TR3・対象なし: 選べるものに残り eligible: false・convention（processability・reasons なし）。候補は not_implemented・no_eligible_card。4 入口とも状態の集合は TR3。"""
    b, _ = tb
    t, cand, _, options = open_trainer(b, f"tr3_{kind}")
    assert [(o["card_id"], o["eligible"], o["convention"], "processability" in o, "reasons" in o) for o in options] == [(CARD[kind], False, CONVENTION[kind], False, False)]
    assert (cand["processability"], cand["reasons"]) == ("not_implemented", ["no_eligible_card"])
    for who in (0, 1, "spectator"):
        assert b.seat(t[who], "view")["status"]["convention_set"] == TR3_REF
    assert b.host(t["host"], "view")["status"]["convention_set"] == TR3_REF


@pytest.mark.parametrize("kind", ["gust", "switch", "potion"])
def test_current_same_board_is_unresolved_not_convention(tb, kind):
    """同じ盤面の CURRENT: 今までどおり未裁定（unresolved_ruling・stops_before_acceptance）。convention は来ない。"""
    b, _ = tb
    t, cand, _, options = open_trainer(b, f"cur_{kind}")
    assert [(o["eligible"], o["processability"], o.get("reasons"), "convention" in o) for o in options] == [(False, "unresolved_ruling", ["stops_before_acceptance"], False)]
    assert cand["processability"] == "unresolved_ruling"
    assert b.seat(t[0], "view")["status"]["convention_set"] == CURRENT_REF


@pytest.mark.parametrize("kind", ["gust", "switch", "potion"])
def test_tr3_with_target_is_unchanged_and_accepted(tb, kind):
    """TR3・対象あり: 今までどおり送れる区分で、check が通り、受理される。"""
    b, _ = tb
    t, cand, h, options = open_trainer(b, f"tr3_{kind}_target")
    (option,) = options
    assert option["eligible"] is True and "convention" not in option and option["processability"] == "may_stop_later"
    assert b.seat(t[0], "check", **h, choices=[option["id"]])["response"]["valid"] is True
    assert b.seat(t[0], "submit", **h, choices=[option["id"]], operation_id="t-target")["outcome"] == "accepted"


@pytest.mark.parametrize("board", ["tr3_gust", "tr3_switch", "tr3_potion", "tr3_mixed", "tr3_all_excluded", "cur_mixed"])
def test_excluded_check_and_submit_are_refused_as_diagnostic(tb, board):
    """直接の口で送れない選べるものを check・submit すると、エンジンの CANDIDATE_NOT_EXECUTABLE がそのまま返り（接続層は読み替えない）、状態・乱数・ログ・更新は変わらない。"""
    b, hubs = tb
    t, _, h, options = open_trainer(b, board)
    hub = hubs[board]
    before, updates = full(hub), b.updates(t[0])
    excluded = [o for o in options if o["eligible"] is False]
    assert excluded
    for o in excluded:
        check = b.seat(t[0], "check", **h, choices=[o["id"]])["response"]
        assert (check["valid"], check["refusal"]["code"]) == (False, "CANDIDATE_NOT_EXECUTABLE")
        sent = b.seat(t[0], "submit", **h, choices=[o["id"]], operation_id=f"t-{o['id']}")
        assert (sent["outcome"], sent["refusal"]["code"], sent["result"]) == ("refused", "CANDIDATE_NOT_EXECUTABLE", None)
    assert full(hub) == before and b.updates(t[0]) == updates


@pytest.mark.parametrize(("board", "expect_convention"), [("tr3_mixed", True), ("cur_mixed", False)])
def test_mixed_other_card_is_not_affected(tb, board, expect_convention):
    """混在: 突風・きずぐすりだけ送れない（TR3 は規約、CURRENT は未裁定）。ポケモンいれかえは同じ値で、check・submit が通る。"""
    b, _ = tb
    t, cand, h, options = open_trainer(b, board)
    o = by_card(options)
    for card, key in ((TB.GUST, "gust"), (TB.POTION, "potion")):
        assert o[card]["eligible"] is False
        assert o[card].get("convention") == (CONVENTION[key] if expect_convention else None)
    switch = o[TB.SWITCH]
    assert (switch["eligible"], switch["processability"], "convention" in switch) == (True, "may_stop_later", False)
    assert (cand["processability"], cand["reasons"]) == (switch["processability"], switch["reasons"])
    assert b.seat(t[0], "check", **h, choices=[switch["id"]])["response"]["valid"] is True
    assert b.seat(t[0], "submit", **h, choices=[switch["id"]], operation_id="t-switch")["outcome"] == "accepted"


def test_all_excluded_candidate(tb):
    b, _ = tb
    _, cand, _, options = open_trainer(b, "tr3_all_excluded")
    assert (cand["processability"], cand["reasons"]) == ("not_implemented", ["no_eligible_card"])
    assert [(o["card_id"], o["eligible"], o["convention"]) for o in options] == [(TB.GUST, False, CONVENTION["gust"]), (TB.POTION, False, CONVENTION["potion"])]


def test_bridge_passes_engine_inputs_unchanged(tb):
    """接続層は TR3 の候補・入力をエンジンの応答のまま渡す（項目を足す・消す・読み替えない）。"""
    b, hubs = tb
    t = tokens(b.create(mode="scenario", scenario="tr3_mixed")["match"])
    over_http = b.seat(t[0], "candidates")["response"]
    endpoint = hubs["tr3_mixed"].player(0)
    direct = endpoint.handle({**ENVELOPE, "type": "candidates"})["response"]
    assert over_http["candidates"] == direct["candidates"] and over_http["coverage"] == direct["coverage"]  # 取っ手（revision）は入口のセッションごとに別
    def stages(response, send):
        cand = next(c for c in response["candidates"] if c["kind"] == "play_trainer")
        return send(game=response["game"], revision=response["revision"], candidate=cand["id"])["response"]["stages"]
    assert stages(over_http, lambda **h: b.seat(t[0], "inputs", **h)) == stages(direct, lambda **h: endpoint.handle({**ENVELOPE, "type": "inputs", **h}))


def test_new_game_convention_set_is_passed_exactly(bridge):
    """新しい対戦: 省略は既定（CURRENT@1）のまま、TR3 を選んだときだけ TR3。選べる一覧は契約の表の順。ほかの値は GUI_FIELD_INVALID（エンジンへ渡さない）。対戦は進めない。"""
    assert bridge.client.get("/api/decks/presets").json()["convention_sets"] == [k for k in CONVENTION_SETS if k] == [
        "CS-KYUURA-PLAY-S2A@1", "CS-KYUURA-PLAY-PO@1", "CS-KYUURA-PLAY-TR3@1"]
    decks = bridge.preset_decks()
    omitted = bridge.create(mode="decks", decks=decks)
    t = tokens(omitted["match"])
    assert omitted["match"]["origin"]["conventions"] is None
    assert {who: bridge.seat(t[who], "view")["status"]["convention_set"] for who in (0, 1, "spectator")} == {0: CURRENT_REF, 1: CURRENT_REF, "spectator": CURRENT_REF}
    chosen = bridge.create(mode="decks", decks=decks, conventions="CS-KYUURA-PLAY-TR3@1")
    t = tokens(chosen["match"])
    assert chosen["match"]["origin"]["conventions"] == "CS-KYUURA-PLAY-TR3@1"
    assert {who: bridge.seat(t[who], "view")["status"]["convention_set"] for who in (0, 1, "spectator")} == {0: TR3_REF, 1: TR3_REF, "spectator": TR3_REF}
    assert bridge.host(t["host"], "view")["status"]["convention_set"] == TR3_REF
    for other in ("CS-KYUURA-PLAY-PO@1", "CS-KYUURA-PLAY-S2A@1"):  # 既存の集合は今までどおり
        made = bridge.create(mode="decks", decks=decks, conventions=other)
        ref = bridge.seat(tokens(made["match"])[0], "view")["status"]["convention_set"]
        assert f"{ref['id']}@{ref['version']}" == other
    for bad in ("CS-KYUURA-PLAY-TR3@2", "cs-kyuura-play-tr3@1", "CS-KYUURA-PLAY-TR3", "CS-KYUURA-CURRENT@1", "CS-KYUURA-LEGACY-UNRECORDED@1", None, 1):
        refused = bridge.client.post("/api/local-match", json={"mode": "decks", "decks": decks, "conventions": bad})
        assert (refused.status_code, refused.json()["error"]["code"]) == (400, "GUI_FIELD_INVALID"), bad
