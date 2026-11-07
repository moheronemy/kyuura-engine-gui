"""GUI が前提にする契約の値（contract/kyuura-client-api-v1.json）を、固定版のエンジンの定数・実際の応答と照らす。

エンジンを更新したとき、この表とエンジンが食い違えばここが失敗する（README「エンジンの更新」）。
"""

from __future__ import annotations

import importlib
import json
from pathlib import Path

import kyuura_engine
from kyuura_engine import client_api as C
from kyuura_engine import diagnostics as D
from kyuura_engine import legal_actions as L
from kyuura_gui_server.engine_source import verify_engine_source


ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))


def test_engine_identity():
    """導入元は direct_url.json の vcs_info で確かめる（site-packages で git rev-parse をしない）。"""
    summary = verify_engine_source(EXPECTED["engine"]["commit"], EXPECTED["engine"]["version"])
    assert summary["commit_id"] == EXPECTED["engine"]["commit"] and summary["version"] == kyuura_engine.__version__ == EXPECTED["engine"]["version"] == "0.166.0"
    assert "site-packages" in Path(summary["module"]).parts and ".venv/src" not in Path(summary["module"]).as_posix()
    reqs = (ROOT / "server" / "requirements.txt").read_text(encoding="utf-8")
    assert f"kyuura-engine @ git+https://github.com/moheronemy/kyuura-engine@{EXPECTED['engine']['commit']}" in reqs
    assert not any(line.strip().startswith("-e") for line in reqs.splitlines())
    importlib.import_module("kyuura_engine.resolution")  # 修正前の配布物では入っていなかったサブパッケージ


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
    assert list(L.IMPLEMENTED_KINDS) == EXPECTED["implemented_kinds"]
    assert EXPECTED["gui_operable_kinds"] == EXPECTED["implemented_kinds"]  # U7-4 で use_attack の画面を加えた（画面を持たない種類は表示だけ）
    assert list(L.TURN_KINDS) == EXPECTED["turn_basic_kinds"] == [L.KIND_PLAY_BASIC, L.KIND_ATTACH_ENERGY, L.KIND_EVOLVE, L.KIND_RETREAT]
    assert list(L.MAIN_KINDS) == EXPECTED["main_kinds"]
    assert EXPECTED["attack_kinds"] == [L.KIND_USE_ATTACK]
    assert [k for k in L.MAIN_KINDS if k not in (L.KIND_END_TURN, *L.TURN_KINDS, L.KIND_USE_ATTACK)] == EXPECTED["turn_kinds_not_covered"]
    assert {L.REASON_REACTIONS, L.REASON_FACE_DOWN, L.REASON_STOPS, L.REASON_PREFLIGHT, L.REASON_CONTINUATION,
            L.REASON_NO_PRINTED_ATTACK} <= set(EXPECTED["reason_codes"])
    assert set(EXPECTED["check_before_submit_kinds"]) <= set(EXPECTED["implemented_kinds"])


def test_attack_enumerations_match_engine():
    """U7-4 のワザの入力の値（route・addon・cost の値・段の role）が、固定版のエンジンの定数と同じ。"""
    from kyuura_engine import effects as E
    from kyuura_engine.cards import EnergyType

    assert [E.ROUTE_FORM, E.ROUTE_RECALL, E.ROUTE_LINK, E.ROUTE_PREHISTORIC, E.ROUTE_PUPPET, E.ROUTE_MIMIC] == EXPECTED["attack_routes"]
    assert [L.ADDON_STADIUM_COIN, L.ADDON_ATTACK_POWER, L.ADDON_WITH_POWER] == EXPECTED["declaration_addons"]
    assert [e.value for e in EnergyType] == EXPECTED["energy_types"]
    assert EXPECTED["stage_roles"] == {L.KIND_USE_ATTACK: ["attack", "declaration_options"]}


def test_attack_option_keys_cover_engine_source():
    """ワザ・宣言といっしょに選ぶものの選べるものの項目の表（知らない項目は画面が止める）が、固定版のエンジンが作る項目を含む。"""
    import inspect

    attack = "".join(inspect.getsource(f) for f in (L._attack_candidate, L._attack_public, L._face_down_attack_candidate))
    for key in ("id", "card", "card_id", "attack_index", "route", "grantors", "name_ja", "cost", "damage", "text_ja", "face_down"):
        assert f'"{key}"' in attack, key
    assert '("provider", "payer")' in attack  # getattr で加える 2 つ
    assert {"id", "card", "card_id", "attack_index", "route", "provider", "payer", "grantors", "name_ja", "cost", "damage", "text_ja",
            "face_down", "eligible", "processability", "reasons"} == set(EXPECTED["attack_option_keys"])
    addon = inspect.getsource(L._addon_specs) + inspect.getsource(L._pokemon_option)
    for key in ("addon", "card", "card_id", "pokemon", "power", "zone", "bench_index", "face_down"):
        assert f'"{key}"' in addon, key
    assert {"id", "addon", "card", "card_id", "pokemon", "zone", "bench_index", "face_down", "power", "eligible", "processability",
            "reasons"} == set(EXPECTED["addon_option_keys"])
    option = inspect.getsource(L._option)  # eligible・processability・reasons は _option が加える
    assert all(f'"{key}"' in option for key in ("eligible", "processability", "reasons"))


def test_stage_keys_cover_engine_source():
    """入力の段の項目の表（知らない項目は画面が止める）が、固定版のエンジンが作る段の項目をすべて含む。"""
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(L))
    keys = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict) and any(isinstance(k, ast.Constant) and k.value == "input" for k in node.keys)                 and any(isinstance(k, ast.Constant) and k.value == "count" for k in node.keys):
            keys |= {k.value for k in node.keys if isinstance(k, ast.Constant)}
    keys.add("name")  # 値の段に後から加える（stage["name"] = ...）
    assert keys <= set(EXPECTED["stage_keys"]), keys - set(EXPECTED["stage_keys"])


def test_coverage_of_a_real_turn(fixed_bridge):
    """実際の番の coverage（seed 固定の new_game）: scope_kinds は評価した種類（番を終える・基本の 4 種類・ワザ）と未対応の 7 種類。
    offered_kinds は候補に出した種類だけ（評価してゲーム上できない種類は出さない）。番の候補は partial。"""
    from .conftest import reach_first_turn

    t = reach_first_turn(fixed_bridge)
    turn = fixed_bridge.seat(t[0], "candidates")["response"]
    cov = turn["coverage"]
    assert cov["implemented_kinds"] == EXPECTED["implemented_kinds"]
    assert cov["completeness"] == "partial"
    assert cov["scope_kinds"] == EXPECTED["main_kinds"]
    assert cov["not_covered_kinds"] == EXPECTED["turn_kinds_not_covered"]
    assert cov["offered_kinds"] == [c["kind"] for c in turn["candidates"]] == ["end_turn", "play_basic", "attach_energy"]
    end = next(c for c in turn["candidates"] if c["kind"] == "end_turn")
    assert end["processability"] == "may_stop_later" and end["input_disclosure"] == "no_input"
    for c in turn["candidates"][1:]:
        assert c["input_disclosure"] == "confirmed" and c["processability"] in EXPECTED["processability"]
