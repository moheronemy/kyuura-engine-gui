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
    assert summary["commit_id"] == EXPECTED["engine"]["commit"] and summary["version"] == kyuura_engine.__version__ == EXPECTED["engine"]["version"] == "0.172.0"
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
    # U7-4 で use_attack、U7-5 で 5 種類、U7-5e で use_power の画面を加えた。U7-5f の表示だけの種類（check_face_up_deck）は画面を持たない（check・submit を呼ばない）
    assert EXPECTED["display_only_kinds"] == list(L.DISPLAY_ONLY_KINDS) == [L.KIND_CHECK_FACE_UP_DECK]
    assert EXPECTED["gui_operable_kinds"] == [k for k in EXPECTED["implemented_kinds"] if k not in EXPECTED["display_only_kinds"]]
    assert list(L.TURN_KINDS) == EXPECTED["turn_basic_kinds"] == [L.KIND_PLAY_BASIC, L.KIND_ATTACH_ENERGY, L.KIND_EVOLVE, L.KIND_RETREAT]
    assert list(L.MAIN_KINDS) == EXPECTED["main_kinds"]
    assert EXPECTED["attack_kinds"] == [L.KIND_USE_ATTACK]
    assert EXPECTED["board_kinds"] == list(L.BOARD_KINDS) == [L.KIND_REMOVE_DISGUISE, L.KIND_DISCARD_FROM_PLAY, L.KIND_REVEAL_FACE_DOWN]
    assert EXPECTED["trainer_kinds"] == [L.KIND_PLAY_TRAINER] and EXPECTED["stadium_kinds"] == [L.KIND_USE_STADIUM]
    assert EXPECTED["power_kinds"] == [L.KIND_USE_POWER]
    evaluated = (L.KIND_END_TURN, *L.TURN_KINDS, L.KIND_USE_ATTACK, *L.BOARD_KINDS, L.KIND_PLAY_TRAINER, L.KIND_USE_STADIUM, L.KIND_USE_POWER, L.KIND_CHECK_FACE_UP_DECK)
    assert [k for k in L.MAIN_KINDS if k not in evaluated] == EXPECTED["turn_kinds_not_covered"] == []  # v0.172: 空でも全部の操作に対応した意味ではない（residual）
    assert {L.REASON_REACTIONS, L.REASON_FACE_DOWN, L.REASON_STOPS, L.REASON_PREFLIGHT, L.REASON_CONTINUATION,
            L.REASON_NO_PRINTED_ATTACK, L.REASON_USE_CONDITION} <= set(EXPECTED["reason_codes"])
    assert set(EXPECTED["check_before_submit_kinds"]) <= set(EXPECTED["implemented_kinds"])
    assert {L.KIND_USE_ATTACK, *L.BOARD_KINDS, L.KIND_PLAY_TRAINER, L.KIND_USE_STADIUM, L.KIND_USE_POWER} == set(EXPECTED["check_before_submit_kinds"])


def test_attack_enumerations_match_engine():
    """U7-4 のワザの入力の値（route・addon・cost の値・段の role）が、固定版のエンジンの定数と同じ。"""
    from kyuura_engine import effects as E
    from kyuura_engine.cards import EnergyType

    assert [E.ROUTE_FORM, E.ROUTE_RECALL, E.ROUTE_LINK, E.ROUTE_PREHISTORIC, E.ROUTE_PUPPET, E.ROUTE_MIMIC] == EXPECTED["attack_routes"]
    assert [L.ADDON_STADIUM_COIN, L.ADDON_ATTACK_POWER, L.ADDON_WITH_POWER] == EXPECTED["declaration_addons"]
    assert [e.value for e in EnergyType] == EXPECTED["energy_types"]
    assert EXPECTED["stage_roles"][L.KIND_USE_ATTACK] == ["attack", "declaration_options"]


