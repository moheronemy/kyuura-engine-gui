"""0.191.0（R-2 のアンノーンの［XXXXX］・［ANGER］: 本人のうらのバトル場のアンノーンのワザの宣言に、自分の場の別のおもての持ち主の力（with_power）を示す）を、
接続層の既存の口でそのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。エンジンの docs/r2-unown-v0.191.md）。

盤面は ``tests/r2u_boards.py``（エンジンの v0.191 の回帰テストの盤面を写したもの。次のコインの面を決めた盤面がある。new_game からではない）。テストの中だけで固定例の表に加える。
操作は HTTP の口だけで行い、入力はエンジンが返した選べるものの id だけで作る（ワザ = 1 段目の位置・力 = 2 段目の with_power の位置。カード名・能力名・場から作らない）。

- 示す: 2 段目に持ち主ごとに 1 つ（場の並び・任意・選んだ順・unverified・face_down_reveal_not_evaluated）。持ち主は公開の観測の場のポケモンと同じ番号・場所。note は新しい文
- 示さない対照: かがくへんかガス（力が無効）は、0.190.0 と同じ空の 2 段目。自己持ち主（使い手のアンノーンX 自身。盤面 r2u_self）は 0.191.0 では示さない対照だったが、
  0.192.0 から使い手自身の力を示す（意図した期待の変更。エンジンの test_self_holder_is_offered_from_v0_192 と同じ。詳しくは test_r2_unown_self.py）
- check は形だけ（力なし・片方・両方の 2 順は valid。同じ持ち主の重なり（人工の入力）・力だけ・力が先は CANDIDATE_INPUT_INVALID）。状態・更新・ログを変えない
- 受理: 力なし 10・［ANGER］30・［XXXXX］30（コイン「おもて」2 枚）・両方 50（どちらの順も）。公開の出来事は 1 回、ダメージは応答・状態のまま。3 閲覧者に同じ公開の出来事
- XP1（相手のバトル場のベイビィ）: ［XXXXX］つきの送信は、check は valid、送信はエンジンの既存の停止（UNRESOLVED_GROUP_POWER_COIN_ORDER）で拒否。本人だけに診断。
  状態・乱数・ログ・更新を変えず、相手・観戦者に何も届かない。［ANGER］だけへ直すと受理
"""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.serialize import FORMAT_VERSIONS, rng_fingerprint, state_to_dict

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import r2u_boards as UB
from .conftest import Bridge, tokens
from .p6_boards import install_boards

FACE_DOWN = ["face_down_reveal_not_evaluated"]
INVALID = "CANDIDATE_INPUT_INVALID"
X_POWER, A_POWER = "XXXXX[?????]", "ANGER[アンガー]"


