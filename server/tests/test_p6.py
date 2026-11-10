"""P6（エンジン 0.174.0）: 本人のうらのバトル場のポケモンのにげるを、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。

盤面は ``tests/p6_boards.py`` の構築盤面（エンジンの P6 のテストの盤面を写したもの。new_game からの到達ではない）。テストの中だけで固定例の表に加える
（monkeypatch。製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行い、
入力はエンジンが返した選べるものの id だけで作る（カード名・カード ID・本人の real から作らない）。

- 入力契約: 段 2 は total_units・units を省き、cost_evaluation（not_evaluated・face_down_reveal_not_evaluated・omitted）を持つ。段・選べるものの項目は契約の表の範囲
- 双子: 本当のカードだけが違う 3 つの盤面で、本人の候補・inputs・check の答えが同じ（費用・タイプ・段階によらない）。相手・観戦者の応答に本当のカードがない
- check は形だけ（参照・数・重なり・段の並び）。費用を見ない
- 受理（A）・エネルギー不足の拒否（B）・たねでないカードのトラッシュとバトル場に出す決定（C）
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import p6_boards
from .conftest import Bridge, candidate_of, tokens
from .test_u7_5e import handle_of

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))
COST = EXPECTED["retreat_cost_evaluation"]
VOLATILE = ("game", "revision")


@pytest.fixture()
def p6(monkeypatch):
    p6_boards.install(scenarios, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1"))


def start(b, board_id):
    created = b.create(mode="scenario", scenario=board_id)
    assert created["ok"] and created["match"]["origin"]["scenario"] == board_id
    return tokens(created["match"])


def retreat_of(b, token):
    response = b.seat(token, "candidates")["response"]
    cand = candidate_of(response, "retreat")
    assert cand is not None
    handle = handle_of(response, cand)
    return response, cand, handle, b.seat(token, "inputs", **handle)["response"]


def strip(value):
    if isinstance(value, dict):
        return {k: strip(v) for k, v in value.items() if k not in VOLATILE}
    if isinstance(value, list):
        return [strip(v) for v in value]
    return value


def keys_in(value):
    if isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from keys_in(v)
    elif isinstance(value, list):
        for v in value:
            yield from keys_in(v)


def others_text(b, t):
    """相手・観戦者に届くもの（view・candidates・updates）。"""
    parts = [b.seat(t[1], "view"), b.seat(t["spectator"], "view"), b.seat(t[1], "candidates"), b.updates(t[1]), b.updates(t["spectator"])]
    return json.dumps(parts, ensure_ascii=False)


def own_slot(b, t, player=0):
    return b.seat(t[player], "view")["observation"]["players"][0]["active"]


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (1, "spectator")}


SHAPES = {  # check の答え（形だけ）。費用・本当のカードによらない
    ("o1",): (True, None),  # エネルギー 0 枚（足りるかはエンジンが送信で決める）
    ("o1", "o2"): (True, None),
    (): (False, "CANDIDATE_INPUT_INVALID"),
    ("o9",): (False, "CANDIDATE_INPUT_INVALID"),
    ("o2",): (False, "CANDIDATE_INPUT_INVALID"),  # 段の並び（エネルギーが先）
    ("o2", "o1"): (False, "CANDIDATE_INPUT_INVALID"),
    ("o1", "o1"): (False, "CANDIDATE_INPUT_INVALID"),
    ("o1", "o2", "o2"): (False, "CANDIDATE_INPUT_INVALID"),  # 重なり
}


def test_contract_shape_and_twins(p6):
    b = p6
    seen = []
    for board_id, real in p6_boards.BOARDS.items():
        t = start(b, board_id)
        response, cand, handle, inputs = retreat_of(b, t[0])
        assert (cand["input_disclosure"], cand["processability"], cand["reasons"]) == ("confirmed", "unverified", ["face_down_reveal_not_evaluated"])
        assert "withheld" not in inputs and cand["id"] not in response["coverage"]["withheld_input_candidates"]
        first, second = inputs["stages"]
        assert [s["role"] for s in inputs["stages"]] == EXPECTED["retreat_stage_roles"]
        assert (first["count"], first["meaning"]) == ({"min": 1, "max": 1}, "pokemon")
        assert all(set(o) <= set(EXPECTED["board_option_keys"]) for o in first["options"])
        assert (second["count"], second["meaning"], second["distinct"], second["order"], second["order_preserved"]) == ({"min": 0, "max": 1}, "card", True, "significant", True)
        assert second["cost_evaluation"] == COST
        assert "total_units" not in second and all("units" not in o for o in second["options"])
        assert not {"total_units", "units"} & set(keys_in(inputs))  # 項目の名前として（omitted・note の文の中の名前は数えない）
        assert all(set(o) <= set(EXPECTED["retreat_discard_option_keys"]) for o in second["options"])
        assert all((o["eligible"], o["processability"]) == (True, "unverified") for o in [*first["options"], *second["options"]])
        assert set(second) <= set(EXPECTED["stage_keys"])
        checks = {choices: b.seat(t[0], "check", **handle, choices=list(choices))["response"] for choices in SHAPES}
        for choices, (valid, code) in SHAPES.items():
            got = checks[choices]
            assert (got["valid"], got["refusal"] and got["refusal"]["code"]) == (valid, code), (board_id, choices)
        own = json.dumps(strip([response, inputs, checks.__repr__()]), ensure_ascii=False)
        assert real not in own  # 本人の候補・入力・check にも本当のカード ID を書かない（本人の観測の real は別）
        assert real not in others_text(b, t)  # 相手・観戦者の応答に本当のカードがない
        assert candidate_of(b.seat(t[1], "candidates")["response"], "retreat") is None
        slot = own_slot(b, t)
        assert slot.get("face_down") is True and slot["real"]["card_id"] == real  # 本人の観測にだけ本人の知識（GUI は費用の計算に使わない）
        seen.append(strip([response, inputs, {str(k): v for k, v in checks.items()}]))
    assert seen[0] == seen[1] == seen[2]  # 件数・並び・制約・理由・check の答えが本当のカード（費用・タイプ・段階）によらない


def test_a_accepted_and_revealed(p6):
    b = p6
    t = start(b, "p6_face_down_retreat_a")
    _response, _cand, handle, inputs = retreat_of(b, t[0])
    bench_pokemon = inputs["stages"][0]["options"][0]["pokemon"]
    assert b.seat(t[0], "check", **handle, choices=["o1"])["response"]["valid"] is True
    latest = latest_of(b, t)
    result = b.seat(t[0], "submit", **handle, choices=["o1"], operation_id="p6-a")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")
    stale = b.seat(t[0], "check", **handle, choices=["o1"])
    assert (stale["refetch_required"], stale["response"]["refusal"]["code"]) == (True, "CANDIDATES_STALE")  # 受理で取っ手は失効する
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"]  # 受理は公開の更新になる
    p0 = b.seat(t[1], "view")["observation"]["players"][0]  # 相手の観測から（公開）
    assert p0["active"]["pokemon_id"] == bench_pokemon and "face_down" not in p0["active"]
    revealed = p0["bench"][0]
    assert revealed["card_id"] == p6_boards.RATTATA and "face_down" not in revealed and len(revealed["energy"]) == 1  # おもてにしたカードは全員に公開
    # 受理のあとの候補は取り直した新しい取っ手のもの（同じ番にもう一度にげられるかは GUI で数えず、エンジンの候補のまま。ここでは確かめない）
    assert b.seat(t[0], "candidates")["response"]["revision"] != handle["revision"]


def test_b_rejected_only_to_sender_and_stays_face_down(p6):
    b = p6
    t = start(b, "p6_face_down_retreat_b")
    _response, _cand, handle, _inputs = retreat_of(b, t[0])
    before = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    latest = latest_of(b, t)
    assert b.seat(t[0], "check", **handle, choices=["o1", "o2"])["response"] == {"valid": True, "refusal": None}  # check は費用を見ない
    result = b.seat(t[0], "submit", **handle, choices=["o1", "o2"], operation_id="p6-b")
    assert (result["outcome"], result["refetch_required"]) == ("rejected", False)
    assert result["result"]["diagnostic_id"] and result["result"]["role"] == "actor"  # 診断は送った本人への応答にだけ
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []  # 拒否は公開の更新にしない
        assert b.seat(t[w], "view") == before[w]  # 相手・観戦者の見え方は変わらない
    assert p6_boards.ONIX not in others_text(b, t) and "p6-b" not in others_text(b, t)
    slot = own_slot(b, t)
    assert slot.get("face_down") is True  # 状態はもどり、うらのまま（おもてにしたことも残らない）
    assert b.seat(t[0], "check", **handle, choices=["o1", "o2"])["response"]["valid"] is True  # 拒否では取っ手は失効しない（エンジンの契約）


def test_c_trashed_then_promote_decision(p6):
    b = p6
    t = start(b, "p6_face_down_retreat_c")
    _response, _cand, handle, _inputs = retreat_of(b, t[0])
    assert b.seat(t[0], "check", **handle, choices=["o1"])["response"]["valid"] is True
    latest = latest_of(b, t)
    result = b.seat(t[0], "submit", **handle, choices=["o1"], operation_id="p6-c")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "awaiting_decision")
    assert [(n["kind"], n.get("player")) for n in result["result"]["next"]] == [("answer_decision", 0)]
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"]
    p0 = b.seat(t["spectator"], "view")["observation"]["players"][0]
    assert p0["active"] is None  # ついているカードといっしょにトラッシュ（にげるはおこらない）
    assert p6_boards.KADABRA in json.dumps(p0, ensure_ascii=False)  # おもてにしてトラッシュしたカードは公開（観戦者の観測から）
    own = b.seat(t[0], "candidates")["response"]
    promote = candidate_of(own, "promote_active")
    assert promote is not None and [c["kind"] for c in own["candidates"]] == ["promote_active"]  # 続く決定へ接続する（既存の決定の入力で答える）
    stages = b.seat(t[0], "inputs", **handle_of(own, promote))["response"]["stages"]
    choice = stages[0]["options"][0]["id"]
    answered = b.seat(t[0], "submit", **handle_of(own, promote), choices=[choice], operation_id="p6-c-promote")
    assert answered["outcome"] == "accepted"
    assert b.seat(t[1], "view")["observation"]["players"][0]["active"]["card_id"] == p6_boards.HITMONCHAN