def test_u7_5_roles_match_engine():
    """U7-5 の段の role（1 段）が、固定版のエンジンの表・ソースと同じ。use_stadium は段のない応答もある（選ばせるもののない効果）。"""
    import inspect

    board = {kind: [role] for kind, (_check, role) in L._BOARD_CHECKS.items()}
    assert {k: EXPECTED["stage_roles"][k] for k in L.BOARD_KINDS} == board
    assert '"role": "trainer"' in inspect.getsource(L._trainer_candidate) and EXPECTED["stage_roles"][L.KIND_PLAY_TRAINER] == ["trainer"]
    stadium = inspect.getsource(L._stadium_candidate)
    assert '"role": "energy"' in stadium and EXPECTED["stage_roles"][L.KIND_USE_STADIUM] == ["energy"]
    assert "disclosure=DISCLOSURE_NONE" in stadium and EXPECTED["stage_roles_or_empty"] == [L.KIND_USE_STADIUM]
    assert set(EXPECTED["stage_roles"]) == {L.KIND_USE_ATTACK, *L.BOARD_KINDS, L.KIND_PLAY_TRAINER, L.KIND_USE_STADIUM}
    # retreat の discard・attach_energy の energy は U7-3 の段と同じ名前（GUI はほかの種類の段の role を止めるとき、この 2 つを除く）
    assert '"role": "discard"' in inspect.getsource(L._retreat_candidate) and '("energy", "target")' in inspect.getsource(L._attach_candidate)
    shared = {r for roles in EXPECTED["stage_roles"].values() for r in roles} & {"discard", "energy", "new_active", "target", "bench", "evolution_card", "active"}
    assert sorted(shared) == EXPECTED["stage_roles_shared"] == ["discard", "energy"]


def test_u7_5_option_keys_cover_engine_source():
    """U7-5 の選べるもの・候補の stadium・holder の項目の表（知らない項目は画面が止める）が、固定版のエンジンが作る項目と同じ。"""
    import inspect

    pokemon = inspect.getsource(L._pokemon_option)
    for key in ("pokemon", "card", "zone", "bench_index", "face_down", "card_id"):
        assert f'"{key}"' in pokemon, key
    common = {"id", "eligible", "processability", "reasons"}
    assert set(EXPECTED["board_option_keys"]) == common | {"pokemon", "card", "zone", "bench_index", "card_id", "face_down"}
    assert set(EXPECTED["holder_keys"]) == {"pokemon", "card", "zone", "bench_index", "card_id", "face_down"}
    card = inspect.getsource(L._card_option)
    assert '"card"' in card and '"card_id"' in card and 'option["special"]' in card and 'category == "energy"' in card  # special はエネルギーだけ（トレーナーにない）
    assert set(EXPECTED["trainer_option_keys"]) == common | {"card", "card_id"}
    stadium = inspect.getsource(L._stadium_candidate)
    assert '"card": energy, "card_id": state.cards[energy].card_id, "holder": dict(base)' in stadium
    assert set(EXPECTED["stadium_energy_option_keys"]) == common | {"card", "card_id", "holder"}
    assert '{"card": stadium.card, "card_id": state.cards[stadium.card].card_id, "owner": stadium.owner}' in stadium
    assert EXPECTED["stadium_keys"] == ["card", "card_id", "owner"]


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


def test_power_shapes_match_engine():
    """U7-5e: 特殊能力の段の role の並び・role ごとの meaning が、固定版のエンジンの宣言の表（effects.POWER_INPUT_STAGES）と同じ。段のない形も受ける。"""
    from kyuura_engine.effects import POWER_INPUT_STAGES

    shapes = {tuple(field for field, _ in decl) for decl in POWER_INPUT_STAGES.values()} | {()}
    assert shapes == {tuple(shape) for shape in EXPECTED["power_stage_shapes"]}
    for decl in POWER_INPUT_STAGES.values():
        for field, domain in decl:
            assert EXPECTED["power_role_meanings"][field] == L._POWER_MEANING[domain], (field, domain)
    # どの段も 1 つを選ぶ（任意の段はない）。2 段目以降は直前の段に依存し、upstream_stages・after を持つ
    import inspect

    source = inspect.getsource(L._power_candidate)
    assert '"count": {"min": 1, "max": 1}' in source and '"depends_on_stage": k - 1, "upstream_stages": list(range(1, k))' in source
    assert '{"after": parents[oid]} if k > 1' in source