def full(hub):
    state = hub._state()
    exported = json.dumps(state_to_dict(state, format_version=max(FORMAT_VERSIONS)), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(exported.encode()).hexdigest(), rng_fingerprint(state.rng), len(state.log)


@pytest.fixture()
def ub(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = UB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (UB.LABELS[b], UB.DESCRIPTION, build) for b in UB.BOARDS}, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def open_attack(b, t):
    cands = b.seat(t[0], "candidates")["response"]
    cand = next(c for c in cands["candidates"] if c["kind"] == "use_attack")
    h = {"game": cands["game"], "revision": cands["revision"], "candidate": cand["id"]}
    stages = b.seat(t[0], "inputs", **h)["response"]["stages"]
    return cand, h, stages


def start(b, board):
    t = tokens(b.create(mode="scenario", scenario=board)["match"])
    return (t, *open_attack(b, t))


def ids(stages):
    return [o["id"] for o in stages[0]["options"]], [o["id"] for o in stages[1]["options"] if o["addon"] == "with_power"]


def log(b, token):
    entries, start_at = [], None
    while True:
        page = b.seat(token, "log", **({} if start_at is None else {"from": start_at}))
        entries += page["entries"]
        if page["complete"]:
            return entries
        start_at = page["next"]


def kinds(entries, kind):
    return [e["event"] for e in entries if e["event"]["kind"] == kind]


def updates(b, t):
    return {w: b.updates(t[w], host=w == "host")["updates"] for w in (0, 1, "spectator", "host")}


def bench_of(view, player):
    return next(p for p in view["observation"]["players"] if p["player"] == player)["bench"]


@pytest.mark.parametrize(("board", "expected"), [
    ("r2u_xa", [(0, UB.UNOWN_A, A_POWER), (1, UB.UNOWN_X, X_POWER)]),
    ("r2u_baby", [(0, UB.UNOWN_X, X_POWER), (1, UB.UNOWN_A, A_POWER)]),
])
def test_powers_are_offered_per_holder_in_field_order_and_the_holder_is_public(ub, board, expected):
    b, _ = ub
    t, cand, _h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"]) == ("unverified", FACE_DOWN)
    attacks, powers = ids(stages)
    second = stages[1]
    assert attacks == ["o1"] and stages[0]["options"][0]["name_ja"] == "めざめるパワー" and powers == ["o2", "o3"]
    assert second["count"] == {"min": 0, "max": 2} and (second["decline"], second["order"], second["order_preserved"]) == (True, "significant", True)
    assert second["options_by_choice"] == {"o1": [{"option": p, "eligible": True, "processability": "unverified", "reasons": FACE_DOWN} for p in powers]}
    assert "［XXXXX］・［ANGER］を、その力の対象のワザにだけ示す" in second["note"] and "ダメージが増えることは保証しない" in second["note"]
    for w in (0, 1, "spectator"):
        bench = bench_of(b.seat(t[w], "view"), 0)
        for o, (index, card_id, power) in zip(second["options"], expected):
            assert (o["power"], o["zone"], o["bench_index"], o["card_id"], o["processability"], o["reasons"]) == (power, "bench", index, card_id, "unverified", FACE_DOWN)
            assert (bench[index]["pokemon_id"], bench[index]["card_id"]) == (o["pokemon"], card_id)


@pytest.mark.parametrize("board", ["r2u_gas"])
def test_powers_are_not_offered_for_controls(ub, board):
    b, _ = ub
    _t, cand, _h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"], cand["choices_format"]) == ("unverified", FACE_DOWN, "[ワザの番号]")
    assert stages[1]["options"] == [] and stages[1]["count"] == {"min": 0, "max": 0} and stages[1]["options_by_choice"] == {"o1": []}


def test_self_holder_is_offered_from_0_192(ub):
    """0.192.0 から（意図した期待の変更）: 0.191.0 の対照 r2u_self（うらのアンノーンX ＋ ベンチのコラッタ）では、使い手自身の［XXXXX］を 2 段目に 1 つだけ示す。"""
    b, _ = ub
    _t, cand, _h, stages = start(b, "r2u_self")
    assert (cand["processability"], cand["reasons"]) == ("unverified", FACE_DOWN)
    (only,) = stages[1]["options"]
    assert (only["addon"], only["zone"], only["face_down"], only["power"]) == ("with_power", "active", True, X_POWER) and "card_id" not in only


def test_check_is_shape_only_and_changes_nothing(ub):
    b, hubs = ub
    t, _cand, h, stages = start(b, "r2u_xa")
    (a1,), (pa, px) = ids(stages)
    before, before_updates, before_log = full(hubs["r2u_xa"]), updates(b, t), log(b, t[1])

    def check(choices):
        r = b.seat(t[0], "check", **h, choices=choices)["response"]
        return r["valid"], (r.get("refusal") or {}).get("code")
    table = {(a1,): (True, None), (a1, pa): (True, None), (a1, px): (True, None), (a1, pa, px): (True, None), (a1, px, pa): (True, None),
             (a1, px, px): (False, INVALID),  # 同じ持ち主の重なり（人工の入力。画面は同じ選択肢を 2 回選べない）
             (px,): (False, INVALID), (px, a1): (False, INVALID), (a1, a1): (False, INVALID), (a1, "o4"): (False, INVALID)}
    assert {c: check(list(c)) for c in table} == table
    assert (full(hubs["r2u_xa"]), updates(b, t), log(b, t[1])) == (before, before_updates, before_log)


@pytest.mark.parametrize(("picks", "damage", "powers", "coins"), [
    ((), 10, [], []),
    (("A",), 30, [A_POWER], []),
    (("X",), 30, [X_POWER], ["heads", "heads", "tails"]),
    (("A", "X"), 50, [A_POWER, X_POWER], ["heads", "heads", "tails"]),
    (("X", "A"), 50, [X_POWER, A_POWER], ["heads", "heads", "tails"]),
])
def test_accepted_without_one_or_both_powers(ub, picks, damage, powers, coins):
    b, hubs = ub
    t, _cand, h, stages = start(b, "r2u_xa")
    (a1,), (pa, px) = ids(stages)
    choices = [a1, *({"A": pa, "X": px}[p] for p in picks)]
    assert b.seat(t[0], "check", **h, choices=choices)["response"]["valid"] is True
    base = len(log(b, t[1]))
    sent = b.seat(t[0], "submit", **h, choices=choices, operation_id="r2u-accept")
    assert (sent["outcome"], sent["result"]["diagnostic_id"]) == ("accepted", None)
    seen = {w: log(b, t[w])[base:] for w in (0, 1, "spectator")}
    for entries in seen.values():
        assert len(kinds(entries, "secret_plan_revealed")) == 1  # 公開は 1 回
        assert [e["power"] for e in kinds(entries, "group_attack_power")] == powers  # 選んだ順
        assert [(f["source"], f["result"]) for f in kinds(entries, "coin_flip")] == [("power", s) for s in coins]
        assert [d["amount"] for d in kinds(entries, "damage")] == [damage]
    public = lambda es: [e for e in es if e["event"]["kind"] != "draw"]  # 引いたカードは本人にだけ中身が見える（既存の可視ログの境界）
    assert public(seen[0]) == public(seen[1]) == public(seen["spectator"])
    assert hubs["r2u_xa"]._state().players[1].active.damage == damage
    for w in (0, 1, "spectator"):
        active = next(p for p in b.seat(t[w], "view")["observation"]["players"] if p["player"] == 1)["active"]
        assert active["damage"] == damage  # 観測の値（GUI は計算しない）
    assert all(len(u) == 1 for u in updates(b, t).values())


def test_xp1_rejection_is_only_for_the_sender_and_the_fixed_input_is_accepted(ub):
    b, hubs = ub
    t, _cand, h, stages = start(b, "r2u_baby")
    (a1,), (px, pa) = ids(stages)
    hub = hubs["r2u_baby"]
    assert b.seat(t[0], "check", **h, choices=[a1, px])["response"]["valid"] is True  # 候補・check は停止を予告しない
    before, before_updates, before_logs = full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}
    others_before = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    sent = b.seat(t[0], "submit", **h, choices=[a1, px], operation_id="r2u-xp1")
    assert (sent["outcome"], sent["result"]["diagnostic_id"], sent["result"]["category"]) == ("rejected", "UNRESOLVED_GROUP_POWER_COIN_ORDER", "unresolved_ruling")
    assert (full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}) == (before, before_updates, before_logs)
    others = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    assert others == others_before
    text = json.dumps([others, b.seat(t[1], "candidates")], ensure_ascii=False)
    assert "UNRESOLVED_GROUP_POWER_COIN_ORDER" not in text and UB.UNOWN_N not in text and "アンノーン[N]" not in text
    _c, h2, stages2 = open_attack(b, t)
    assert stages2 == stages
    assert b.seat(t[0], "check", **h2, choices=[a1, pa])["response"]["valid"] is True
    again = b.seat(t[0], "submit", **h2, choices=[a1, pa], operation_id="r2u-xp1-fixed")
    assert again["outcome"] == "accepted"
    after = log(b, t[1])[len(before_logs[1]):]
    assert len(kinds(after, "secret_plan_revealed")) == 1 and [e["power"] for e in kinds(after, "group_attack_power")] == [A_POWER]
    assert [d["amount"] for d in kinds(after, "damage")] == [30]


def test_the_actors_real_card_does_not_reach_others_before_sending(ub):
    """本当のカード（アンノーン[N]）は、相手・観戦者の view・log・candidates に出ない。"""
    b, _ = ub
    t, *_ = start(b, "r2u_xa")
    others = {w: (b.seat(t[w], "view"), log(b, t[w])) for w in (1, "spectator")}
    text = json.dumps([others, b.seat(t[1], "candidates")], ensure_ascii=False)
    assert UB.UNOWN_N not in text and "アンノーン[N]" not in text
