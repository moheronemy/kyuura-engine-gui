"""0.190.0（R-2 の［めいれい］: 本人のうらのバトル場のポケモンのワザの宣言に、自分の場のおもてのポケモンの［めいれい］（with_power）を示す）を、接続層の既存の口で
そのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。エンジンの docs/r2-with-power-v0.190.md）。

盤面は ``tests/r2wp_boards.py``（エンジンの v0.190 の回帰テストの盤面を写したもの。次のコインの面を決めた盤面がある。new_game からではない）。テストの中だけで固定例の表に加える。
操作は HTTP の口だけで行い、入力はエンジンが返した選べるものの id だけで作る（ワザ = 1 段目の位置・［めいれい］= 2 段目の with_power の位置。カード名・場から作らない）。
ワザは既存の検証の「にどげり」（コイン 2 枚 × 10）。

- 示す: 2 段目に［めいれい］を持ち主ごとに 1 つ（どのワザにも同じ・任意・選んだ順・unverified・face_down_reveal_not_evaluated）。持ち主は公開の観測の場のポケモンと同じ番号・場所
- 示さない対照: かがくへんかガス（力が無効）・名前が一致しない本当のカードは、0.189.0 と同じ空の 2 段目
- check は形と、同じ力を 2 つ選ぶ組だけを拒否: 異なる持ち主の同じ力 2 つ・同じ持ち主の重なり（通常の画面では作れない。人工の入力）は CANDIDATE_INPUT_INVALID。check は状態・更新・ログを変えない
- 同じ力 2 つを submit へ直接送ると、API の拒否（refused・CANDIDATE_INPUT_INVALID。診断ではない）で状態を変えない。1 つへ直すと受理（エンジンへ直接のコマンドの POWER_ALREADY_USED・
  DUPLICATE_POWER とは別の段階。接続層の口では出ない）
- 受理: 力あり・なしとも受理。公開の出来事は 1 回、ダメージは応答・状態のまま（おもて 2 枚 30/20・1 枚 20/10・0 枚 0/0）。3 閲覧者に同じ公開の出来事が届く
- エンジンの拒否（いかりのいちげき + ［めいれい］）: 本人だけに診断。状態・ログ・更新を変えず、相手・観戦者に何も届かない。にどげり + ［めいれい］へ直すと受理
"""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.serialize import FORMAT_VERSIONS, rng_fingerprint, state_to_dict

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import r2wp_boards as WB
from .conftest import Bridge, tokens
from .p6_boards import install_boards

FACE_DOWN = ["face_down_reveal_not_evaluated"]
INVALID = "CANDIDATE_INPUT_INVALID"


def full(hub):
    state = hub._state()
    exported = json.dumps(state_to_dict(state, format_version=max(FORMAT_VERSIONS)), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(exported.encode()).hexdigest(), rng_fingerprint(state.rng), len(state.log)


@pytest.fixture()
def wb(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = WB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (WB.LABELS[b], WB.DESCRIPTION, build) for b in WB.BOARDS}, monkeypatch)
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


@pytest.mark.parametrize(("board", "bench_indexes"), [("r2wp_one_hh", [0]), ("r2wp_two", [0, 2])])
def test_power_is_offered_per_holder_and_the_holder_is_public(wb, board, bench_indexes):
    b, _ = wb
    t, cand, _h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"]) == ("unverified", FACE_DOWN)
    attacks, powers = ids(stages)
    second = stages[1]
    assert len(attacks) == 2 and powers == [f"o{len(attacks) + i + 1}" for i in range(len(bench_indexes))]
    assert [o["addon"] for o in second["options"]] == ["with_power"] * len(bench_indexes)  # コインは示さない（スタジアムなし）
    assert second["count"] == {"min": 0, "max": len(bench_indexes)} and (second["decline"], second["order"], second["order_preserved"]) == (True, "significant", True)
    assert second["options_by_choice"] == {a: [{"option": p, "eligible": True, "processability": "unverified", "reasons": FACE_DOWN} for p in powers] for a in attacks}
    # 持ち主: 応答の pokemon・bench_index・card_id は、相手・観戦者にも見える公開の観測の場のポケモンと同じ（GUI は場所の表示に観測を使う）
    for w in (0, 1, "spectator"):
        bench = bench_of(b.seat(t[w], "view"), 0)
        for o, index in zip(second["options"], bench_indexes):
            assert (o["power"], o["zone"], o["bench_index"], o["card_id"], o["processability"], o["reasons"]) == ("めいれい", "bench", index, WB.KING, "unverified", FACE_DOWN)
            assert (bench[index]["pokemon_id"], bench[index]["card_id"]) == (o["pokemon"], WB.KING)
    assert len({o["pokemon"] for o in second["options"]}) == len(bench_indexes)  # 持ち主ごとに別の番号


