"""F-1（エンジン 0.180.0）: 本人のうらのバトル場のポケモンのワザの候補だけに、実装に合う保証の文（GUARANTEE_FACE_DOWN_ATTACK）が付くことを、接続層が client_api へ
そのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。直したのは保証の文と実装の対応だけで、候補・入力・check・submit・裁定は変わらない
（エンジンの docs/legal-actions-f1-face-down-attack-guarantee.md）。新しい語彙・項目の名前はない。

盤面は ``tests/f1_boards.py``（P6 の構築盤面 3 つの再利用と、F-1 の 2 つ。エンジンの F-1 のテストの盤面を写したもの。new_game からの到達ではない）。
テストの中だけで固定例の表に加える（製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行い、
入力はエンジンが返した選べるものの id だけで作る（カード名・カード ID・本人の real から作らない。結果の確かめにだけ選べるものの名前を使う）。

- うら（本当のカード 4 つ）: 保証の文は GUARANTEE_FACE_DOWN_ATTACK で、本当のカード（ワザの有無を含む）によらず同じ。エンジンのテストと同じ sha256
- おもての対照: GUARANTEE_ATTACK（0.179.0 の値。エンジンのテストと同じ sha256）
- 保証の文以外（区分・理由・入力の公開・段・選べるもの・check）はエンジンのテストの 0.179.0 の値と同じ。ワザのないカードは not_implemented・入力なし
- 情報境界: 相手・観戦者の応答に本当のカード・ワザの名前が出ない（4 つのうらで同じ）。問い合わせは状態・更新を変えない
- 送信: check が valid でも受理の保証ではない（イワークのかたくなるはエネルギー不足で拒否・本人だけ・状態はうらのまま）。受理は公開の更新
"""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine import legal_actions as L

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import f1_boards as FB
from .conftest import Bridge, tokens
from .test_u7_5e import handle_of

VOLATILE = ("game", "revision")
# エンジンの tests/test_legal_actions_f1_v0_180.py の定数（0.179.0 の GUARANTEE_ATTACK と 0.180.0 の GUARANTEE_FACE_DOWN_ATTACK の値の sha256）
ATTACK_0179_SHA256 = "f1e79cef13b69200910504f90614393b2b2344d6dad71b47d25eff260ec5bc5b"
FACE_DOWN_ATTACK_SHA256 = "aa316b12cb9a79033e6d80685a4fbffacfa2e13b1af310bda57d76049b6f1d0c"
FACE_DOWN = ["face_down_reveal_not_evaluated"]
EVALUATED = ["continuation_not_evaluated", "preflight_not_evaluated"]
# 本人だけが知る本当のカードの印刷のワザ（エンジンのテストの値。結果の確かめにだけ使う）
ATTACK_NAMES = {"p6_face_down_retreat_a": ["かみつく"], "p6_face_down_retreat_b": ["いわおとし", "かたくなる"],
                "p6_face_down_retreat_c": ["じこさいせい", "ちょうねんりき"], "f1_face_down_energy": []}
REAL_NAMES = {"p6_face_down_retreat_a": "コラッタ", "p6_face_down_retreat_b": "イワーク", "p6_face_down_retreat_c": "ユンゲラー", "f1_face_down_energy": "炎エネルギー"}


