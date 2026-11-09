"""U-R3a（エンジン 0.175.0）: 本人のうらのカードの、宣言の段が 2〜3 段の特殊能力を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。

盤面は ``tests/r3a_boards.py`` の構築盤面（エンジンの U-R3a のテストの盤面を写したもの。new_game からの到達ではない）。テストの中だけで固定例の表に加える
（製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行い、入力はエンジンが返した選べるものの
id だけで作る（カード名・カード ID・本人の real から作らない）。公開のログ（visible_log）は client_api 形式 1 の応答にないので、テストの中だけで盤面の ClientHub を
控え、エンジンの ``observation.visible_log``（相手・観戦者の見え方）で受理の内訳を確かめる（GUI はログを読まず、観測で表示する）。

- 入力契約: おもての特殊能力と同じ形（depends_on_stage・upstream_stages・options_by_choice・after）。新しい項目はない。候補・選べるもの・参照は unverified
- check は形だけ（段の数・番号・前の段との組・並び・重なり・型）
- 受理（ロケット団のヒトカゲ。コラッタ → 炎エネルギー）・おもてにしたあとの拒否（エビワラー → 闘エネルギー。WRONG_ENERGY_TYPE）・トラッシュ（フシギバナ。3 段）
- 相手・観戦者の応答は本人の本当のカードによらない
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.observation import visible_log

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import r3a_boards
from .conftest import Bridge, candidate_of, tokens
from .p6_boards import install_boards
from .test_u7_5e import handle_of

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))
VOLATILE = ("game", "revision")
REASON = "face_down_reveal_not_evaluated"
ONE, TWO = "r3a_face_down_power_1", "r3a_face_down_power_2"


@pytest.fixture()
def r3a(monkeypatch):
    hubs = {}

    def build(board_id):  # テストの中だけ: 作った ClientHub を控える（公開のログを確かめるため）
        hub = r3a_boards.build(board_id)
        hubs.setdefault(board_id, []).append(hub)
        return hub

    install_boards(scenarios, {b: (r3a_boards.LABELS[b], r3a_boards.DESCRIPTION, build) for b in r3a_boards.BOARDS}, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def start(b, board_id):
    created = b.create(mode="scenario", scenario=board_id)
    assert created["ok"] and created["match"]["origin"]["scenario"] == board_id
    return tokens(created["match"])


def power_of(response):
    found = [c for c in response["candidates"] if c["kind"] == "use_power" and c["power"].get("face_down")]
    assert len(found) == 1, found
    return found[0]


def open_power(b, token):
    response = b.seat(token, "candidates")["response"]
    cand = power_of(response)
    handle = handle_of(response, cand)
    return response, cand, handle, b.seat(token, "inputs", **handle)["response"]


def strip(value):
    if isinstance(value, dict):
        return {k: strip(v) for k, v in value.items() if k not in VOLATILE}
    if isinstance(value, list):
        return [strip(v) for v in value]
    return value


def others(b, t):
    """相手・観戦者に届くもの（view・candidates・updates）。"""
    return strip([b.seat(t[1], "view"), b.seat(t["spectator"], "view"), b.seat(t[1], "candidates"), b.updates(t[1]), b.updates(t["spectator"])])


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (1, "spectator")}


def own_field(b, t, viewer):
    p0 = b.seat(t[viewer], "view")["observation"]["players"][0]
    return p0


def new_log_kinds(hub, before, viewer):
    return [e["kind"] for e in visible_log(hub._state(), viewer)[before:]]


def test_inputs_contract_and_check_shape(r3a):
    b, _hubs = r3a
    t = start(b, ONE)
    response, cand, handle, inputs = open_power(b, t[0])
    assert (cand["input_disclosure"], cand["processability"], cand["reasons"]) == ("confirmed", "unverified", [REASON])
    assert (cand["power"]["card_id"], cand["power"]["face_down"], cand["pokemon"]["face_down"], "card_id" in cand["pokemon"]) == (r3a_boards.ROCKET_CHARMANDER, True, True, False)
    assert cand["id"] not in response["coverage"]["withheld_input_candidates"] and "withheld" not in inputs
    assert "R-3" not in [p["id"] for p in response["coverage"]["residual"]["present"]]
    first, second = inputs["stages"]
    assert [s["role"] for s in inputs["stages"]] in EXPECTED["power_stage_shapes"]
    assert all(set(s) <= set(EXPECTED["stage_keys"]) for s in inputs["stages"])
    assert all(set(o) <= set(EXPECTED["power_option_keys"]) for s in inputs["stages"] for o in s["options"])
    assert isinstance(first["note"], str) and "depends_on_stage" not in first  # 1 段目の note（構造の組で、受け付けるかは確かめていない）
    assert (second["depends_on_stage"], second["upstream_stages"]) == (1, [1])
    by_choice = {k: [r["option"] for r in v] for k, v in second["options_by_choice"].items()}
    assert by_choice == {o["id"]: [x["id"] for x in second["options"] if x["after"] == o["id"]] for o in first["options"]}
    assert {(o["processability"], tuple(o["reasons"])) for s in inputs["stages"] for o in s["options"]} == {("unverified", (REASON,))}
    # 1 段目は、ついているカードのある自分の場のポケモン（エビワラー・コラッタ）。うらのヒトカゲは何もついていないので組が完成せず出ない
    own = own_field(b, t, 0)
    assert [o["pokemon"] for o in first["options"]] == [q["pokemon_id"] for q in [own["active"], *own["bench"]] if q.get("energy")]
    latest = latest_of(b, t)
    cases = {
        (): False, ("o1",): False, ("o1", "o5"): False, ("o2", "o3"): False,  # 数・別の経路の 2 段目の番号
        ("o3", "o1"): False, ("o1", "o1"): False, ("o1", "o3", "o3"): False, ("o9", "o3"): False, ("o1", "o99"): False,
        ("o1", "o3"): True, ("o2", "o5"): True, ("o2", "o6"): True,  # 形の合う組（闘エネルギーの組も。check は受理を保証しない）
    }
    for choices, valid in cases.items():
        got = b.seat(t[0], "check", **handle, choices=list(choices))["response"]
        assert (got["valid"], None if valid else got["refusal"]["code"]) == (valid, None if valid else "CANDIDATE_INPUT_INVALID"), choices
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []  # 候補・inputs・check は更新を作らない


def test_three_stages_and_others_do_not_depend_on_the_real_card(r3a):
    b, _hubs = r3a
    seen = []
    for board_id in (ONE, TWO):
        t = start(b, board_id)
        _response, cand, _handle, inputs = open_power(b, t[0])
        if board_id == TWO:
            assert [s["role"] for s in inputs["stages"]] == ["source", "energy", "target"]
            third = inputs["stages"][2]
            assert (third["depends_on_stage"], third["upstream_stages"], len(third["options"])) == (2, [1, 2], 12)
            fd = [o for o in third["options"] if o.get("face_down")]
            assert fd and all("card_id" not in o for o in fd)  # うらのポケモン（自分自身）はカード ID なしで並ぶ
            assert cand["processability"] == "unverified"  # たねでないこと（トラッシュ）を予告しない
        text = json.dumps(others(b, t), ensure_ascii=False)
        real = r3a_boards.BOARDS[board_id]
        assert real not in text and cand["power"]["name_ja"] not in text
        assert candidate_of(b.seat(t[1], "candidates")["response"], "use_power") is None
        slot = own_field(b, t, 0)["bench"][1]
        assert slot.get("face_down") is True and slot["real"]["card_id"] == real  # 本人の観測にだけ本人の知識
        seen.append(others(b, t))
    assert seen[0] == seen[1]  # 相手・観戦者の応答は本人の本当のカードによらない


def test_accepted_power_moves_the_fire_energy_and_reveals(r3a):
    b, hubs = r3a
    t = start(b, ONE)
    hub = hubs[ONE][-1]
    _response, _cand, handle, inputs = open_power(b, t[0])
    first, second = inputs["stages"]
    own = own_field(b, t, 0)
    rattata = own["bench"][0]
    source = next(o["id"] for o in first["options"] if o["pokemon"] == rattata["pokemon_id"])
    fire = next(o for o in second["options"] if o["after"] == source and o["card_id"] == r3a_boards.FIRE)
    choices = [source, fire["id"]]
    assert b.seat(t[0], "check", **handle, choices=choices)["response"]["valid"] is True
    latest = latest_of(b, t)
    log_before = {w: len(visible_log(hub._state(), w)) for w in (1, None)}
    result = b.seat(t[0], "submit", **handle, choices=choices, operation_id="r3a-accept")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")
    stale = b.seat(t[0], "check", **handle, choices=choices)
    assert (stale["refetch_required"], stale["response"]["refusal"]["code"]) == (True, "CANDIDATES_STALE")  # 受理で取っ手は失効する
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"]
    for viewer, token in ((1, t[1]), (None, t["spectator"])):
        p0 = b.seat(token, "view")["observation"]["players"][0]
        user = p0["bench"][1]
        assert (user["card_id"], "face_down" in user, [e["card"] for e in user["energy"]]) == (r3a_boards.ROCKET_CHARMANDER, False, [fire["card"]])
        assert [e["card_id"] for e in p0["bench"][0]["energy"]] == [r3a_boards.WATER]  # 炎エネルギーはコラッタからヒトカゲへ
        kinds = new_log_kinds(hub, log_before[viewer], viewer)
        assert kinds[:2] == ["secret_plan_revealed", "pokemon_power"] and "move_energy" in kinds and "secret_plan_discarded" not in kinds
        revealed = [e for e in visible_log(hub._state(), viewer) if e["kind"] == "secret_plan_revealed"]
        assert [e["card_id"] for e in revealed] == [r3a_boards.ROCKET_CHARMANDER]


def test_rejected_after_reveal_only_to_sender_and_restored(r3a):
    b, hubs = r3a
    t = start(b, ONE)
    hub = hubs[ONE][-1]
    _response, _cand, handle, inputs = open_power(b, t[0])
    first, second = inputs["stages"]
    own = own_field(b, t, 0)
    source = next(o["id"] for o in first["options"] if o["pokemon"] == own["active"]["pokemon_id"])
    fighting = next(o["id"] for o in second["options"] if o["after"] == source and o["card_id"] == r3a_boards.FIGHTING)
    choices = [source, fighting]
    before_views = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    before_own = b.seat(t[0], "view")
    latest = latest_of(b, t)
    log_before = {w: visible_log(hub._state(), w) for w in (1, None)}
    assert b.seat(t[0], "check", **handle, choices=choices)["response"] == {"valid": True, "refusal": None}  # check は形だけ
    result = b.seat(t[0], "submit", **handle, choices=choices, operation_id="r3a-reject")
    assert (result["outcome"], result["refetch_required"]) == ("rejected", False)
    assert (result["result"]["role"], result["result"]["diagnostic_id"], result["result"]["category"]) == ("actor", "WRONG_ENERGY_TYPE", "invalid_input")
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []  # 拒否は公開の更新にしない
        assert b.seat(t[w], "view") == before_views[w]
    assert b.seat(t[0], "view") == before_own  # 状態はもどる（うらのまま）
    for viewer in (1, None):
        assert visible_log(hub._state(), viewer) == log_before[viewer]  # おもてにしたことも残らない
    text = json.dumps(others(b, t), ensure_ascii=False)
    assert r3a_boards.ROCKET_CHARMANDER not in text and "WRONG_ENERGY_TYPE" not in text and "r3a-reject" not in text
    assert b.seat(t[0], "check", **handle, choices=choices)["response"]["valid"] is True  # 拒否では取っ手は失効しない（エンジンの契約）


def test_not_basic_is_revealed_and_trashed_without_the_power(r3a):
    b, hubs = r3a
    t = start(b, TWO)
    hub = hubs[TWO][-1]
    _response, _cand, handle, inputs = open_power(b, t[0])
    first, second, third = inputs["stages"]
    own = own_field(b, t, 0)
    active = own["active"]
    source = next(o["id"] for o in first["options"] if o["pokemon"] == active["pokemon_id"])
    energy = next(o["id"] for o in second["options"] if o["after"] == source)
    target = next(o["id"] for o in third["options"] if o["after"] == energy and o["pokemon"] == active["pokemon_id"])
    choices = [source, energy, target]
    assert b.seat(t[0], "check", **handle, choices=choices)["response"]["valid"] is True
    latest = latest_of(b, t)
    log_before = {w: len(visible_log(hub._state(), w)) for w in (1, None)}
    result = b.seat(t[0], "submit", **handle, choices=choices, operation_id="r3a-trash")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")  # ベンチのカード: 交代の決定はない
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"]
    for viewer, token in ((1, t[1]), (None, t["spectator"])):
        p0 = b.seat(token, "view")["observation"]["players"][0]
        assert len(p0["bench"]) == 1 and all(not q.get("face_down") for q in p0["bench"])  # うらのポケモンはいない
        assert r3a_boards.VENUSAUR in [c["card_id"] for c in p0["discard"]]
        assert [e["card"] for e in p0["active"]["energy"]] == [e["card"] for e in active["energy"]]  # エネルギーは動かない（特殊能力はおこらない）
        kinds = new_log_kinds(hub, log_before[viewer], viewer)
        assert kinds[:2] == ["secret_plan_revealed", "secret_plan_discarded"] and "pokemon_power" not in kinds and "move_energy" not in kinds
        revealed = [e for e in visible_log(hub._state(), viewer) if e["kind"] == "secret_plan_revealed"]
        assert [e["card_id"] for e in revealed] == [r3a_boards.VENUSAUR]
