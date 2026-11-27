"""0.193.0（C-TF1）・0.194.0（C-TF2）を、接続層の既存の口でそのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。エンジンの
docs/r2-transform-copied-power-v0.193.md・docs/r2-transform-frozen-reveal-v0.194.md）。

盤面は ``tests/tf_boards.py``（エンジンの回帰テストの盤面を写したもの。new_game からではない）。テストの中だけで固定例の表に加える。
操作は HTTP の口だけで行い、入力はエンジンが返した選べるものの id だけで作る（ワザ = 1 段目の位置・力 = 2 段目の位置・決定 = 公開の観測の相手のベンチの番号と同じ value）。

- C-TF1: おもてのメタモンが写した［XXXXX］（使い手自身）・［すいりょくはつでん］は 2 段目に出ない（番号は欠番のまま）。別の持ち主（ベンチのアンノーンA）は示し、送れる（20）。
  本来の持ち主（おもてのアンノーンX・ランターン）は今までどおり（30）
- 人工の入力（欠番の id）: check は CANDIDATE_INPUT_INVALID、submit は接続層が同じ区分で断る（refused。状態・更新・ログは同じ）。直接のコマンド（接続層を通さない）は
  エンジンの UNSUPPORTED_TRANSFORM_COPIED_POWER で拒否（区別して確かめる）。GUI はカード別の除外判定を持たない
- C-TF2 に関係する既存の操作: おもてのメタモンのきつねび → 交代の決定（forced_switch・任意）→ 回答 → 結果（フシギダネ 20・ゼニガメ 10・入れ替えない 10）。
  決定を待つあいだ相手に回答の候補を出さない。うらから公開した使い手の固定の修正そのものはエンジンのテストの結果（ここでは確かめない）
- うらのメタモン: no_printed_attack の保留（not_implemented・stages []）。check は CANDIDATE_NOT_EXECUTABLE、送信は断る（状態は同じ・うらのまま）
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from kyuura_engine import UseAttack
from kyuura_engine import adapter as A

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import tf_boards as TB
from .conftest import Bridge, tokens
from .p6_boards import install_boards
from .test_r2_unown import A_POWER, INVALID, X_POWER, bench_of, full, log, open_attack, updates

COPY_UNSUPPORTED = "UNSUPPORTED_TRANSFORM_COPIED_POWER"
FACE_UP = ["continuation_not_evaluated", "preflight_not_evaluated"]


@pytest.fixture()
def tb(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = TB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (TB.LABELS[b], TB.DESCRIPTION, build) for b in TB.BOARDS}, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def start(b, board):
    t = tokens(b.create(mode="scenario", scenario=board)["match"])
    return (t, *open_attack(b, t))


def damage(hub):
    s = hub._state()
    a = s.players[1].active
    return s.cards[a.card].card_id, a.damage


def check(b, t, h, choices):
    r = b.seat(t[0], "check", **h, choices=choices)["response"]
    return r["valid"], (r.get("refusal") or {}).get("code")


def unused_id(stages):
    """人工: 示されていない（欠番の）id（示された id に無い最初の番号）。"""
    used = {o["id"] for s in stages for o in s["options"]}
    return next(f"o{n}" for n in range(1, 99) if f"o{n}" not in used)


@pytest.mark.parametrize(("board", "expected"), [
    ("tf1_copy_x", [("with_power", "bench", A_POWER)]),
    ("tf1_copy_lanturn", []),
    ("tf1_orig_x", [("with_power", "active", X_POWER), ("with_power", "bench", A_POWER)]),
    ("tf1_orig_lanturn", [("attack_power", None, None)]),
])
def test_copied_powers_are_not_offered_and_the_others_keep_their_ids(tb, board, expected):
    b, _ = tb
    t, cand, _h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"]) == ("may_stop_later", FACE_UP)
    second = stages[1]
    assert [(o["addon"], o.get("zone"), o.get("power")) for o in second["options"]] == expected
    assert second["count"] == {"min": 0, "max": len(expected)}
    if board == "tf1_copy_x":
        # 写した使い手自身の［XXXXX］（0.192.0 の o2）は欠番、別の持ち主は 0.192.0 と同じ番号（エンジンの InputApiTest と同じ）
        assert [o["id"] for o in second["options"]] == ["o3"]
        assert second["options"][0]["pokemon"] == bench_of(b.seat(t[0], "view"), 0)[0]["pokemon_id"]
    if board == "tf1_orig_x":
        assert [o["id"] for o in second["options"]] == ["o2", "o3"]


def test_check_and_artificial_missing_id(tb):
    b, hubs = tb
    t, _cand, h, stages = start(b, "tf1_copy_x")
    (a1,), (other,) = [o["id"] for o in stages[0]["options"]], [o["id"] for o in stages[1]["options"]]
    missing = unused_id(stages)  # 人工
    before, before_updates, before_log = full(hubs["tf1_copy_x"]), updates(b, t), log(b, t[1])
    table = {(a1,): (True, None), (a1, other): (True, None), (a1, other, other): (False, INVALID), (other,): (False, INVALID), (other, a1): (False, INVALID),
             (a1, missing): (False, INVALID), (a1, other, missing): (False, INVALID)}
    assert {c: check(b, t, h, list(c)) for c in table} == table
    refused = b.seat(t[0], "submit", **h, choices=[a1, missing], operation_id="tf1-missing")  # 人工: 画面は示されていない id を送れない
    assert (refused["outcome"], refused["refusal"]["code"]) == ("refused", INVALID)
    assert (full(hubs["tf1_copy_x"]), updates(b, t), log(b, t[1])) == (before, before_updates, before_log)
    _c, h2, _s = open_attack(b, t)
    assert check(b, t, h2, [a1, other]) == (True, None)
    assert b.seat(t[0], "submit", **h2, choices=[a1, other], operation_id="tf1-fixed")["outcome"] == "accepted"
    assert damage(hubs["tf1_copy_x"]) == ("neo4-065", 20)


@pytest.mark.parametrize(("board", "command"), [
    ("tf1_copy_x", lambda s: UseAttack(0, 0, with_power=s.players[0].active.pokemon_id)),
    ("tf1_copy_x", lambda s: UseAttack(0, 0, with_powers=(s.players[0].active.pokemon_id, s.players[0].bench[0].pokemon_id))),
    ("tf1_copy_lanturn", lambda s: UseAttack(0, 0, attack_power=True)),
])
def test_direct_command_is_the_engine_unsupported_stop(board, command):
    """直接のコマンド（接続層・入力 API を通さない。エンジンの既存の未対応）。接続層の CANDIDATE_INPUT_INVALID と別の区分。"""
    game = A.HostedGame(TB.board_state(board).clone())
    before = full(type("H", (), {"_state": lambda self: game.state})())
    result = game.submit(command(game.state), submitter=0)
    assert (result.outcome, result.diagnosis.case_id) == ("rejected", COPY_UNSUPPORTED)
    assert full(type("H", (), {"_state": lambda self: game.state})()) == before


@pytest.mark.parametrize(("board", "picks", "expected"), [
    ("tf1_copy_x", (), ("neo4-065", 20)),
    ("tf1_copy_x", (0,), ("neo4-065", 20)),
    ("tf1_copy_lanturn", (), ("neo1-040", 20)),
    ("tf1_orig_x", (0,), ("PMCG1-054", 30)),
    ("tf1_orig_x", (0, 1), ("PMCG1-054", 30)),
    ("tf1_orig_lanturn", (0,), ("PMCG1-054", 30)),
])
def test_accepted_damage_is_the_engines(tb, board, picks, expected):
    b, hubs = tb
    t, _cand, h, stages = start(b, board)
    choices = [stages[0]["options"][0]["id"], *[stages[1]["options"][i]["id"] for i in picks]]
    assert check(b, t, h, choices) == (True, None)
    assert b.seat(t[0], "submit", **h, choices=choices, operation_id="tf1-ok")["outcome"] == "accepted"
    assert damage(hubs[board]) == expected


def opponent_bench_ids(b, token):
    return [(s["pokemon_id"], s["card_id"]) for s in bench_of(b.seat(token, "view"), 1)]


@pytest.mark.parametrize(("answer", "expected"), [("PMCG1-001", ("PMCG1-001", 20)), ("PMCG1-023", ("PMCG1-023", 10)), (None, ("ES3-009", 10))])
def test_vulpix_switch_decision_and_result(tb, answer, expected):
    b, hubs = tb
    t, cand, h, stages = start(b, "tf2_vulpix_up")
    assert stages[1]["options"] == []
    assert b.seat(t[0], "submit", **h, choices=[stages[0]["options"][0]["id"]], operation_id="tf2-attack")["outcome"] == "accepted"
    assert hubs["tf2_vulpix_up"]._state().decision.kind == "forced_switch"
    assert damage(hubs["tf2_vulpix_up"]) == ("ES3-009", 0)  # 入れ替えてからダメージ（まだ与えていない）
    assert b.seat(t[1], "candidates")["response"]["candidates"] == []  # 相手に回答の候補を出さない
    cands = b.seat(t[0], "candidates")["response"]
    d = next(c for c in cands["candidates"] if c["kind"] == "answer_decision")
    hd = {"game": cands["game"], "revision": cands["revision"], "candidate": d["id"]}
    stage = b.seat(t[0], "inputs", **hd)["response"]["stages"][0]
    assert (stage["decision_kind"], stage["meaning"], stage["count"], stage["decline"]) == ("forced_switch", "pokemon", {"min": 0, "max": 1}, True)
    bench = opponent_bench_ids(b, t[0])
    assert sorted(o["value"] for o in stage["options"]) == sorted(pid for pid, _c in bench)
    choices = [] if answer is None else [next(o["id"] for o in stage["options"] if o["value"] == next(pid for pid, c in bench if c == answer))]
    assert check(b, t, hd, choices) == (True, None)
    assert b.seat(t[0], "submit", **hd, choices=choices, operation_id="tf2-answer")["outcome"] == "accepted"
    assert damage(hubs["tf2_vulpix_up"]) == expected
    s = hubs["tf2_vulpix_up"]._state()
    assert (s.decision, s.frozen_forms) == (None, ())
    for w in (0, 1, "spectator"):  # 観測のダメージは全員同じ（GUI は計算しない）
        active = next(p for p in b.seat(t[w], "view")["observation"]["players"] if p["player"] == 1)["active"]
        assert (active["card_id"], active["damage"]) == expected


def test_face_down_ditto_keeps_the_no_printed_attack_hold(tb):
    b, hubs = tb
    t, cand, h, stages = start(b, "tf2_vulpix_fd")
    assert (cand["processability"], cand["reasons"], stages) == ("not_implemented", ["face_down_reveal_not_evaluated", "no_printed_attack"], [])
    before = full(hubs["tf2_vulpix_fd"])
    assert check(b, t, h, []) == (False, "CANDIDATE_NOT_EXECUTABLE")
    assert check(b, t, h, ["o1"]) == (False, "CANDIDATE_NOT_EXECUTABLE")  # 人工
    assert b.seat(t[0], "submit", **h, choices=["o1"], operation_id="tf2-fd")["outcome"] == "refused"  # 人工
    assert full(hubs["tf2_vulpix_fd"]) == before
    s = hubs["tf2_vulpix_fd"]._state()
    assert s.is_face_down(s.players[0].active)
    for w in (1, "spectator"):
        active = next(p for p in b.seat(t[w], "view")["observation"]["players"] if p["player"] == 0)["active"]
        assert active["face_down"] is True and "real" not in active
