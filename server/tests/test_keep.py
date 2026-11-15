"""0.181.0（E12 の修正）: 答えで指定しておもてにした相手のうらのカードが［KEEP］を持つとき、エネルギー・リムーブ・超エネルギーリムーブは、内部の例外（submit の
failed）でなく既存の KP1（UNRESOLVED_KEEP_PROTECTED_TARGET）の通常の拒否（rejected）になることを、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。
模擬の応答を使わない）。新しい裁定・診断コード・語彙はない（エンジンの docs/keep-designated-energy-removal-v0.181.md）。

盤面は ``tests/keep_boards.py``（エンジンの 0.181.0 の KEEP のテストの盤面を写したもの。new_game からの到達ではない）。テストの中だけで固定例の表に加える
（製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行い、入力はエンジンが返した選べるものの
id と本人の観測（相手のベンチ・バトル場のエネルギーの card・pokemon_id）だけで作る（カード名・本当のカードから作らない）。状態・乱数・ログ・決定が拒否で変わらないことだけは、
テストの中で控えた ClientHub の状態で確かめる（``test_r3a.py`` と同じ）。

- 双子（相手のうらの本当のカードだけが違う: たね・たねでない・［KEEP］のたね）: 比べる前に、本人（プレイヤー 0）と観戦者の観測が同じ・持ち主（プレイヤー 1）の観測は違う
- エネルギー・リムーブ: 候補・inputs・check（valid）は同じ。submit は rejected・KP1（failed・INTERNAL_ERROR ではない）・本人だけ・状態・乱数・ログ・決定・観測は変わらない・
  だれにも更新はない。同じ決定で相手のバトル場のエネルギーを選び直すと受理され、全員に通常の更新（選ばなかったうらはうらのまま）
- おもての対照（［KEEP］のないおもて）: 受理
- 超エネルギーリムーブ: 段階 2 で相手のうらを選ぶと KP1（双子で同じ）。選び直せば段階 3 の決定。相手のうらだけが対象の盤面は、使う時点の既存の確かめで FC1（KP1 にそろえない）
"""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.effects import KEEP_TARGET_CODE, STATED_CARDS_SHORT_CODE
from kyuura_engine.observation import visible_log
from kyuura_engine.rng import rng_fingerprint
from kyuura_engine.serialize import state_to_dict

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import keep_boards as KB
from .conftest import Bridge, tokens
from .p6_boards import install_boards
from .test_u7_5e import handle_of

VOLATILE = ("game", "revision")
SEATS = (0, 1, "spectator")
# 相手のうらの本当のカード（本人・観戦者の応答に出ないことの確かめだけに使う。炎エネルギーは本人の山札・手札にもあるので名前・ID では確かめない）
SECRET_TEXT = {"keep_er_a": ("PMCG1-052", "ディグダ"), "keep_er_c": (KB.UNOWN_K, "アンノーンK"), "keep_ser_a": ("PMCG1-052", "ディグダ"), "keep_ser_c": (KB.UNOWN_K, "アンノーンK"),
               "keep_ser_only_a": ("PMCG1-052", "ディグダ"), "keep_ser_only_c": (KB.UNOWN_K, "アンノーンK")}


@pytest.fixture()
def keep(monkeypatch):
    hubs = {}

    def build(board_id):  # テストの中だけ: 作った ClientHub を控える（状態・乱数・ログ・決定の確かめのため）
        hub = KB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (KB.LABELS[b], KB.DESCRIPTION, build) for b in KB.BOARDS}, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def start(b, board_id):
    created = b.create(mode="scenario", scenario=board_id)
    assert created["ok"] and created["match"]["origin"]["scenario"] == board_id
    return tokens(created["match"])


def strip(value):
    if isinstance(value, dict):
        return {k: strip(v) for k, v in value.items() if k not in VOLATILE}
    if isinstance(value, list):
        return [strip(v) for v in value]
    return value


def full(hub):
    """状態の書き出し・乱数の指紋・公開のログ（相手・観戦者）・決定。"""
    state = hub._state()
    exported = json.dumps(state_to_dict(state, format_version=22), sort_keys=True, ensure_ascii=False)
    return (hashlib.sha256(exported.encode()).hexdigest(), rng_fingerprint(state.rng), len(state.log), visible_log(state, 1), visible_log(state, None),
            state.decision.id if state.decision else None)


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in SEATS}


def new_updates(b, t, latest):
    return {w: b.updates(t[w], latest[w])["updates"] for w in SEATS}


def play(b, t, trainer):
    """本人の手札の ``trainer`` を check のあとに送る（選べるものは本人の手札の card_id）。応答の組を返す。"""
    response = b.seat(t[0], "candidates")["response"]
    (cand,) = [c for c in response["candidates"] if c["kind"] == "play_trainer"]
    handle = handle_of(response, cand)
    inputs = b.seat(t[0], "inputs", **handle)["response"]
    choice = [next(o["id"] for o in inputs["stages"][0]["options"] if o["card_id"] == trainer)]
    check = b.seat(t[0], "check", **handle, choices=choice)["response"]
    return cand, check, b.seat(t[0], "submit", **handle, choices=choice)


