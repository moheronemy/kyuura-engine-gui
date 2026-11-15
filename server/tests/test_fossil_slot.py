"""0.185.0（化石の発掘の山札の側の card_id・スロットゲームの束 reveal_deck_top の card_ids）を、接続層の既存の主体別の口（log）でそのまま渡せること
（実際の固定版のエンジン。模擬の応答を使わない。docs/engine-contract.md 27 章）。接続層・安全検査は変えていない（0.183.0 の 25 章のまま）。

- 盤面: ``tests/reveal_boards.py`` の reveal_fossil・reveal_slot_pair・reveal_slot_triple・reveal_master_ball（エンジンの v0.185 の回帰テストの盤面と同じ状態）。
  new_game からの到達ではない
- 操作は HTTP の口（candidates・inputs・check・submit）だけで、入力は選べるものの value・card_id と、本人の観測のトラッシュ（公開）だけで作る
- 束の対応（card_ids[i] は cards[i] のカード）は、受理の前の観測から確かめられないので、同じ束から手札に加えた reveal_from_deck（見せたカード自身の card_id）と、
  盤面の山札の card_id の数で確かめる（uid の対応表・内部の状態は読まない。状態・乱数・ログが log で変わらないことだけ、控えた ClientHub で確かめる）
"""

from __future__ import annotations

import json
from collections import Counter

import pytest
from fastapi.testclient import TestClient

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import reveal_boards as RB
from .p6_boards import install_boards
from .test_log import SEATS, LogBridge, full

BOARDS = ("reveal_fossil", "reveal_slot_pair", "reveal_slot_triple", "reveal_master_ball")
PUBLIC_KINDS = ("reveal_deck_top", "reveal_from_deck", "retrieve_trainer")


@pytest.fixture()
def rb(monkeypatch):
    hubs = {}

    def build(board_id):
        hub = RB.build(board_id)
        hubs[board_id] = hub
        return hub

    install_boards(scenarios, {b: (RB.LABELS[b], RB.DESCRIPTION, build) for b in BOARDS}, monkeypatch)
    return LogBridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def act(b, t, actor, kind, card_ids=(), *, not_in_own_discard=False):
    cands = b.post(t, actor, "candidates").json()["response"]
    cand = next(x for x in cands["candidates"] if x["kind"] == kind)
    h = {"game": cands["game"], "revision": cands["revision"], "candidate": cand["id"]}
    stages = b.post(t, actor, "inputs", **h).json()["response"].get("stages") or []
    discard = {c["card"] for c in b.post(t, actor, "view").json()["observation"]["players"][actor]["discard"]} if not_in_own_discard else set()
    choices = []
    if card_ids:
        wanted = list(card_ids)
        for o in stages[0]["options"]:
            if o.get("card_id") in wanted and o.get("card") not in discard:
                choices.append(o["id"])
                wanted.remove(o["card_id"])
        assert wanted == [], kind
    assert b.post(t, actor, "check", **h, choices=choices).json()["response"]["valid"]
    result = b.post(t, actor, "submit", **h, choices=choices, operation_id=f"t-{kind}").json()
    assert result["outcome"] == "accepted", result
    return result


def events(b, t, who, kinds=PUBLIC_KINDS):
    return [e for e in b.read_all(t, who)[0] if e["event"]["kind"] in kinds]


def same_for_every_viewer(b, t, kinds=PUBLIC_KINDS):
    got = {who: events(b, t, who, kinds) for who in SEATS}
    assert len({json.dumps(v, sort_keys=True) for v in got.values()}) == 1, got  # 持ち主・相手・観戦者・ホストで同じ（公開の出来事）
    return got[SEATS[0]]


