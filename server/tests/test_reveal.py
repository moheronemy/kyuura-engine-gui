"""0.184.0（見せる 17 の呼ぶ箇所の card_id）の代表 3 経路を、接続層の既存の主体別の口（log）でそのまま渡せること（実際の固定版のエンジン。模擬の応答を使わない。
docs/engine-contract.md 26 章）。接続層・安全検査は変えていない（0.183.0 の 25 章のまま）。

- 盤面: ``tests/reveal_boards.py``（エンジンの v0.184 の回帰テストの代表の盤面と同じ状態）と ``tests/trader_boards.py`` の computer_search_log。new_game からの到達ではない
- 代表: A トレーナー（マスターボール）・B 特殊能力（［おくりもの］。使った人と相手の両方が見せる。``power``）・C ワザの要素（くらげのむれ。``effect``）。
  残りの 14 の呼ぶ箇所と、同じ処理を通るほかのカードはここでは実行していない
- 操作は HTTP の口（candidates・inputs・check・submit）だけで、入力は選べるものの value・pokemon（本人の観測）・attack_index・card_id だけで作る
- 状態・乱数・ログ・決定が log で変わらないことだけは、テストの中で控えた ClientHub の状態で確かめる（``test_log.py`` と同じ）
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import reveal_boards as RB
from . import trader_boards as TB
from .p6_boards import install_boards
from .test_log import SEATS, LogBridge, full

SHOWN = ("reveal_from_deck", "return_to_deck")


@pytest.fixture()
def rb(monkeypatch):
    hubs = {}

    def capture(builder):
        def build(board_id):
            hub = builder(board_id)
            hubs[board_id] = hub
            return hub
        return build

    boards = {b: (RB.LABELS[b], RB.DESCRIPTION, capture(RB.build)) for b in RB.BOARDS}
    boards["computer_search_log"] = (TB.LABELS["computer_search_log"], TB.DESCRIPTION, capture(TB.build))
    install_boards(scenarios, boards, monkeypatch)
    return LogBridge(TestClient(create_app(), base_url="http://127.0.0.1")), hubs


def key_of(stage, o):
    if "value" in o:
        return o["value"]
    meaning = stage.get("meaning")
    return o.get("pokemon") if meaning == "pokemon" else o.get("attack_index") if meaning == "attack" else o.get("card_id")


def act(b, t, actor, kind, picks):
    cands = b.post(t, actor, "candidates").json()["response"]
    cand = next(x for x in cands["candidates"] if x["kind"] == kind)
    h = {"game": cands["game"], "revision": cands["revision"], "candidate": cand["id"]}
    inputs = b.post(t, actor, "inputs", **h).json()["response"]
    choices = []
    for i, st in enumerate(inputs.get("stages") or []):
        wanted = list(picks[i]) if i < len(picks) else []
        for o in st.get("options") or []:
            if key_of(st, o) in wanted:
                choices.append(o["id"])
                wanted.remove(key_of(st, o))
        assert wanted == [], (kind, i)
    assert b.post(t, actor, "check", **h, choices=choices).json()["response"]["valid"]
    result = b.post(t, actor, "submit", **h, choices=choices, operation_id=f"t-{kind}").json()
    assert result["outcome"] == "accepted", result
    return result


def shown(b, t, who):
    return [(e["event"]["kind"], e["event"]["player"], e["event"].get("card_id"), e["event"].get("power"), e["event"].get("effect"))
            for e in b.read_all(t, who)[0] if e["event"]["kind"] in SHOWN]


def own_pokemon_id(b, t):
    return b.post(t, 0, "view").json()["observation"]["players"][0]["active"]["pokemon_id"]


CASES = {
    "reveal_master_ball": ([(0, "play_trainer", lambda b, t: [[RB.MASTER_BALL]]), (0, "answer_decision", lambda b, t: [[RB.RATTATA]])],
                           [("reveal_from_deck", 0, RB.RATTATA, None, None)]),
    "reveal_gift": ([(0, "evolve", lambda b, t: [[RB.LIGHT_TOGETIC], [own_pokemon_id(b, t)]]), (0, "answer_decision", lambda b, t: [[1]]),
                     (0, "answer_decision", lambda b, t: [[1]]), (0, "answer_decision", lambda b, t: [[RB.BERRY]]),
                     (1, "answer_decision", lambda b, t: [[1]]), (1, "answer_decision", lambda b, t: [[RB.BERRY]])],
                    [("reveal_from_deck", 0, RB.BERRY, f"{RB.LIGHT_TOGETIC}@power0", None), ("reveal_from_deck", 1, RB.BERRY, f"{RB.LIGHT_TOGETIC}@power0", None)]),
    "reveal_jellyfish": ([(0, "use_attack", lambda b, t: [[1]]), (0, "answer_decision", lambda b, t: [[RB.JELLYFISH_TARGET]])],
                         [("reveal_from_deck", 0, RB.JELLYFISH_TARGET, None, f"{RB.JELLYFISH_ATTACKER}#1")]),
}


@pytest.mark.parametrize("board", list(CASES))
def test_representative_shown_cards_reach_every_viewer_only_when_shown(rb, board):
    b, hubs = rb
    t = b.create(board)
    steps, expected = CASES[board]
    seen = []
    for actor, kind, picks in steps:
        before = {who: shown(b, t, who) for who in SEATS}
        act(b, t, actor, kind, picks(b, t))
        after = {who: shown(b, t, who) for who in SEATS}
        assert len({json.dumps(v) for v in after.values()}) == 1  # 持ち主・相手・観戦者・ホストで同じ（公開の出来事）
        new = after[0][len(before[0]):]
        seen += new
        for who in SEATS:
            assert after[who][: len(before[who])] == before[who]  # 前に固定した出来事は変わらない
    assert seen == expected  # 見せた時点にだけ、見せたカード自身の card_id。選ぶ前の段では出ない
    state_before = full(hubs[board])
    for who in SEATS:
        entries, pages = b.read_all(t, who)
        assert pages[-1]["baseline_end"] == {"segment": 0, "index": 0}  # 構築盤面のログは空から（どの出来事も受理の時点の写し）
    assert full(hubs[board]) == state_before


def test_gift_opponent_reveal_is_its_own_event_after_the_users(rb):
    b, _ = rb
    t = b.create("reveal_gift")
    for actor, kind, picks in CASES["reveal_gift"][0]:
        act(b, t, actor, kind, picks(b, t))
    entries = [e for e in b.read_all(t, "spectator")[0] if e["event"]["kind"] in SHOWN]
    assert [e["event"]["player"] for e in entries] == [0, 1] and entries[0]["log_index"] < entries[1]["log_index"]
    # 選ばなかった山札のカード（水エネルギー）は、どの出来事にも識別の情報として出ない（見せたのはどうぐの 2 枚だけ）
    assert RB.WATER not in json.dumps(b.read_all(t, "spectator")[0])


def test_computer_search_stays_hidden_on_0184(rb):
    b, _ = rb
    t = b.create("computer_search_log")
    act(b, t, 0, "play_trainer", [[TB.COMPUTER_SEARCH]])
    act(b, t, 0, "answer_decision", [[TB.FIRE, TB.PONYTA]])
    act(b, t, 0, "answer_decision", [[TB.BILL]])
    for who in (1, "spectator", "host"):
        entries = b.read_all(t, who)[0]
        assert [e["event"].get("hidden") for e in entries if e["event"]["kind"] == "search_deck"] == [{"card": None}]
        assert [e for e in entries if e["event"]["kind"] in SHOWN] == []
        assert TB.BILL not in json.dumps(entries)