def test_power_option_keys_cover_engine_source():
    """U7-5e の選べるもの・候補の pokemon・power の項目の表が、固定版のエンジンが作る項目と同じ。相手のうらのカードは位置と face_down だけ。"""
    import inspect

    public = inspect.getsource(L._public_pokemon)
    assert '{"pokemon": pokemon.pokemon_id, "zone": zone, "face_down": True}' in public and 'option["bench_index"] = index' in public
    domain = inspect.getsource(L._power_domain)
    assert '{"card": uid, "card_id": state.cards[uid].card_id}' in domain and "_card_option(state, uid)" in domain
    common = {"id", "eligible", "processability", "reasons"}
    assert set(EXPECTED["power_option_keys"]) == common | {"pokemon", "card", "zone", "bench_index", "card_id", "face_down", "special", "after"}
    candidates = inspect.getsource(L._power_candidates)
    assert '{"index": slot.key.power_index, "name_ja": slot.power.name_ja, "card": slot.card, "card_id": slot.key.card_id}' in candidates
    # v0.172（U7-5g-2）: 本人のうらのカードの特殊能力は _face_down_power_candidates（power に face_down、pokemon は _pokemon_option の形でうらは face_down・カード ID なし）
    assert "if state.is_face_down(pokemon):\n            out += _face_down_power_candidates(state, actor, pokemon, base)" in candidates
    face_down = inspect.getsource(L._face_down_power_candidates)
    assert '"power": {"index": index, "name_ja": power.name_ja, "card": pokemon.card, "card_id": definition.id, "face_down": True}' in face_down
    assert '"pokemon": dict(base)' in face_down and '"pokemon": dict(base)' in candidates
    assert EXPECTED["power_keys"] == ["index", "name_ja", "card", "card_id", "face_down"]
    assert set(EXPECTED["power_candidate_pokemon_keys"]) == {"pokemon", "card", "zone", "bench_index", "card_id", "face_down"}


def test_face_up_and_path_stages_match_engine_source():
    """U7-5f の表示だけの段（owner・position）と、U7-5g-1 の経路で引く段（energy2・path_stages [1, 2]・count 0〜1）が、固定版のエンジンのソースと同じ。"""
    import inspect

    face_up = inspect.getsource(L._face_up_candidate)
    spec = EXPECTED["display_only_stages"][L.KIND_CHECK_FACE_UP_DECK]
    assert f'"role": "{spec["role"]}", "meaning": "{spec["meaning"]}", "count": {{"min": 1, "max": 1}}' in face_up
    assert '{"id": f"o{n}", "owner": owner, "position": position}' in face_up and "_option(" in face_up
    assert set(EXPECTED["face_up_option_keys"]) == {"id", "owner", "position", "eligible", "processability", "reasons"}
    energy2 = inspect.getsource(L._add_energy2_stage)
    path = EXPECTED["path_stage_kinds"][L.KIND_ATTACH_ENERGY]
    assert (f'"stage": {path["stage"]}, "input": INPUT_CHOOSE_OPTION, "role": "{path["role"]}", "meaning": "{path["meaning"]}", '
            f'"count": {{"min": {path["count"]["min"]}, "max": {path["count"]["max"]}}}') in energy2
    assert '"decline": True, "path_stages": [1, 2], "options_by_path": by_path' in energy2 and path["path_stages"] == [1, 2] and path["decline"] is True
    assert 'by_path.setdefault(f"{first}/{second}", [])' in energy2  # 鍵は 1・2 段目の選ぶものの番号を / でつないだもの
    assert '_card_option(state, uid)' in energy2 and set(EXPECTED["energy2_option_keys"]) == {"id", "card", "card_id", "special", "eligible", "processability", "reasons"}
    assert EXPECTED["attach_energy_role_shapes"] == [["energy", "target"], ["energy", "target", "energy2"]]
    assert set(EXPECTED["path_stage_kinds"]) == {L.KIND_ATTACH_ENERGY}