def test_fossil_deck_pick_is_identified_only_when_shown(rb):
    b, hubs = rb
    t = b.create("reveal_fossil")
    act(b, t, 0, "play_trainer", (RB.FOSSIL_EXCAVATION,))
    assert same_for_every_viewer(b, t) == []  # 選ぶ前（決定の時点）は、どの入口にも見せたカードの出来事はない
    for who in (1, "spectator", "host"):
        assert RB.CLEFAIRY_DOLL not in json.dumps(b.read_all(t, who)[0])
    act(b, t, 0, "answer_decision", (RB.MYSTERIOUS_FOSSIL,), not_in_own_discard=True)
    (shown,) = same_for_every_viewer(b, t)
    assert {k: v for k, v in shown["event"].items() if k not in ("turn", "card")} == {"kind": "reveal_from_deck", "player": 0, "card_id": RB.MYSTERIOUS_FOSSIL}
    fixed = same_for_every_viewer(b, t)
    act(b, t, 0, "end_turn")
    assert same_for_every_viewer(b, t)[: len(fixed)] == fixed  # 後の受理で前の出来事は変わらない
    for who in (1, "spectator", "host"):  # 選ばなかった山札のカード（ピッピ人形）は出ない
        deck_doll = [e for e in b.read_all(t, who)[0] if e["event"].get("card_id") == RB.CLEFAIRY_DOLL]
        assert deck_doll == []
    state = full(hubs["reveal_fossil"])
    for who in SEATS:
        b.read_all(t, who)
    assert full(hubs["reveal_fossil"]) == state


@pytest.mark.parametrize("board, deck", [("reveal_slot_pair", RB.BOARDS["reveal_slot_pair"][0]["deck"]), ("reveal_slot_triple", RB.BOARDS["reveal_slot_triple"][0]["deck"])])
def test_slot_bundle_card_ids_follow_cards_per_position(rb, board, deck):
    b, hubs = rb
    t = b.create(board)
    assert same_for_every_viewer(b, t) == []  # 公開の前には束の出来事はない
    act(b, t, 0, "play_trainer", (RB.SLOT_GAME,))
    shown = same_for_every_viewer(b, t)
    bundle = shown[0]["event"]
    assert bundle["kind"] == "reveal_deck_top" and bundle["player"] == 0
    assert sorted(bundle) == ["card_ids", "cards", "count", "kind", "player", "trainer_card", "turn"]
    assert len(bundle["cards"]) == len(bundle["card_ids"]) == 3 and len(set(bundle["cards"])) == 3  # 別の個体
    assert Counter(bundle["card_ids"]) == Counter(deck)  # 同じ ID も位置ごと（まとめない）。山札 3 枚がちょうど見せた束
    taken = [e["event"] for e in shown[1:] if e["event"]["kind"] == "reveal_from_deck"]
    for e in taken:  # 手札に加えたカードは、束の同じ位置の値
        assert e["card_id"] == bundle["card_ids"][bundle["cards"].index(e["card"])]
    assert len(taken) == max(n for n in Counter(deck).values() if n >= 2)  # 同じ名前の 2 枚以上を加える（この盤面では水の枚数）
    fixed = same_for_every_viewer(b, t)
    act(b, t, 0, "end_turn")
    assert same_for_every_viewer(b, t)[: len(fixed)] == fixed
    state = full(hubs[board])
    for who in SEATS:
        b.read_all(t, who)
    assert full(hubs[board]) == state


def test_private_bundle_stays_hidden_from_others_on_0185(rb):
    b, _ = rb
    t = b.create("reveal_master_ball")
    act(b, t, 0, "play_trainer", (RB.MASTER_BALL,))
    act(b, t, 0, "answer_decision", (RB.RATTATA,))
    own = [e["event"] for e in b.read_all(t, 0)[0] if e["event"]["kind"] == "look_at_deck_top"]
    assert len(own) == 1 and "cards" in own[0] and "card_ids" not in own[0]  # 本人には uid の並びだけ（識別の情報は足されていない）
    for who in (1, "spectator", "host"):
        entries = b.read_all(t, who)[0]
        looked = [e["event"] for e in entries if e["event"]["kind"] == "look_at_deck_top"]
        assert len(looked) == 1 and looked[0].get("hidden") == {"cards": 7} and "cards" not in looked[0] and "card_ids" not in looked[0]
        assert [e for e in entries if e["event"]["kind"] == "reveal_deck_top"] == []
        assert RB.FIRE not in json.dumps(entries)  # 見ただけの炎エネルギー 7 枚の ID は出ない（見せたのはコラッタだけ）
