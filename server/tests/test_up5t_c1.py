"""UP-5t-C1（エンジン 0.178.0）: 特殊能力の候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず unverified（face_down_reveal_not_evaluated）にする
補強を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。確認された秘密依存の判定を候補の側で採用しない補強で、修正の前の
構築盤面でも外へ出る差は再現していない（エンジンの docs/legal-actions-up5t-audit.md 11 章）。新しい種類・段・処理可能性・理由の語彙はない。

盤面は ``tests/up5t_boards.py`` の構築盤面（エンジンの UP-5t-C1 のテストの盤面を写したもの。new_game からの到達ではない）。テストの中だけで固定例の表に加える
（製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行う。

- 双子（相手のうらのカードの本当のカードだけが違う）: 比べる前に、使う人（プレイヤー 1）と観戦者の観測が同じ・相手本人（プレイヤー 0）の観測は違う（全員の知識が同じではない）
- 使う人の候補・inputs・check は双子で同じ（unverified・face_down_reveal_not_evaluated・no_input・段なし）。本当のカードは使う人・観戦者の応答に出ない
- check は状態・更新を変えない。おもての対照は may_stop_later。公開の条件で使えない（こんらん）なら候補がない
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine import legal_actions as L

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import up5t_boards as UB
from .conftest import Bridge, tokens
from .test_u7_5e import handle_of

VOLATILE = ("game", "revision")
REASON = "face_down_reveal_not_evaluated"


@pytest.fixture()
def b(monkeypatch):
    UB.install(scenarios, monkeypatch)
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


def powers(response):
    return [c for c in response["candidates"] if c["kind"] == "use_power"]


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (0, 1, "spectator")}


def queries(b, t):
    """使う人（プレイヤー 1）の候補・inputs・check（[] と不正な入力）。check の前後の観測・更新の数。"""
    before = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
    latest = latest_of(b, t)
    response = b.seat(t[1], "candidates")["response"]
    (cand,) = powers(response)
    handle = handle_of(response, cand)
    inputs = b.seat(t[1], "inputs", **handle)["response"]
    check = b.seat(t[1], "check", **handle, choices=[])["response"]
    bad = b.seat(t[1], "check", **handle, choices=["o1"])["response"]
    after = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
    assert after == before  # 候補・inputs・check は状態を変えない
    for w in (0, 1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []  # 他者へ本人の候補・診断を出さない（本人にも更新はない）
    return {"candidates": strip(response), "inputs": strip(inputs), "check": check, "check_bad": bad}, cand, handle


@pytest.mark.parametrize("power", ["kusaikafun", "enkakusaimin"])
def test_twins_share_actor_responses_and_hide_the_real_card(b, power):
    views, results, real_ids = {}, {}, {}
    for key, real in UB.REALS.items():
        board_id = f"up5t_{power}_{key}"
        t = start(b, board_id)
        views[key] = {w: strip(b.seat(t[w], "view")) for w in (0, 1, "spectator")}
        results[key], cand, _handle = queries(b, t)
        real_ids[key] = real
        assert (cand["processability"], cand["reasons"], cand["input_disclosure"], cand["input_stages"]) == ("unverified", [REASON], "no_input", [])
        assert cand["guarantees"]["preconditions"] == L.GUARANTEE_POWER["preconditions"] and "v0.178:" in cand["guarantees"]["preconditions"]  # 説明の 1 文（表示だけ）
        assert results[key]["inputs"]["stages"] == []
        assert results[key]["check"] == {"valid": True, "refusal": None}  # 構造の検査だけ（受理・完走の保証ではない）
        assert (results[key]["check_bad"]["valid"], results[key]["check_bad"]["refusal"]["code"]) == (False, "CANDIDATE_INPUT_INVALID")
        public = json.dumps([views[key][1], views[key]["spectator"], results[key]], ensure_ascii=False)
        assert real not in public  # 使う人・観戦者の応答に本当のカードは出ない（GUI も補わない）
        assert real in json.dumps(views[key][0], ensure_ascii=False)  # 相手本人の観測には本人の知識（real）がある
    first = views["a"]
    for key in UB.REALS:
        assert (views[key][1], views[key]["spectator"]) == (first[1], first["spectator"])  # 比べる前に、使う人と観戦者の知識が同じ
    assert len({json.dumps(v[0], sort_keys=True, ensure_ascii=False) for v in views.values()}) == len(UB.REALS)  # 相手本人の知識は違う（全員が同じではない）
    assert len({json.dumps(r, sort_keys=True, ensure_ascii=False) for r in results.values()}) == 1  # 使う人の候補・inputs・check は本当のカードによらない


@pytest.mark.parametrize("power", ["kusaikafun", "enkakusaimin"])
def test_face_up_control_and_publicly_unusable(b, power):
    t = start(b, f"up5t_{power}_face_up")
    response = b.seat(t[1], "candidates")["response"]
    (cand,) = powers(response)
    assert (cand["processability"], cand["reasons"], cand["input_disclosure"]) == ("may_stop_later", ["continuation_not_evaluated"], "no_input")
    t = start(b, f"up5t_{power}_confused_a")
    assert powers(b.seat(t[1], "candidates")["response"]) == []  # こんらん: 公開の条件で使えないので候補に出ない


@pytest.mark.parametrize("power", ["kusaikafun", "enkakusaimin"])
def test_check_then_submit_does_not_depend_on_the_real_card(b, power):
    """check のあとに送る。結果はエンジンの観測に従う（GUI は予告しない）。受け付けるかは本当のカードによらない。拒否なら診断は本人だけ。"""
    outcomes = []
    for key in UB.REALS:
        t = start(b, f"up5t_{power}_{key}")
        _results, _cand, handle = queries(b, t)
        latest = latest_of(b, t)
        sent = b.seat(t[1], "submit", **handle, choices=[], operation_id=f"up5t-{power}-{key}")
        outcomes.append(sent["outcome"])
        if sent["outcome"] == "accepted":
            assert sent["refetch_required"] is True
            assert b.updates(t["spectator"], latest["spectator"])["updates"]  # 受理は公開の更新（観測で表示する）
        else:
            assert sent["result"]["role"] == "actor"
            assert b.updates(t["spectator"], latest["spectator"])["updates"] == []
    assert len(set(outcomes)) == 1, outcomes