def decision(b, t):
    response = b.seat(t[0], "candidates")["response"]
    (cand,) = [c for c in response["candidates"] if c["kind"] == "answer_decision"]
    handle = handle_of(response, cand)
    return cand, handle, b.seat(t[0], "inputs", **handle)["response"]


def opponent(b, t):
    """本人の観測の相手のベンチ（1 匹）とバトル場。"""
    p1 = b.seat(t[0], "view")["observation"]["players"][1]
    (bench,) = p1["bench"]
    return bench, p1["active"]


def pick(inputs, target):
    """選べるものから、``target``（本人の観測のポケモン）に当たるものを選ぶ（段階 2 は pokemon_id、エネルギーの段は card）。"""
    stage = inputs["stages"][0]
    if stage["meaning"] == "pokemon":
        return [next(o["id"] for o in stage["options"] if o["value"] == target["pokemon_id"])]
    cards = {e["card"] for e in target["energy"]}
    return [o["id"] for o in stage["options"] if o["card"] in cards][: stage["count"]["min"]]


def rejected_unchanged(b, t, hub, handle, choices, code):
    """check は valid、submit は rejected（code）。状態・乱数・ログ・決定・全員の観測は変わらず、だれにも更新はない。診断は送った本人の応答だけ。"""
    check = b.seat(t[0], "check", **handle, choices=choices)["response"]
    assert check == {"valid": True, "refusal": None}  # 形の検査だけ（受理の保証ではない）
    before, views, latest = full(hub), {w: b.seat(t[w], "view") for w in SEATS}, latest_of(b, t)
    sent = b.seat(t[0], "submit", **handle, choices=choices)
    assert (sent["outcome"], sent["refetch_required"]) == ("rejected", False)
    result = sent["result"]
    assert (result["role"], result["viewer"], result["outcome"], result["diagnostic_id"], result["continuable"]) == ("actor", 0, "rejected", code, True)
    assert result["category"] == "unresolved_ruling"  # 未裁定・未対応（ゲーム上の禁止ではない）。新しい区分はない
    assert "INTERNAL_ERROR" not in json.dumps(sent) and sent["outcome"] != "failed"
    assert full(hub) == before
    assert {w: b.seat(t[w], "view") for w in SEATS} == views
    assert new_updates(b, t, latest) == {w: [] for w in SEATS}  # 拒否の有無・中身を相手・観戦者へ出さない（本人にも更新はない）
    return check, sent


def no_secret(board_id, *responses):
    if board_id in SECRET_TEXT:
        text = json.dumps(responses, ensure_ascii=False)
        assert not any(s in text for s in SECRET_TEXT[board_id])


def known(b, t):
    return {w: strip(b.seat(t[w], "view")) for w in SEATS}


def twins_known_the_same(seen):
    """比べる前の確かめ（双子ごとの、比べる操作の前の観測）: 本人と観戦者の観測が双子で同じ。持ち主（プレイヤー 1）の観測は違う（全員の知識が同じではない）。
    接続層は対戦を 1 つだけ持つ（新しい対戦で古い対戦を捨てる）ので、双子は 1 つずつ作り、観測を控えてから比べる。"""
    first = next(iter(seen.values()))
    assert all((v[0], v["spectator"]) == (first[0], first["spectator"]) for v in seen.values())
    assert len({json.dumps(v[1], sort_keys=True, ensure_ascii=False) for v in seen.values()}) == len(seen)


def test_energy_removal_twins_kp1_then_another_answer_is_accepted(keep):
    b, hubs = keep
    results, seen = {}, {}
    for key in KB.SECRETS:
        board_id = f"keep_er_{key}"
        t = start(b, board_id)
        cand, check, sent = play(b, t, KB.ENERGY_REMOVAL)
        assert (check["valid"], sent["outcome"], sent["result"]["status"]) == (True, "accepted", "awaiting_decision")
        seen[key] = known(b, t)
        cand, handle, inputs = decision(b, t)
        bench, active = opponent(b, t)
        assert bench["face_down"] is True
        choices = pick(inputs, bench)
        check, sent = rejected_unchanged(b, t, hubs[board_id], handle, choices, KEEP_TARGET_CODE)
        results[key] = strip({"candidate": cand, "inputs": inputs, "choices": choices, "check": check, "submit": sent})
        no_secret(board_id, b.seat(t[0], "view"), b.seat(t["spectator"], "view"), results[key])
        # 拒否のあとも同じ決定に答えられる（取り直した候補で選び直す。前の check は使わない）
        latest = latest_of(b, t)
        cand2, handle2, inputs2 = decision(b, t)
        assert strip(inputs2) == strip(inputs)
        again = pick(inputs2, active)
        assert b.seat(t[0], "check", **handle2, choices=again)["response"]["valid"] is True
        accepted = b.seat(t[0], "submit", **handle2, choices=again)
        assert (accepted["outcome"], accepted["refetch_required"], accepted["result"]["diagnostic_id"]) == ("accepted", True, None)
        assert {w: len(u) for w, u in new_updates(b, t, latest).items()} == {0: 1, 1: 1, "spectator": 1}  # 受理は全員への通常の更新
        bench_after, active_after = opponent(b, t)
        assert bench_after["face_down"] is True and bench_after["energy"] == bench["energy"]  # 選ばなかったうらはうらのまま
        assert active_after["energy"] == []
    twins_known_the_same(seen)
    first = results["a"]
    assert all(r == first for r in results.values())  # 候補・inputs・check・submit・診断は本当のカードによらない


