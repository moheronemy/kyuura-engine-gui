"""0.192.0（R-2 のアンノーンの自己持ち主: 本人のうらのバトル場のアンノーンX・A のワザの宣言に、使い手自身の［XXXXX］・［ANGER］（with_power）を示す）を、
接続層の既存の口でそのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。エンジンの docs/r2-unown-self-holder-v0.192.md）。

盤面は ``tests/r2us_boards.py``（エンジンの v0.192 の回帰テストの盤面を写したもの。次のコインの面を決めた盤面がある。new_game からではない）。テストの中だけで固定例の表に加える。
操作は HTTP の口だけで行い、入力はエンジンが返した選べるものの id だけで作る（ワザ = 1 段目の位置・力 = 2 段目の with_power の位置。カード名・能力名・場から作らない）。

- 示す: 2 段目の先頭に使い手自身（zone active・face_down・card_id なし・使い手の場の番号）、そのあとに別の持ち主を場の並びで。任意・選んだ順・unverified・
  face_down_reveal_not_evaluated。自己持ち主の番号は公開の観測の、うらのバトル場のポケモンの番号と同じ。本当のカードは相手・観戦者に出ない
- check は形と同じ力の組だけ（自己 X ＋ 別の X・自己 A ＋ 別の A・同じ参照の重なり（人工の入力）・力だけ・力が先は CANDIDATE_INPUT_INVALID）。状態・更新・ログを変えない
- 同じ力の組の submit は接続層が check と同じ区分で断る（refused。状態・更新・ログは同じ）。1 つに直すと受理
- 受理: 力なし 10・自己［XXXXX］30（コイン「おもて」2 枚）・自己［ANGER］10（エンジンの値のまま）・自己 X ＋ 別の A 50（どちらの順も）・自己 A ＋ 別の X 30
- XP1（相手のバトル場のベイビィ）: 自己［XXXXX］つきの送信は、check は valid、送信はエンジンの既存の停止（UNRESOLVED_GROUP_POWER_COIN_ORDER）で拒否。本人だけに診断。
  状態・乱数・ログ・更新を変えず、相手・観戦者に何も届かない。力を外すと受理
- 対照: かがくへんかガスでは示さない（0.187.0 と同じ空の 2 段目）
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import r2us_boards as SB
from .conftest import Bridge, tokens
from .p6_boards import install_boards
from .test_r2_unown import A_POWER, FACE_DOWN, INVALID, X_POWER, bench_of, full, ids, kinds, log, open_attack, updates


@pytest.fixture()
def sb(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = SB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (SB.LABELS[b], SB.DESCRIPTION, build) for b in SB.BOARDS}, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def start(b, board):
    t = tokens(b.create(mode="scenario", scenario=board)["match"])
    return (t, *open_attack(b, t))


def active_of(view, player):
    return next(p for p in view["observation"]["players"] if p["player"] == player)["active"]


@pytest.mark.parametrize(("board", "expected"), [
    ("r2us_x", [("active", None, X_POWER)]),
    ("r2us_a", [("active", None, A_POWER)]),
    ("r2us_x_ax", [("active", None, X_POWER), ("bench", 0, A_POWER), ("bench", 1, X_POWER)]),
    ("r2us_a_ax", [("active", None, A_POWER), ("bench", 0, A_POWER), ("bench", 1, X_POWER)]),
])
def test_self_holder_is_offered_first_without_card_id(sb, board, expected):
    b, _ = sb
    t, cand, _h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"]) == ("unverified", FACE_DOWN)
    attacks, powers = ids(stages)
    second = stages[1]
    assert attacks == ["o1"] and len(powers) == len(expected)
    assert second["count"] == {"min": 0, "max": len(expected)} and (second["decline"], second["order"], second["order_preserved"]) == (True, "significant", True)
    assert second["options_by_choice"] == {"o1": [{"option": p, "eligible": True, "processability": "unverified", "reasons": FACE_DOWN} for p in powers]}
    assert "使い手自身の力を先に示す" in second["note"] and "ダメージが増えることは保証しない" in second["note"]
    own_view = b.seat(t[0], "view")
    for o, (zone, index, power) in zip(second["options"], expected):
        assert (o["power"], o["zone"], o["processability"], o["reasons"]) == (power, zone, "unverified", FACE_DOWN)
        if zone == "active":
            assert o["face_down"] is True and "card_id" not in o and "bench_index" not in o
            active = active_of(own_view, 0)
            assert active["face_down"] is True and active["pokemon_id"] == o["pokemon"]  # 公開の観測のうらのバトル場のポケモンと同じ番号
        else:
            assert "face_down" not in o and bench_of(own_view, 0)[index]["pokemon_id"] == o["pokemon"]
    for w in (1, "spectator"):
        active = active_of(b.seat(t[w], "view"), 0)
        assert active["face_down"] is True and "real" not in active  # 本当のカードは本人だけ


def test_not_offered_when_suppressed(sb):
    b, _ = sb
    _t, cand, _h, stages = start(b, "r2us_gas")
    assert (cand["processability"], cand["reasons"], cand["choices_format"]) == ("unverified", FACE_DOWN, "[ワザの番号]")
    assert stages[1]["options"] == [] and stages[1]["count"] == {"min": 0, "max": 0} and stages[1]["options_by_choice"] == {"o1": []}


@pytest.mark.parametrize("board", ["r2us_x_ax", "r2us_a_ax"])
def test_check_rejects_the_same_power_pair_and_changes_nothing(sb, board):
    b, hubs = sb
    t, _cand, h, stages = start(b, board)
    (a1,), (own, pa, px) = ids(stages)
    same = px if board == "r2us_x_ax" else pa
    other = pa if board == "r2us_x_ax" else px
    before, before_updates, before_log = full(hubs[board]), updates(b, t), log(b, t[1])

    def check(choices):
        r = b.seat(t[0], "check", **h, choices=choices)["response"]
        return r["valid"], (r.get("refusal") or {}).get("code")
    table = {(a1,): (True, None), (a1, own): (True, None), (a1, own, other): (True, None), (a1, other, own): (True, None), (a1, pa, px): (True, None),
             (a1, own, same): (False, INVALID), (a1, same, own): (False, INVALID), (a1, own, pa, px): (False, INVALID),
             (a1, own, own): (False, INVALID),  # 同じ参照の重なり（人工の入力。画面は同じ選択肢を 2 回選べない）
             (own,): (False, INVALID), (own, a1): (False, INVALID), (a1, "o5"): (False, INVALID)}
    assert {c: check(list(c)) for c in table} == table
    assert (full(hubs[board]), updates(b, t), log(b, t[1])) == (before, before_updates, before_log)
    refused = b.seat(t[0], "submit", **h, choices=[a1, own, same], operation_id="r2us-same")  # 画面は check が通らない組を送らない（接続層の扱いの記録）
    assert (refused["outcome"], refused["refusal"]["code"]) == ("refused", INVALID)
    assert (full(hubs[board]), updates(b, t), log(b, t[1])) == (before, before_updates, before_log)
    _c, h2, _s = open_attack(b, t)
    assert b.seat(t[0], "check", **h2, choices=[a1, own])["response"]["valid"] is True
    assert b.seat(t[0], "submit", **h2, choices=[a1, own], operation_id="r2us-same-fixed")["outcome"] == "accepted"


@pytest.mark.parametrize(("board", "picks", "damage", "powers", "coins"), [
    ("r2us_x", (), 10, [], []),
    ("r2us_x", (0,), 30, [X_POWER], ["heads", "heads", "tails"]),
    ("r2us_a", (0,), 10, [A_POWER], []),
    ("r2us_x_ax", (0, 1), 50, [X_POWER, A_POWER], ["heads", "heads", "tails"]),
    ("r2us_x_ax", (1, 0), 50, [A_POWER, X_POWER], ["heads", "heads", "tails"]),
    ("r2us_a_ax", (0, 2), 30, [A_POWER, X_POWER], ["heads", "heads", "tails"]),
])
def test_accepted_with_and_without_the_self_power(sb, board, picks, damage, powers, coins):
    b, hubs = sb
    t, _cand, h, stages = start(b, board)
    (a1,), ps = ids(stages)
    choices = [a1, *(ps[i] for i in picks)]
    assert b.seat(t[0], "check", **h, choices=choices)["response"]["valid"] is True
    base = len(log(b, t[1]))
    sent = b.seat(t[0], "submit", **h, choices=choices, operation_id="r2us-accept")
    assert (sent["outcome"], sent["result"]["diagnostic_id"]) == ("accepted", None)
    seen = {w: log(b, t[w])[base:] for w in (0, 1, "spectator")}
    for entries in seen.values():
        assert len(kinds(entries, "secret_plan_revealed")) == 1
        assert [e["power"] for e in kinds(entries, "group_attack_power")] == powers  # 選んだ順
        assert [(f["source"], f["result"]) for f in kinds(entries, "coin_flip")] == [("power", s) for s in coins]
        assert [d["amount"] for d in kinds(entries, "damage")] == [damage]
    public = lambda es: [e for e in es if e["event"]["kind"] != "draw"]
    assert public(seen[0]) == public(seen[1]) == public(seen["spectator"])
    assert hubs[board]._state().players[1].active.damage == damage
    for w in (0, 1, "spectator"):
        assert active_of(b.seat(t[w], "view"), 1)["damage"] == damage  # 観測の値（GUI は計算しない）
    assert all(len(u) == 1 for u in updates(b, t).values())


def test_xp1_rejection_is_only_for_the_sender_and_the_answer_without_the_power_is_accepted(sb):
    b, hubs = sb
    t, _cand, h, stages = start(b, "r2us_baby")
    (a1,), (own,) = ids(stages)
    hub = hubs["r2us_baby"]
    assert b.seat(t[0], "check", **h, choices=[a1, own])["response"]["valid"] is True  # 候補・check は停止を予告しない
    before, before_updates, before_logs = full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}
    others_before = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    sent = b.seat(t[0], "submit", **h, choices=[a1, own], operation_id="r2us-xp1")
    assert (sent["outcome"], sent["result"]["diagnostic_id"], sent["result"]["category"]) == ("rejected", "UNRESOLVED_GROUP_POWER_COIN_ORDER", "unresolved_ruling")
    assert (full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}) == (before, before_updates, before_logs)
    assert hub._state().is_face_down(hub._state().players[0].active)  # 公開も元に戻る
    others = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    assert others == others_before
    text = json.dumps([others, b.seat(t[1], "candidates")], ensure_ascii=False)
    assert "UNRESOLVED_GROUP_POWER_COIN_ORDER" not in text and SB.UNOWN_X not in text and "アンノーンX" not in text
    _c, h2, stages2 = open_attack(b, t)
    assert stages2 == stages
    assert b.seat(t[0], "check", **h2, choices=[a1])["response"]["valid"] is True
    again = b.seat(t[0], "submit", **h2, choices=[a1], operation_id="r2us-xp1-fixed")
    assert again["outcome"] == "accepted"
    after = log(b, t[1])[len(before_logs[1]):]
    assert len(kinds(after, "secret_plan_revealed")) == 1 and kinds(after, "group_attack_power") == []
    assert [d["amount"] for d in kinds(after, "damage")] == [10]


def test_the_actors_real_card_does_not_reach_others_before_sending(sb):
    b, _ = sb
    t, *_ = start(b, "r2us_x_ax")
    for w in (1, "spectator"):
        view, entries = b.seat(t[w], "view"), log(b, t[w])
        assert "real" not in active_of(view, 0)
        assert not any(e["event"]["kind"] == "secret_plan_revealed" for e in entries)
    assert "real" not in json.dumps(b.seat(t[1], "candidates"), ensure_ascii=False)
