"""U7-3 の番の基本の操作 4 種類を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン・seed を固定した new_game）。

選び方は e2e（web/e2e/turn-basics.spec.ts）と同じ。候補は公開の kind で選ぶ（c1 などの番号・並びに依存しない）。
応答はすべて Bridge が禁じた項目（seed・乱数・完全な状態など）を確かめる。
"""

from __future__ import annotations

from .conftest import ENVELOPE, candidate_of, first_eligible, reach_first_turn, send_kind


def _pair(stages):
    """2 段の操作: 1 段目の最初 → その番号の options_by_choice の最初の eligible の組。"""
    first = stages[0]["options"][0]["id"]
    pair = next(p for p in stages[1]["options_by_choice"][first] if p["eligible"])
    return [first, pair["option"]]


def _retreat(stages):
    """にげる: 最初の控え → エネルギーを並びの順に、units の合計が total_units.min に届くまで。"""
    need = stages[1]["total_units"]["min"]
    picked, total = [], 0
    for option in stages[1]["options"]:
        if total >= need:
            break
        picked.append(option["id"])
        total += option["units"]
    return [first_eligible(stages[0]), *picked]


def _updates(bridge, token, after):
    return bridge.updates(token, after)["updates"]


def test_four_turn_basics_are_forwarded_and_accepted(fixed_bridge):
    b = fixed_bridge
    t = reach_first_turn(b)
    assert t["mulligans"] == 1  # 補償の引く枚数も固定の条件で 1 回通る

    # 番 1: ベンチに出す（1 段。bench の数と上限）→ エネルギーをつける（2 段・options_by_choice）
    response = b.seat(t[0], "candidates")["response"]
    play = candidate_of(response, "play_basic")
    stages = b.seat(t[0], "inputs", game=response["game"], revision=response["revision"], candidate=play["id"])["response"]["stages"]
    assert stages[0]["role"] == "bench" and stages[0]["bench"] == {"count": 0, "limit": 5}
    assert all("card_id" in o and o["eligible"] for o in stages[0]["options"])
    checked, result = send_kind(b, t[0], "play_basic", lambda s: [s[0]["options"][0]["id"]])
    assert checked["response"] == {"valid": True, "refusal": None} and result["outcome"] == "accepted"
    view = b.seat(t[0], "view")["observation"]
    assert len(view["players"][0]["bench"]) == 1

    checked, result = send_kind(b, t[0], "attach_energy", _pair)
    assert checked["response"]["valid"] and result["outcome"] == "accepted"
    assert len(b.seat(t[0], "view")["observation"]["players"][0]["active"]["energy"]) == 1

    # 同じ番の 2 回目のエネルギーは候補に出さない（エンジンの確かめ。GUI は推測しない）
    assert candidate_of(b.seat(t[0], "candidates")["response"], "attach_energy") is None
    send_kind(b, t[0], "end_turn", lambda s: [], check=False)
    send_kind(b, t[1], "end_turn", lambda s: [], check=False)

    # 番 3: 進化（2 段）→ エネルギー → にげる（units の合計・選んだ順）
    before = b.seat(t[0], "view")["observation"]["players"][0]["bench"][0]["card_id"]
    checked, result = send_kind(b, t[0], "evolve", _pair)
    assert checked["response"]["valid"] and result["outcome"] == "accepted"
    after = b.seat(t[0], "view")["observation"]["players"][0]["bench"][0]
    assert after["card_id"] != before
    send_kind(b, t[0], "attach_energy", _pair)

    response = b.seat(t[0], "candidates")["response"]
    retreat = candidate_of(response, "retreat")
    handle = {"game": response["game"], "revision": response["revision"], "candidate": retreat["id"]}
    stages = b.seat(t[0], "inputs", **handle)["response"]["stages"]
    assert stages[1]["role"] == "discard" and stages[1]["total_units"] == {"min": 2, "max": 2}
    assert [o["units"] for o in stages[1]["options"]] == [1, 1] and stages[1]["order"] == "significant"
    # 個数が足りない（1 枚・1 個）: 入力の拒否。拒否では更新が作られない（相手・観戦者へ知らせない）
    latest = {who: b.updates(t[who])["latest"] for who in (1, "spectator")}
    short = [first_eligible(stages[0]), stages[1]["options"][0]["id"]]
    assert b.seat(t[0], "check", **handle, choices=short)["response"]["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    refused = b.seat(t[0], "submit", **handle, choices=short, operation_id="short")
    assert refused["outcome"] == "refused" and refused["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    for who in (1, "spectator"):
        assert _updates(b, t[who], latest[who]) == []
    # 拒否では取っ手は失効しない: 同じ取っ手で正しい入力
    choices = _retreat(stages)
    assert b.seat(t[0], "check", **handle, choices=choices)["response"] == {"valid": True, "refusal": None}
    old_active = b.seat(t[0], "view")["observation"]["players"][0]["active"]["card_id"]
    result = b.seat(t[0], "submit", **handle, choices=choices, operation_id="retreat")
    assert result["outcome"] == "accepted"
    field = b.seat(t[0], "view")["observation"]["players"][0]
    assert field["active"]["card_id"] == after["card_id"] and field["bench"][0]["card_id"] == old_active
    # 受理のあとは相手・観戦者にも更新がある
    for who in (1, "spectator"):
        assert _updates(b, t[who], latest[who])
    # 受理で取っ手は失効する
    stale = b.seat(t[0], "check", **handle, choices=choices)
    assert stale["refetch_required"] is True


def test_turn_basics_respect_actor_and_host_separation(fixed_bridge):
    b = fixed_bridge
    t = reach_first_turn(b)
    # 相手（番でない）には候補がない。ホストには番の操作の候補がない
    assert b.seat(t[1], "candidates")["response"]["candidates"] == []
    host = b.host(t["host"], "candidates")["response"]
    assert all(c["kind"] not in ("play_basic", "attach_energy", "evolve", "retreat") for c in host["candidates"])
    # プレイヤー0の取っ手を相手の入口・ホストの口で使えない
    response = b.seat(t[0], "candidates")["response"]
    play = candidate_of(response, "play_basic")
    handle = {"game": response["game"], "revision": response["revision"], "candidate": play["id"]}
    other = b.seat(t[1], "submit", **handle, choices=["o1"], operation_id="other")
    assert other["outcome"] == "refused" and other["refusal"]["code"] in ("CANDIDATES_WRONG_ACTOR", "CANDIDATES_STALE")
    host_try = b.client.post(f"/api/host/{t[0]}", json={**ENVELOPE, "type": "submit", **handle, "choices": ["o1"], "operation_id": "h"}).json()
    assert host_try["error"]["code"] == "GUI_SEAT_UNKNOWN"
    # 要求で主体を選べない（actor を書けばエンジンが断る）
    forged = b.client.post(f"/api/seat/{t[1]}", json={**ENVELOPE, "type": "candidates", "actor": 0}).json()
    assert forged["ok"] is False and forged["error"]["code"] == "CLIENT_FIELD_UNKNOWN"


def test_pair_outside_options_by_choice_is_refused(fixed_bridge):
    b = fixed_bridge
    t = reach_first_turn(b)
    response = b.seat(t[0], "candidates")["response"]
    attach = candidate_of(response, "attach_energy")
    handle = {"game": response["game"], "revision": response["revision"], "candidate": attach["id"]}
    stages = b.seat(t[0], "inputs", **handle)["response"]["stages"]
    assert stages[1]["depends_on_stage"] == 1
    ids2 = {o["id"] for o in stages[1]["options"]}
    for first, pairs in stages[1]["options_by_choice"].items():
        assert {p["option"] for p in pairs} <= ids2
    # 段の順を逆にした入力・1 段目だけの入力は断る（GUI は段の順に送る）
    first, second = _pair(stages)
    for bad in ([second, first], [first], [first, first]):
        answer = b.seat(t[0], "check", **handle, choices=bad)["response"]
        assert answer["valid"] is False and answer["refusal"]["code"] == "CANDIDATE_INPUT_INVALID", bad