def test_face_up_without_keep_is_accepted(keep):
    b, _hubs = keep
    t = start(b, "keep_er_face_up")
    assert play(b, t, KB.ENERGY_REMOVAL)[2]["outcome"] == "accepted"
    _cand, handle, inputs = decision(b, t)
    bench, _active = opponent(b, t)
    assert "face_down" not in bench or bench["face_down"] is False
    choices = pick(inputs, bench)
    assert b.seat(t[0], "check", **handle, choices=choices)["response"]["valid"] is True
    sent = b.seat(t[0], "submit", **handle, choices=choices)
    assert sent["outcome"] == "accepted"
    assert opponent(b, t)[0]["energy"] == []


def test_super_energy_removal_stage2_twins_kp1(keep):
    b, hubs = keep
    results, seen = {}, {}
    for key in KB.SECRETS:
        board_id = f"keep_ser_{key}"
        t = start(b, board_id)
        assert play(b, t, KB.SUPER_ENERGY_REMOVAL)[2]["outcome"] == "accepted"
        _cand, handle, inputs = decision(b, t)  # 段階 1: 自分のエネルギー
        assert inputs["stages"][0]["meaning"] == "card"
        assert b.seat(t[0], "submit", **handle, choices=[inputs["stages"][0]["options"][0]["id"]])["outcome"] == "accepted"
        seen[key] = known(b, t)
        cand, handle, inputs = decision(b, t)  # 段階 2: 相手のポケモン
        assert inputs["stages"][0]["meaning"] == "pokemon"
        bench, active = opponent(b, t)
        choices = pick(inputs, bench)
        check, sent = rejected_unchanged(b, t, hubs[board_id], handle, choices, KEEP_TARGET_CODE)
        results[key] = strip({"candidate": cand, "inputs": inputs, "choices": choices, "check": check, "submit": sent})
        no_secret(board_id, b.seat(t[0], "view"), b.seat(t["spectator"], "view"), results[key])
        _cand2, handle2, inputs2 = decision(b, t)
        again = pick(inputs2, active)
        assert b.seat(t[0], "submit", **handle2, choices=again)["outcome"] == "accepted"
        _cand3, _handle3, inputs3 = decision(b, t)  # 段階 3: 相手のバトル場のエネルギー（通常の続き）
        assert inputs3["stages"][0]["meaning"] == "card" and {o["card"] for o in inputs3["stages"][0]["options"]} == {e["card"] for e in active["energy"]}
    twins_known_the_same(seen)
    assert all(r == results["a"] for r in results.values())


def test_super_energy_removal_only_face_down_target_is_fc1_at_play(keep):
    """エネルギー 2 枚のポケモンが相手のうらだけなら、使う時点の既存の確かめで FC1（KP1 にそろえない）。候補と check は valid のまま、本当のカードによらない。"""
    b, hubs = keep
    results, seen = {}, {}
    for key in KB.SECRETS:
        board_id = f"keep_ser_only_{key}"
        t = start(b, board_id)
        seen[key] = known(b, t)
        hub = hubs[board_id]
        before, views, latest = full(hub), {w: b.seat(t[w], "view") for w in SEATS}, latest_of(b, t)
        cand, check, sent = play(b, t, KB.SUPER_ENERGY_REMOVAL)
        assert check["valid"] is True
        assert (sent["outcome"], sent["result"]["diagnostic_id"], sent["result"]["role"]) == ("rejected", STATED_CARDS_SHORT_CODE, "actor")
        assert full(hub) == before and {w: b.seat(t[w], "view") for w in SEATS} == views
        assert new_updates(b, t, latest) == {w: [] for w in SEATS}
        results[key] = strip({"candidate": cand, "check": check, "submit": sent})
        no_secret(board_id, results[key])
    twins_known_the_same(seen)
    assert all(r == results["a"] for r in results.values())
