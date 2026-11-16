"""0.188.0・0.189.0（R-2 の初回対応: 本人のうらのバトル場のポケモンのワザの宣言に、クチバシティジムのコインを示す。0.189.0 で先読みの複製の元を修正）を、接続層の既存の口で
そのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。エンジンの docs/r2-stadium-coin-v0.188.md・r2-coin-preflight-v0.189.md）。

盤面は ``tests/r2_boards.py``（エンジンの v0.189 の回帰テストの盤面を写したもの。次のコインの面を決めた盤面がある。new_game からではない）。テストの中だけで固定例の表に加える。
操作は HTTP の口だけで行い、入力はエンジンが返した選べるものの id だけで作る（ワザ = 1 段目の位置・コイン = 2 段目の stadium_coin。カード名・スタジアムから作らない）。

- 示す: 2 段目にコイン 1 つ（どのワザにも同じ・任意・選んだ順・unverified・face_down_reveal_not_evaluated）。候補は unverified のまま
- 示さない対照: スタジアムなし・特殊能力を持つ本当のカードは 0.187.0 と同じ空の 2 段目
- check は形だけ: [ワザ]・[ワザ, コイン] は通り、コインだけ・コインが先・重なりは通らない。check は状態・更新・ログを変えない
- 受理: コインあり・なしとも受理。公開の出来事は 1 回、コインの出来事はエンジンの結果のまま、3 閲覧者に同じ公開の出来事が届く
- VM1（かまいたち + コイン）: 本人だけに拒否の診断。状態・乱数・ログ・更新を変えず、相手・観戦者に何も届かない。同じ局面でコインなしに直して送ると受理
- たねでない本当のカード: コインを選んでも、公開してトラッシュして受理（コインの出来事なし）
"""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from kyuura_engine.serialize import FORMAT_VERSIONS, rng_fingerprint, state_to_dict

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import r2_boards as RB
from .conftest import Bridge, tokens
from .p6_boards import install_boards

FACE_DOWN = ["face_down_reveal_not_evaluated"]
VM1 = "UNRESOLVED_VERMILION_GYM_ATTACK_ORDER"
GYM = RB.VERMILION_CITY_GYM


def full(hub):
    state = hub._state()
    exported = json.dumps(state_to_dict(state, format_version=max(FORMAT_VERSIONS)), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(exported.encode()).hexdigest(), rng_fingerprint(state.rng), len(state.log)


@pytest.fixture()
def rb(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = RB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (RB.LABELS[b], RB.DESCRIPTION, build) for b in RB.BOARDS}, monkeypatch)
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
    return [o["id"] for o in stages[0]["options"]], [o["id"] for o in stages[1]["options"] if o["addon"] == "stadium_coin"]


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


@pytest.mark.parametrize("board", ["r2_coin_magnemite_heads", "r2_coin_spearow", "r2_coin_raticate"])
def test_coin_is_offered_on_stage_two(rb, board):
    b, _ = rb
    _t, cand, _h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"]) == ("unverified", FACE_DOWN)
    attacks, coins = ids(stages)
    second = stages[1]
    assert len(attacks) == 2 and len(coins) == 1 and coins == [f"o{len(attacks) + 1}"]
    coin = second["options"][0]
    assert (coin["addon"], coin["card_id"], coin["processability"], coin["reasons"]) == ("stadium_coin", GYM, "unverified", FACE_DOWN)
    assert second["count"] == {"min": 0, "max": 1} and (second["decline"], second["order"], second["order_preserved"]) == (True, "significant", True)
    assert second["options_by_choice"] == {a: [{"option": coins[0], "eligible": True, "processability": "unverified", "reasons": FACE_DOWN}] for a in attacks}
    assert all((o["processability"], o["reasons"], o["face_down"]) == ("unverified", FACE_DOWN, True) for o in stages[0]["options"])


@pytest.mark.parametrize("board", ["r2_no_stadium", "r2_powered"])
def test_coin_is_not_offered_for_controls(rb, board):
    b, _ = rb
    _t, cand, h, stages = start(b, board)
    assert (cand["processability"], cand["reasons"], cand["choices_format"]) == ("unverified", FACE_DOWN, "[ワザの番号]")
    assert stages[1]["options"] == [] and stages[1]["count"] == {"min": 0, "max": 0}


def test_check_is_shape_only_and_changes_nothing(rb):
    b, hubs = rb
    t, _cand, h, stages = start(b, "r2_coin_magnemite_heads")
    (a1, a2), (coin,) = ids(stages)
    before, before_updates, before_log = full(hubs["r2_coin_magnemite_heads"]), updates(b, t), log(b, t[1])
    valid = {tuple(c): b.seat(t[0], "check", **h, choices=c)["response"]["valid"]
             for c in ([a1], [a2], [a1, coin], [a2, coin], [coin], [coin, a1], [a1, coin, coin], [a1, a2])}
    assert valid == {(a1,): True, (a2,): True, (a1, coin): True, (a2, coin): True, (coin,): False, (coin, a1): False, (a1, coin, coin): False, (a1, a2): False}
    assert (full(hubs["r2_coin_magnemite_heads"]), updates(b, t), log(b, t[1])) == (before, before_updates, before_log)


