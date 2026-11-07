"""GUI が前提にする契約の値（contract/kyuura-client-api-v1.json）を、固定版のエンジンの定数・実際の応答と照らす。

エンジンを更新したとき、この表とエンジンが食い違えばここが失敗する（README「エンジンの更新」）。
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import kyuura_engine
from kyuura_engine import client_api as C
from kyuura_engine import diagnostics as D
from kyuura_engine import legal_actions as L

from .conftest import tokens

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))


def test_engine_identity():
    assert kyuura_engine.__version__ == EXPECTED["engine"]["version"]
    src = Path(kyuura_engine.__file__).resolve().parents[1]
    head = subprocess.run(["git", "-C", str(src), "rev-parse", "HEAD"], capture_output=True, text=True)
    if head.returncode == 0:  # -e で入れた clone なら、そのコミットを確かめる
        assert head.stdout.strip() == EXPECTED["engine"]["commit"]
    reqs = (ROOT / "server" / "requirements.txt").read_text(encoding="utf-8")
    assert f"kyuura-engine@{EXPECTED['engine']['commit']}" in reqs


def test_envelope_and_formats():
    assert (C.CONTRACT, C.FORMAT) == (EXPECTED["contract"], EXPECTED["format"])
    assert L.FORMAT_KEY == "kyuura_legal_actions_format"
    assert D.DIAGNOSTIC_SCHEMA == EXPECTED["diagnostic_schema"]


def test_enumerations_match_engine():
    assert list(L.PROCESSABILITY) == EXPECTED["processability"]
    assert sorted(L.EXECUTABLE) == sorted(EXPECTED["executable_processability"])
    assert [L.DISCLOSURE_CONFIRMED, L.DISCLOSURE_UNCONFIRMED, L.DISCLOSURE_NONE] == EXPECTED["input_disclosure"]
    assert [L.COMPLETE, L.PARTIAL, L.UNDETERMINED] == EXPECTED["completeness"]
    assert [L.ACTOR_TO_ACT, L.WAITING_FOR_PLAYER, L.WAITING_FOR_HOST, L.GAME_OVER, L.HALTED] == EXPECTED["situations"]
    assert [L.EMPTY_NOT_ACTOR, L.EMPTY_HOST_OPERATION, L.EMPTY_GAME_ENDED, L.EMPTY_NOT_COVERED, L.EMPTY_PLAYERS_TO_ACT] == EXPECTED["empty_reasons"]
    assert [L.INPUT_CHOOSE_OPTION, L.INPUT_CHOOSE_VALUE] == EXPECTED["input_kinds"]
    assert [L.ORDER_SIGNIFICANT, L.ORDER_NOT_SIGNIFICANT, L.ORDER_NOT_APPLICABLE, L.ORDER_UNCONFIRMED] == EXPECTED["orders"]
    assert [L.PLACEMENT_ELIGIBLE, L.PLACEMENT_EXCLUDED_BY_CONVENTION, L.PLACEMENT_STOP] == EXPECTED["placements"]
    assert [D.ACCEPTED, D.REJECTED, D.FAILED, L.REFUSED] == EXPECTED["outcomes"]
    assert [D.IN_PROGRESS, D.AWAITING_DECISION, D.HALTED, D.GAME_OVER, D.SUDDEN_DEATH_PENDING, D.NOT_STARTED, D.UNAVAILABLE] == EXPECTED["status_values"]
    assert [D.NEXT_PLACE_STARTING, D.NEXT_MULLIGAN_DRAW, D.NEXT_JANKEN, D.NEXT_TURN_ACTION, D.NEXT_ANSWER_DECISION, D.NEXT_START_SUDDEN_DEATH] == EXPECTED["next_kinds"]
    assert [D.INVALID_INPUT, D.RULING_UNRESOLVED, D.UNSUPPORTED, D.TECHNICAL_LIMIT, D.COMPATIBILITY, D.STATE_INTEGRITY, D.INTERNAL_ERROR, D.UNMAPPED] == EXPECTED["halt_categories"]
    assert sorted(C._REFETCH) == sorted(EXPECTED["refetch_refusals"])
    assert [L.CANDIDATES_STALE, L.CANDIDATES_WRONG_GAME, L.CANDIDATES_WRONG_ACTOR, L.CANDIDATE_UNKNOWN, L.CANDIDATE_INPUT_INVALID,
            L.CANDIDATE_NOT_EXECUTABLE, L.INPUT_BOUNDARY_UNCONFIRMED] == EXPECTED["refusal_codes"]
    assert list(C.ERROR_MESSAGES) == EXPECTED["client_error_codes"]
    assert [L.KIND_TAKE_PRIZE, L.KIND_PROMOTE_ACTIVE, L.KIND_ANSWER_DECISION, L.KIND_END_TURN, L.KIND_PLACE_STARTING, L.KIND_MULLIGAN_DRAW,
            L.KIND_REPORT_JANKEN, L.KIND_START_SUDDEN_DEATH] == EXPECTED["implemented_kinds"]


def test_coverage_of_a_real_turn(bridge):
    """実際の番の coverage: 番を終えるだけを出し、ほかの 12 種類は not_covered（partial）。"""
    from .conftest import act

    t = tokens(bridge.create(mode="decks", decks=bridge.preset_decks())["match"])
    for _ in range(20):
        r0 = bridge.seat(t[0], "candidates")["response"]
        r1 = bridge.seat(t[1], "candidates")["response"]
        turn = next((r for r in (r0, r1) if r["candidates"] and r["candidates"][0]["kind"] == "end_turn"), None)
        if turn is not None:
            break
        if not (act(bridge, t[0]) or act(bridge, t[1]) or act(bridge, t["host"], host=True)):
            raise AssertionError("番に届かない")
    cov = turn["coverage"]
    assert cov["implemented_kinds"] == EXPECTED["implemented_kinds"]
    assert cov["offered_kinds"] == ["end_turn"] and cov["completeness"] == "partial"
    assert cov["not_covered_kinds"] == EXPECTED["turn_kinds_not_covered"]
    assert turn["candidates"][0]["processability"] == "may_stop_later" and turn["candidates"][0]["input_disclosure"] == "no_input"