@pytest.mark.parametrize("board", ["r2wp_gas", "r2wp_not_named"])
def test_power_is_not_offered_for_controls(wb, board):
    b, _ = wb
    _t, cand, h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"], cand["choices_format"]) == ("unverified", FACE_DOWN, "[ワザの番号]")
    assert stages[1]["options"] == [] and stages[1]["count"] == {"min": 0, "max": 0}


def test_check_is_shape_and_same_power_only_and_changes_nothing(wb):
    b, hubs = wb
    t, _cand, h, stages = start(b, "r2wp_two")
    (a1, a2), (k1, k2) = ids(stages)
    before, before_updates, before_log = full(hubs["r2wp_two"]), updates(b, t), log(b, t[1])

    def check(choices):
        r = b.seat(t[0], "check", **h, choices=choices)["response"]
        return r["valid"], (r.get("refusal") or {}).get("code")
    table = {(a1,): (True, None), (a1, k1): (True, None), (a1, k2): (True, None), (a2, k2): (True, None),
             (a1, k1, k2): (False, INVALID), (a1, k2, k1): (False, INVALID),  # 異なる持ち主の同じ力 2 つ（通常の画面で選べる）
             (a1, k1, k1): (False, INVALID),  # 同じ持ち主の重なり（人工の入力。画面は同じ選択肢を 2 回選べない）
             (k1,): (False, INVALID), (k1, a1): (False, INVALID), (a1, a2): (False, INVALID)}
    assert {c: check(list(c)) for c in table} == table
    assert (full(hubs["r2wp_two"]), updates(b, t), log(b, t[1])) == (before, before_updates, before_log)


def test_same_power_twice_submitted_directly_is_an_api_refusal_and_the_fixed_input_is_accepted(wb):
    b, hubs = wb
    t, _cand, h, stages = start(b, "r2wp_two")
    (a1, _a2), (k1, k2) = ids(stages)
    hub = hubs["r2wp_two"]
    before, before_updates, before_logs = full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}
    sent = b.seat(t[0], "submit", **h, choices=[a1, k1, k2], operation_id="r2wp-twice")
    assert (sent["ok"], sent["outcome"], sent["refusal"]["code"], sent["result"]) == (True, "refused", INVALID, None)  # 診断（rejected）ではない
    assert (full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}) == (before, before_updates, before_logs)
    _c, h2, stages2 = open_attack(b, t)
    assert stages2 == stages
    again = b.seat(t[0], "submit", **h2, choices=[a1, k1], operation_id="r2wp-twice-fixed")
    assert again["outcome"] == "accepted" and hub._state().players[1].active.damage == 30