def test_residual_classes_match_engine():
    """U7-5g-3 の残りの分類・区分・present の項目が、固定版のエンジンの定数と同じ（note はエンジンの説明文で、表に写さない）。"""
    import inspect

    assert [{k: v for k, v in c.items() if k != "note"} for c in L.RESIDUAL_CLASSES] == EXPECTED["residual_classes"]
    assert all(set(c) == set(EXPECTED["residual_class_keys"]) for c in L.RESIDUAL_CLASSES)
    assert [L.RESIDUAL_NOT_OFFERED, L.RESIDUAL_INPUT_WITHHELD, L.RESIDUAL_OUT_OF_SCOPE] == EXPECTED["residual_statuses"]
    assert [L.RESIDUAL_PUBLIC, L.RESIDUAL_ACTOR] == EXPECTED["residual_scopes"]
    present = inspect.getsource(L._residual_present)
    assert '{"id": RESIDUAL_FACE_UP_SCOPE, "scope": RESIDUAL_PUBLIC}' in present and '"scope": RESIDUAL_ACTOR, "candidate": c.id}' in present
    assert set(EXPECTED["residual_present_keys"]) == {"id", "scope", "candidate"}
    assert '[{"reason": reason, "candidates": ids} for reason, ids in sorted(found.items())]' in inspect.getsource(L._unverified_paths)


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
    """実際の番の coverage（seed 固定の new_game）: scope_kinds は評価した種類（番を終える・基本の 4 種類・ワザ・U7-5 の 5 種類・特殊能力・表示だけの種類）。
    offered_kinds は候補に出した種類だけ（評価してゲーム上できない種類は出さない）。番の候補は partial（v0.172: 未対応の種類はなく、R-2 の示さない経路が残る）。
    coverage の項目は契約の表のとおり。"""
    from .conftest import reach_first_turn

    t = reach_first_turn(fixed_bridge)
    turn = fixed_bridge.seat(t[0], "candidates")["response"]
    cov = turn["coverage"]
    assert cov["implemented_kinds"] == EXPECTED["implemented_kinds"]
    assert cov["completeness"] == "partial"
    assert cov["scope_kinds"] == EXPECTED["main_kinds"]
    assert cov["not_covered_kinds"] == EXPECTED["turn_kinds_not_covered"] == []
    assert list(cov) == EXPECTED["coverage_keys"]
    assert (cov["display_only_kinds"], cov["partial_residual"], cov["residual"]["present"], cov["unverified_paths"]) == (["check_face_up_deck"], ["R-2"], [], [])
    assert [{k: v for k, v in c.items() if k != "note"} for c in cov["residual"]["classes"]] == EXPECTED["residual_classes"]
    # 0.170.0 から: プリセットの 1 番目のデッキの最初の手札のトレーナーが play_trainer の候補になる（0.166.0 までは対応しない種類で候補がなかった。意図した差）
    assert cov["offered_kinds"] == [c["kind"] for c in turn["candidates"]] == ["end_turn", "play_basic", "attach_energy", "play_trainer"]
    end = next(c for c in turn["candidates"] if c["kind"] == "end_turn")
    assert end["processability"] == "may_stop_later" and end["input_disclosure"] == "no_input"
    for c in turn["candidates"][1:]:
        assert c["input_disclosure"] == "confirmed" and c["processability"] in EXPECTED["processability"]