@pytest.mark.parametrize(("board", "with_coin", "side"), [("r2_coin_magnemite_heads", True, "heads"), ("r2_coin_magnemite_tails", True, "tails"),
                                                         ("r2_coin_magnemite_heads", False, None)])
def test_accepted_with_and_without_the_coin(rb, board, with_coin, side):
    b, _ = rb
    t, _cand, h, stages = start(b, board)
    (_shock, tackle), (coin,) = ids(stages)
    base = len(log(b, t[1]))
    sent = b.seat(t[0], "submit", **h, choices=[tackle, coin] if with_coin else [tackle], operation_id="r2-accept")
    assert (sent["outcome"], sent["result"]["diagnostic_id"]) == ("accepted", None)
    seen = {w: log(b, t[w])[base:] for w in (0, 1, "spectator")}
    for entries in seen.values():
        assert len(kinds(entries, "secret_plan_revealed")) == 1  # 公開は 1 回
        flips = kinds(entries, "coin_flip")
        if with_coin:
            assert [(f["source"], f["effect"], f["result"]) for f in flips] == [("stadium", GYM, side)]
        else:
            assert flips == []
    public = lambda es: [e for e in es if e["event"]["kind"] != "draw"]  # 引いたカードは本人にだけ中身が見える（既存の可視ログの境界）
    assert public(seen[0]) == public(seen[1]) == public(seen["spectator"])
    assert all(len(u) == 1 for u in updates(b, t).values())


def test_vm1_rejection_is_only_for_the_sender_and_the_plain_retry_is_accepted(rb):
    b, hubs = rb
    t, _cand, h, stages = start(b, "r2_coin_spearow")
    (_gust, kamaitachi), (coin,) = ids(stages)
    hub = hubs["r2_coin_spearow"]
    before, before_updates, before_logs = full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}
    others_before = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    sent = b.seat(t[0], "submit", **h, choices=[kamaitachi, coin], operation_id="r2-vm1")
    assert (sent["outcome"], sent["result"]["diagnostic_id"], sent["result"]["category"]) == ("rejected", VM1, "unresolved_ruling")
    assert (full(hub), updates(b, t), {w: log(b, t[w]) for w in (0, 1, "spectator")}) == (before, before_updates, before_logs)
    others = {w: b.seat(t[w], "view") for w in (1, "spectator")}
    assert others == others_before
    assert VM1 not in json.dumps(others, ensure_ascii=False) and RB.SPEAROW not in json.dumps(others, ensure_ascii=False)
    assert RB.SPEAROW not in json.dumps(b.seat(t[1], "candidates"), ensure_ascii=False)
    # 同じ局面で入力を直す（コインなし）。候補・入力は取り直す（取っ手の revision は応答ごとに新しい。選べるものは同じ）
    _cand2, h2, stages2 = open_attack(b, t)
    assert ids(stages2) == ids(stages) and stages2 == stages
    assert b.seat(t[0], "check", **h2, choices=[kamaitachi])["response"]["valid"] is True
    again = b.seat(t[0], "submit", **h2, choices=[kamaitachi], operation_id="r2-vm1-retry")
    assert again["outcome"] == "accepted"
    after = log(b, t[1])[len(before_logs[1]):]
    assert len(kinds(after, "secret_plan_revealed")) == 1
    assert [(f["source"], f["result"]) for f in kinds(after, "coin_flip")] == [("attack", "tails")]  # ワザ自身のコイン（盤面で決めた面）


def test_non_basic_real_card_is_trashed_without_a_coin(rb):
    b, _ = rb
    t, _cand, h, stages = start(b, "r2_coin_raticate")
    (first, _second), (coin,) = ids(stages)
    base = len(log(b, t[1]))
    sent = b.seat(t[0], "submit", **h, choices=[first, coin], operation_id="r2-trash")
    assert sent["outcome"] == "accepted"
    entries = log(b, t[1])[base:]
    assert [e["event"]["kind"] for e in entries] == ["secret_plan_revealed", "secret_plan_discarded"]
    assert kinds(entries, "coin_flip") == []


def test_the_actors_real_card_does_not_reach_others_before_sending(rb):
    b, _ = rb
    t, *_ = start(b, "r2_coin_magnemite_heads")
    for w in (1, "spectator"):
        text = json.dumps([b.seat(t[w], "view"), b.seat(t[w], "candidates") if w == 1 else None, log(b, t[w])], ensure_ascii=False)
        assert RB.MAGNEMITE not in text and "マチスのコイル" not in text