@pytest.mark.parametrize(("board", "with_power", "damage", "sides"), [
    ("r2wp_one_hh", True, 30, ["heads", "heads"]), ("r2wp_one_hh", False, 20, ["heads", "heads"]),
    ("r2wp_one_ht", True, 20, ["heads", "tails"]), ("r2wp_one_ht", False, 10, ["heads", "tails"]),
    ("r2wp_one_tt", True, 0, ["tails", "tails"]), ("r2wp_one_tt", False, 0, ["tails", "tails"]),
])
def test_accepted_with_and_without_the_power(wb, board, with_power, damage, sides):
    b, hubs = wb
    t, _cand, h, stages = start(b, board)
    (nidogeri, _ikari), (k1,) = ids(stages)
    base = len(log(b, t[1]))
    sent = b.seat(t[0], "submit", **h, choices=[nidogeri, k1] if with_power else [nidogeri], operation_id="r2wp-accept")
    assert (sent["outcome"], sent["result"]["diagnostic_id"]) == ("accepted", None)
    seen = {w: log(b, t[w])[base:] for w in (0, 1, "spectator")}
    for entries in seen.values():
        assert len(kinds(entries, "secret_plan_revealed")) == 1  # 公開は 1 回
        assert [e["power"] for e in kinds(entries, "group_attack_power")] == (["めいれい"] if with_power else [])
        assert [(f["source"], f["result"]) for f in kinds(entries, "coin_flip")] == [("attack", s) for s in sides]
        assert [d["amount"] for d in kinds(entries, "damage")] == [damage]
    public = lambda es: [e for e in es if e["event"]["kind"] != "draw"]  # 引いたカードは本人にだけ中身が見える（既存の可視ログの境界）
    assert public(seen[0]) == public(seen[1]) == public(seen["spectator"])
    assert hubs[board]._state().players[1].active.damage == damage
    for w in (0, 1, "spectator"):
        active = next(p for p in b.seat(t[w], "view")["observation"]["players"] if p["player"] == 1)["active"]
        assert active["damage"] == damage  # 観測の値（GUI は計算しない）
    assert all(len(u) == 1 for u in updates(b, t).values())


def test_engine_rejection_is_only_for_the_sender_and_the_fixed_input_is_accepted(wb):
    b, hubs = wb
    t, _cand, h, stages = start(b, "r2wp_one_hh")
    (nidogeri, ikari), (k1,) = ids(stages)
    hub = hubs["r2wp_one_hh"]
    before, before_updates, before_logs = full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}
    others_before = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    sent = b.seat(t[0], "submit", **h, choices=[ikari, k1], operation_id="r2wp-reject")
    assert (sent["outcome"], sent["result"]["diagnostic_id"], sent["result"]["category"]) == ("rejected", "NOT_ENOUGH_DAMAGE_COUNTERS", "invalid_input")
    assert (full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}) == (before, before_updates, before_logs)
    others = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    assert others == others_before
    text = json.dumps([others, b.seat(t[1], "candidates")], ensure_ascii=False)
    assert "NOT_ENOUGH_DAMAGE_COUNTERS" not in text and "サカキのニドラン♂" not in text and "いかりのいちげき" not in text
    _c, h2, stages2 = open_attack(b, t)
    assert stages2 == stages
    assert b.seat(t[0], "check", **h2, choices=[nidogeri, k1])["response"]["valid"] is True
    again = b.seat(t[0], "submit", **h2, choices=[nidogeri, k1], operation_id="r2wp-reject-fixed")
    assert again["outcome"] == "accepted"
    after = log(b, t[1])[len(before_logs[1]):]
    assert len(kinds(after, "secret_plan_revealed")) == 1 and [d["amount"] for d in kinds(after, "damage")] == [30]


def test_the_actors_real_card_does_not_reach_others_before_sending(wb):
    """本当のカードの ID（PMCG6-004）はベンチのサカキのニドキングの進化の重なりとして公開されるので、ID ではなく、本当のカードだけが違う 2 つの盤面
    （サカキのニドラン♂・ニドラン♂）で、相手・観戦者の応答が同じこと（と名前・ワザが出ないこと）で確かめる。"""
    b, _ = wb
    seen = []
    for board in ("r2wp_one_hh", "r2wp_not_named"):
        t, *_ = start(b, board)
        others = {w: (b.seat(t[w], "view"), log(b, t[w])) for w in (1, "spectator")}
        cands = b.seat(t[1], "candidates")["response"]
        seen.append((others, {k: v for k, v in cands.items() if k not in ("game", "revision")}))
        text = json.dumps(seen[-1], ensure_ascii=False)
        assert "サカキのニドラン♂" not in text and "にどげり" not in text and "ニドラン♂" not in text.replace("サカキのニドキング", "")
    assert seen[0] == seen[1]
