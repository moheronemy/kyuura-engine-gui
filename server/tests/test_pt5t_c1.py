"""PT-5t-C1（エンジン 0.179.0）: トレーナーの候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず、その選べるものを unverified
（face_down_reveal_not_evaluated）にする補強を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。確認された秘密依存の判定を
候補の側で採用しない補強で、修正の前の構築盤面でも外へ出る差は再現していない（エンジンの docs/legal-actions-up5t-d-trainer-audit.md 12 章）。新しい語彙はない。

盤面は ``tests/pt5t_boards.py`` の構築盤面（エンジンの PT-5t-C1 のテストの盤面を写したもの。new_game からの到達ではない）。テストの中だけで固定例の表に加える
（製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行う。

- 双子（相手のうらのカードの本当のカードだけが違う）: 比べる前に、使う人（プレイヤー 1）と観戦者の観測が同じ・相手本人（プレイヤー 0）の観測は違う（全員の知識が同じではない）
- 使う人の候補・inputs・check は双子で同じ。同じ play_trainer の候補に、unverified（ねむれ!ねむれ!・トロピカルウインド）と may_stop_later（マサキ）の選べるものが並び、
  候補全体は may_stop_later（候補全体と選べるものごとの区分は別）
- check は状態・更新を変えない。おもての対照・本人のうらの対照（イマクニ？）は may_stop_later（不必要に未確認にしない）。読む前の公開の拒否（［アレルギーかふん］）は候補に出ない
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine import legal_actions as L
from kyuura_engine.observation import observe, visible_log

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import pt5t_boards as KB
from .conftest import Bridge, tokens
from .test_u7_5e import handle_of

VOLATILE = ("game", "revision")
EVALUATED = ["continuation_not_evaluated", "preflight_not_evaluated"]
FACE_DOWN = ["continuation_not_evaluated", "face_down_reveal_not_evaluated", "preflight_not_evaluated"]


@pytest.fixture()
def b(monkeypatch):
    KB.install(scenarios, monkeypatch)
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


def trainers(response):
    return [c for c in response["candidates"] if c["kind"] == "play_trainer"]


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (0, 1, "spectator")}


def queries(b, t, actor=1):
    """使う人の候補・inputs・選べるものごとの check と不正な入力の check。check の前後の観測・更新の数。"""
    before = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
    latest = latest_of(b, t)
    response = b.seat(t[actor], "candidates")["response"]
    (cand,) = trainers(response)
    handle = handle_of(response, cand)
    inputs = b.seat(t[actor], "inputs", **handle)["response"]
    checks = [b.seat(t[actor], "check", **handle, choices=[o["id"]])["response"] for o in inputs["stages"][0]["options"]]
    bad = b.seat(t[actor], "check", **handle, choices=["o9"])["response"]
    after = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
    assert after == before  # 候補・inputs・check は状態を変えない
    for w in (0, 1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []  # 他者へ本人の候補・診断を出さない（本人にも更新はない）
    return {"candidates": strip(response), "inputs": strip(inputs), "checks": checks, "check_bad": bad}, cand, handle, inputs


def by_card(inputs):
    return {o["card_id"]: o for o in inputs["stages"][0]["options"]}


@pytest.mark.parametrize("trainer", ["sleep", "tropical"])
def test_twins_share_actor_responses_and_mixed_options(b, trainer):
    card = KB.TRAINERS[trainer]
    views, results = {}, {}
    for key, real in KB.REALS.items():
        t = start(b, f"pt5t_{trainer}_{key}")
        views[key] = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
        results[key], cand, _handle, inputs = queries(b, t)
        # 候補全体は may_stop_later（選べるものの中のいちばんよい区分）。選べるものごとに unverified と may_stop_later が並ぶ
        assert (cand["processability"], cand["reasons"], cand["input_disclosure"]) == ("may_stop_later", EVALUATED, "confirmed")
        assert cand["guarantees"]["preconditions"] == L.GUARANTEE_TRAINER["preconditions"] and "v0.179:" in cand["guarantees"]["preconditions"]  # 説明の 1 文（表示だけ）
        options = by_card(inputs)
        assert list(options) == [card, KB.BILL]  # 選べるものは本人の手札（エンジンが返したものだけ）
        assert (options[card]["processability"], options[card]["reasons"], options[card]["eligible"]) == ("unverified", FACE_DOWN, True)
        assert (options[KB.BILL]["processability"], options[KB.BILL]["reasons"], options[KB.BILL]["eligible"]) == ("may_stop_later", EVALUATED, True)
        assert all(c == {"valid": True, "refusal": None} for c in results[key]["checks"])  # 構造の検査だけ（使える・受理・完走の保証ではない）
        assert (results[key]["check_bad"]["valid"], results[key]["check_bad"]["refusal"]["code"]) == (False, "CANDIDATE_INPUT_INVALID")
        public = json.dumps([views[key][1], views[key]["spectator"], results[key]], ensure_ascii=False)
        assert real not in public  # 使う人・観戦者の応答に本当のカードは出ない（GUI も補わない）
        assert real in json.dumps(views[key][0], ensure_ascii=False)  # 相手本人の観測には本人の知識（real）がある
    first = views["a"]
    for key in KB.REALS:
        assert (views[key][1], views[key]["spectator"]) == (first[1], first["spectator"])  # 比べる前に、使う人と観戦者の知識が同じ（観測は公開のログを含む）
    assert len({json.dumps(v[0], sort_keys=True, ensure_ascii=False) for v in views.values()}) == len(KB.REALS)  # 相手本人の知識は違う
    assert len({json.dumps(r, sort_keys=True, ensure_ascii=False) for r in results.values()}) == 1  # 使う人の候補・inputs・check は本当のカードによらない


@pytest.mark.parametrize("trainer", ["sleep", "tropical"])
def test_twins_share_public_log_but_not_the_owner_knowledge(trainer):
    """比べる前の確かめ（エンジンの公開の関数。盤面はテスト専用）: 使う人と観戦者の観測・公開のログが双子で同じ。相手本人の観測は違う。HTTP の view にログはないので、ここで直接見る。"""
    states = {k: KB.board_state(*KB.BOARDS[f"pt5t_{trainer}_{k}"]) for k in KB.REALS}
    known = {k: (observe(s, 1), observe(s, None), visible_log(s, 1), visible_log(s, None)) for k, s in states.items()}
    assert all(v == known["a"] for v in known.values())
    assert len({json.dumps(observe(s, 0), sort_keys=True, ensure_ascii=False, default=str) for s in states.values()}) == len(KB.REALS)


@pytest.mark.parametrize("trainer", ["sleep", "tropical"])
def test_face_up_control_is_evaluated(b, trainer):
    t = start(b, f"pt5t_{trainer}_face_up")
    _results, cand, _handle, inputs = queries(b, t)
    option = by_card(inputs)[KB.TRAINERS[trainer]]
    assert (cand["processability"], option["processability"], option["reasons"]) == ("may_stop_later", "may_stop_later", EVALUATED)


def test_own_face_down_control_and_public_refusal(b):
    t = start(b, "pt5t_own_face_down_a")
    _results, _cand, _handle, inputs = queries(b, t, actor=0)
    option = by_card(inputs)[KB.IMAKUNI]
    assert (option["processability"], option["reasons"]) == ("may_stop_later", EVALUATED)  # 本人の知識だけ: 未確認にしない
    t = start(b, "pt5t_sleep_allergy_a")
    assert trainers(b.seat(t[1], "candidates")["response"]) == []  # 読む前の公開の拒否: 選べるものに出ない（候補がない）


@pytest.mark.parametrize("trainer", ["sleep", "tropical"])
def test_check_then_submit_does_not_depend_on_the_real_card(b, trainer):
    """unverified の選べるものを check のあとに送る。結果はエンジンの応答に従う（GUI は予告しない）。受け付けるかは本当のカードによらない。拒否なら本人だけ。"""
    outcomes = []
    for key in KB.REALS:
        t = start(b, f"pt5t_{trainer}_{key}")
        _results, _cand, handle, inputs = queries(b, t)
        choice = [by_card(inputs)[KB.TRAINERS[trainer]]["id"]]
        assert b.seat(t[1], "check", **handle, choices=choice)["response"]["valid"] is True
        latest = latest_of(b, t)
        sent = b.seat(t[1], "submit", **handle, choices=choice, operation_id=f"pt5t-{trainer}-{key}")
        outcomes.append(sent["outcome"])
        if sent["outcome"] == "accepted":
            assert sent["refetch_required"] is True
            assert b.updates(t["spectator"], latest["spectator"])["updates"]  # 受理は公開の更新（観測で表示する）
        else:
            assert sent["result"]["role"] == "actor"
            assert b.updates(t["spectator"], latest["spectator"])["updates"] == []
    assert len(set(outcomes)) == 1, outcomes