def sha256(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


@pytest.fixture()
def b(monkeypatch):
    FB.install(scenarios, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1"))


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


def attack(b, t):
    response = b.seat(t[0], "candidates")["response"]
    (cand,) = [c for c in response["candidates"] if c["kind"] == "use_attack"]
    handle = handle_of(response, cand)
    return response, cand, handle, b.seat(t[0], "inputs", **handle)["response"]


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (0, 1, "spectator")}


@pytest.mark.parametrize("board", list(FB.FACE_DOWN_BOARDS))
def test_face_down_candidate_carries_the_new_guarantee(b, board):
    t = start(b, board)
    before = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
    latest = latest_of(b, t)
    _r, cand, handle, inputs = attack(b, t)
    assert cand["guarantees"] == L.GUARANTEE_FACE_DOWN_ATTACK and sha256(cand["guarantees"]) == FACE_DOWN_ATTACK_SHA256
    assert set(cand["guarantees"]) == {"preconditions", "acceptance", "after_acceptance", "supported_scope"}  # 項目の名前は 0.179.0 と同じ 4 つ
    assert cand["guarantees"] != L.GUARANTEE_ATTACK
    if ATTACK_NAMES[board]:
        assert (cand["processability"], cand["reasons"], cand["input_disclosure"]) == (L.UNVERIFIED, FACE_DOWN, L.DISCLOSURE_CONFIRMED)
        first, second = inputs["stages"]
        assert [(o["name_ja"], o["face_down"], o["processability"], o["reasons"], o["eligible"]) for o in first["options"]] == [
            (name, True, L.UNVERIFIED, FACE_DOWN, True) for name in ATTACK_NAMES[board]]
        assert (second["count"], second["options"]) == ({"min": 0, "max": 0}, [])  # 宣言といっしょに選ぶものは示さない
        for o in first["options"]:
            assert b.seat(t[0], "check", **handle, choices=[o["id"]])["response"] == {"valid": True, "refusal": None}  # 形だけ（エネルギーを見ない）
        for bad in ([], ["o1", "o2"], ["o9"]):
            assert b.seat(t[0], "check", **handle, choices=bad)["response"]["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    else:  # 印刷のワザがない本当のカード: 入力のない not_implemented（送れない）
        assert (cand["processability"], cand["reasons"]) == (L.NOT_IMPLEMENTED, [*FACE_DOWN, "no_printed_attack"])
        assert inputs["stages"] == []
        assert b.seat(t[0], "check", **handle, choices=[])["response"]["refusal"]["code"] == "CANDIDATE_NOT_EXECUTABLE"
    assert {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")} == before  # 候補・inputs・check は状態を変えない
    for w in (0, 1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []


def test_guarantee_and_public_responses_do_not_depend_on_the_real_card(b):
    """本人の保証の文は 4 つのうらで同じ。相手・観戦者の観測と相手の候補も同じで、本当のカード・ワザの名前は出ない（本人の観測には本人の知識がある）。"""
    seen, public = set(), {}
    for board in FB.FACE_DOWN_BOARDS:
        t = start(b, board)
        _r, cand, _h, _i = attack(b, t)
        seen.add(sha256(cand["guarantees"]))
        others = {"view1": strip(b.seat(t[1], "view")), "spectator": strip(b.seat(t["spectator"], "view")), "candidates1": strip(b.seat(t[1], "candidates"))}
        text = json.dumps(others, ensure_ascii=False)
        for word in [REAL_NAMES[board], *ATTACK_NAMES[board], "あなただけが知る"]:
            assert word not in text, (board, word)
        assert REAL_NAMES[board] in json.dumps(b.seat(t[0], "view"), ensure_ascii=False)  # 本人の観測（real）
        assert all(c["kind"] != "use_attack" for c in others["candidates1"]["response"]["candidates"])  # 相手には本人のワザの候補がない
        public[board] = others
    assert seen == {FACE_DOWN_ATTACK_SHA256}
    first = next(iter(public.values()))
    assert all(v == first for v in public.values())


def test_face_up_control_keeps_the_attack_guarantee(b):
    t = start(b, "f1_face_up")
    _r, cand, handle, inputs = attack(b, t)
    assert cand["guarantees"] == L.GUARANTEE_ATTACK and sha256(cand["guarantees"]) == ATTACK_0179_SHA256
    assert (cand["processability"], cand["reasons"]) == (L.MAY_STOP_LATER, EVALUATED)
    first = inputs["stages"][0]
    assert [(o["name_ja"], o.get("face_down"), o["processability"]) for o in first["options"]] == [("ジャブ", None, L.MAY_STOP_LATER)]
    assert b.seat(t[0], "check", **handle, choices=["o1"])["response"] == {"valid": True, "refusal": None}


def submit(b, board, name):
    t = start(b, board)
    _r, cand, handle, inputs = attack(b, t)
    choice = [next(o["id"] for o in inputs["stages"][0]["options"] if o["name_ja"] == name)]
    assert b.seat(t[0], "check", **handle, choices=choice)["response"]["valid"] is True
    latest = latest_of(b, t)
    sent = b.seat(t[0], "submit", **handle, choices=choice, operation_id=f"f1-{board}-{name}")
    return t, latest, sent


def test_valid_check_is_not_acceptance(b):
    """check が valid でも、エンジンの確かめを通したことではない: イワークのかたくなる（闘 2）はエネルギー不足で拒否。本人だけ・状態はうらのまま・自動で再送しない。"""
    t, latest, sent = submit(b, "p6_face_down_retreat_b", "かたくなる")
    assert sent["outcome"] == "rejected"
    assert (sent["result"]["role"], sent["result"]["diagnostic_id"], sent["result"]["category"]) == ("actor", "INSUFFICIENT_ENERGY", "invalid_input")
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []
    assert b.seat(t[1], "view")["observation"]["players"][0]["active"]["face_down"] is True


@pytest.mark.parametrize(("board", "name"), [("p6_face_down_retreat_a", "かみつく"), ("p6_face_down_retreat_b", "いわおとし")])
def test_accepted_is_a_public_update(b, board, name):
    t, latest, sent = submit(b, board, name)
    assert sent["outcome"] == "accepted" and sent["refetch_required"] is True  # エンジンのテストでも受理（結果は応答で決まる。GUI は予告しない）
    assert b.updates(t["spectator"], latest["spectator"])["updates"]  # 受理は公開の更新（観測で表示する）
