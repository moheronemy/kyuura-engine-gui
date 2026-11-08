"""U7-5a〜d の 5 種類を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。

固定例（server/kyuura_gui_server/scenarios.py。tools/build_u7_5_scenarios.py）から始め、選び方は e2e（web/e2e/u75.spec.ts）と同じ。
候補は公開の kind と、選べるもののカード ID（本人に公開された値）で選ぶ（c1・o1 などの番号・並びに依存しない）。
応答はすべて Bridge が禁じた項目（seed・乱数・完全な状態など）を確かめる。

- ラッキースタジアム: 手札から出す（play_trainer）→ 場のスタジアムを使う（use_stadium。入力なし。choices []）→ 同じ番には出ない
- ヤマブキシティジム: エネルギーをつける → 手札から出す → 使う（エネルギーと holder を選ぶ）
- マチスの秘策: 使う → 受理（本人の決定）→ うらにするカードを選ぶ → うらのカード（相手にカード ID なし）→ おもてにする → 観測で公開
- ピッピ人形: 手札から出す → 場からすてる
- 錯乱ジム: 手札から出す → 交換おじさん → コイン「うら」→ 相手の決定 → 相手の「使う」は相手にだけ rejected（ほかへ更新なし）→ 辞退は accepted
- 「ばける」（再生した固定例）: ばけるの解除 → のせたカードはトラッシュ
"""

from __future__ import annotations

from .conftest import candidate_of, reach_first_turn, send_kind, tokens
from .test_attacks import card_ids


def by_card(card_id):
    return lambda stages: [next(o["id"] for o in stages[0]["options"] if o.get("card_id") == card_id)]


def inputs_of(b, token, kind):
    response = b.seat(token, "candidates")["response"]
    cand = candidate_of(response, kind)
    assert cand is not None, (kind, [c["kind"] for c in response["candidates"]])
    handle = {"game": response["game"], "revision": response["revision"], "candidate": cand["id"]}
    return cand, handle, b.seat(token, "inputs", **handle)["response"]


def latest(b, t, who=(1, "spectator")):
    return {w: b.updates(t[w])["latest"] for w in who}


def test_lucky_stadium_from_hand_then_use_without_input(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="lucky_stadium")
    trainer, _handle, inputs = inputs_of(b, t[0], "play_trainer")
    assert (trainer["processability"], trainer["input_disclosure"]) == ("may_stop_later", "confirmed")
    (stage,) = inputs["stages"]
    assert (stage["role"], stage["meaning"], stage["count"], stage["order"]) == ("trainer", "card", {"min": 1, "max": 1}, "not_applicable")
    assert all(set(o) <= {"id", "card", "card_id", "eligible", "processability", "reasons"} for o in stage["options"])
    checked, result = send_kind(b, t[0], "play_trainer", by_card("PRN-015"))
    assert checked["response"] == {"valid": True, "refusal": None}
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "in_progress", [{"kind": "turn_action", "player": 0}])
    # 場のスタジアム（持ち主は出したプレイヤー0。使うのは番のプレイヤー）。入力のない候補は段がなく、choices は []
    stadium, handle, inputs = inputs_of(b, t[0], "use_stadium")
    assert stadium["stadium"] == {"card": stadium["stadium"]["card"], "card_id": "PRN-015", "owner": 0}
    assert (stadium["input_disclosure"], stadium["input_stages"], stadium["choices_format"], inputs["stages"]) == ("no_input", [], "[]", [])
    assert b.seat(t[0], "check", **handle, choices=["o1"])["response"]["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    assert b.seat(t[0], "check", **handle, choices=[])["response"] == {"valid": True, "refusal": None}
    used = b.seat(t[0], "submit", **handle, choices=[], operation_id="lucky")
    assert (used["outcome"], used["result"]["status"]) == ("accepted", "in_progress")
    assert candidate_of(b.seat(t[0], "candidates")["response"], "use_stadium") is None  # 同じ番の 2 回目は候補に出さない（GUI は回数を数えない）
    view = b.seat(t[1], "view")["observation"]
    assert view["stadium"]["card_id"] == "PRN-015"  # 場のスタジアムは公開


def test_saffron_gym_energy_choice_with_holder(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="saffron_gym")

    def attach(stages):
        first = next(o["id"] for o in stages[0]["options"] if o["card_id"] == "PMCG1-101")
        zones = {o["id"]: o.get("zone") for o in stages[1]["options"]}
        return [first, next(p["option"] for p in stages[1]["options_by_choice"][first] if zones[p["option"]] == "active")]

    assert send_kind(b, t[0], "attach_energy", attach)[1]["outcome"] == "accepted"
    assert send_kind(b, t[0], "play_trainer", by_card("PMCG6-090"))[1]["outcome"] == "accepted"
    stadium, handle, inputs = inputs_of(b, t[0], "use_stadium")
    assert stadium["stadium"]["card_id"] == "PMCG6-090" and stadium["input_disclosure"] == "confirmed"
    (stage,) = inputs["stages"]
    assert (stage["role"], stage["meaning"], stage["count"]) == ("energy", "card", {"min": 1, "max": 1})
    (option,) = stage["options"]
    active = b.seat(t[0], "view")["observation"]["players"][0]["active"]
    assert option["card_id"] == "PMCG1-101" and option["holder"] == {"pokemon": active["pokemon_id"], "card": option["holder"]["card"], "zone": "active",
                                                                    "card_id": "PMCG6-043"}
    assert card_ids(inputs) <= card_ids(b.seat(t[0], "view"))
    hand_before = b.seat(t[0], "view")["observation"]["players"][0]["hand"]["count"]
    used = b.seat(t[0], "submit", **handle, choices=[option["id"]], operation_id="saffron")
    assert (used["outcome"], used["result"]["status"]) == ("accepted", "in_progress")
    after = b.seat(t[0], "view")["observation"]["players"][0]
    active_energy = after["active"]["energy"]
    assert after["hand"]["count"] == hand_before + 1 and active_energy == []  # 観測から: エネルギーが手札にもどった


def test_secret_plan_decision_face_down_then_reveal(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="secret_plan")
    _checked, result = send_kind(b, t[0], "play_trainer", by_card("PMCG5-093"))
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "awaiting_decision", [{"kind": "answer_decision", "player": 0}])
    assert b.seat(t[1], "candidates")["response"]["situation"] == "waiting_for_player"
    _cand, handle, decision = inputs_of(b, t[0], "answer_decision")
    (stage,) = decision["stages"]
    assert (stage["decision_kind"], stage["count"], stage["decline"]) == ("secret_plan_card", {"min": 0, "max": 1}, True)
    chosen = next(o["id"] for o in stage["options"] if o["card_id"] == "PMCG1-014")  # ヒトカゲ（たねポケモン。おもてにしても残る）
    assert b.seat(t[0], "submit", **handle, choices=[chosen], operation_id="plan")["outcome"] == "accepted"
    # うらのカード: 相手・観戦者の観測にカード ID・名前がない
    for who in (1, "spectator"):
        (slot,) = b.seat(t[who], "view")["observation"]["players"][0]["bench"]
        assert slot["face_down"] is True and "card_id" not in slot and "name_ja" not in slot
    reveal, handle, inputs = inputs_of(b, t[0], "reveal_face_down")
    assert (reveal["processability"], reveal["reasons"]) == ("may_stop_later", ["face_down_reveal_not_evaluated"])
    (option,) = inputs["stages"][0]["options"]
    assert inputs["stages"][0]["role"] == "face_down" and option["face_down"] is True and "card_id" not in option  # 本人にもうらのまま（残るかを予告しない）
    before = latest(b, t)
    assert b.seat(t[0], "check", **handle, choices=[option["id"]])["response"]["valid"] is True
    revealed = b.seat(t[0], "submit", **handle, choices=[option["id"]], operation_id="reveal")
    assert (revealed["outcome"], revealed["result"]["status"]) == ("accepted", "in_progress")
    for who in (1, "spectator"):
        assert b.updates(t[who], before[who])["updates"]  # 公開の更新が届く
        (slot,) = b.seat(t[who], "view")["observation"]["players"][0]["bench"]
        assert slot.get("face_down") is not True and slot["card_id"] == "PMCG1-014"  # 実行のあとに観測で公開


def test_clefairy_doll_play_then_discard_from_play(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="clefairy_doll")
    assert send_kind(b, t[0], "play_trainer", by_card("PMCG1-091"))[1]["outcome"] == "accepted"
    bench = b.seat(t[1], "view")["observation"]["players"][0]["bench"]
    assert [s["card_id"] for s in bench] == ["PMCG1-091"]
    _cand, handle, inputs = inputs_of(b, t[0], "discard_from_play")
    (option,) = inputs["stages"][0]["options"]
    assert (inputs["stages"][0]["role"], option["card_id"], option["zone"], option["processability"]) == ("discard", "PMCG1-091", "bench", "supported")
    result = b.seat(t[0], "submit", **handle, choices=[option["id"]], operation_id="doll")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")
    assert b.seat(t[1], "view")["observation"]["players"][0]["bench"] == []


def test_chaos_gym_opponent_answers_and_private_rejection(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="chaos_gym")
    assert send_kind(b, t[0], "play_trainer", by_card("PMCG5-087"))[1]["outcome"] == "accepted"
    _checked, result = send_kind(b, t[0], "play_trainer", by_card("PMCG1-093"))
    # コインの結果（「うら」）はエンジンが決める。宣言は受理され、相手が答える決定
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "awaiting_decision", [{"kind": "answer_decision", "player": 1}])
    assert b.seat(t[0], "candidates")["response"]["situation"] == "waiting_for_player"  # 使ったプレイヤーには入力がない
    _cand, handle, inputs = inputs_of(b, t[1], "answer_decision")
    (stage,) = inputs["stages"]
    assert (stage["decision_kind"], stage["count"], stage["decline"]) == ("accept_request", {"min": 0, "max": 1}, True)
    before = latest(b, t, (0, "spectator"))
    rejected = b.seat(t[1], "submit", **handle, choices=[stage["options"][0]["id"]], operation_id="borrow")
    assert (rejected["outcome"], rejected["refetch_required"], rejected["result"]["diagnostic_id"]) == ("rejected", False, "NO_POKEMON_CARD_IN_HAND")
    for who in (0, "spectator"):
        assert b.updates(t[who], before[who])["updates"] == []  # 拒否の存在を使ったプレイヤー・観戦者へ知らせない
    declined = b.seat(t[1], "submit", **handle, choices=[], operation_id="decline")  # 取っ手はそのまま（拒否では失効しない）
    assert (declined["outcome"], declined["result"]["status"], declined["result"]["next"]) == ("accepted", "in_progress", [{"kind": "turn_action", "player": 0}])
    assert b.seat(t[1], "candidates")["response"]["situation"] == "waiting_for_player"


def test_disguise_scenario_remove_disguise(bridge):
    b = bridge
    created = b.create(mode="scenario", scenario="disguise")
    assert created["ok"]
    t = tokens(created["match"])
    _cand, handle, inputs = inputs_of(b, t[0], "remove_disguise")
    (option,) = inputs["stages"][0]["options"]
    assert (inputs["stages"][0]["role"], option["card_id"], option["zone"], option["processability"]) == ("disguised", "PMCG5-019", "active", "may_stop_later")
    discard_before = len(b.seat(t[1], "view")["observation"]["players"][0]["discard"])
    result = b.seat(t[0], "submit", **handle, choices=[option["id"]], operation_id="undisguise")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")
    discard = b.seat(t[1], "view")["observation"]["players"][0]["discard"]
    assert len(discard) == discard_before + 1 and discard[-1]["card_id"] == "PMCG1-017"  # のせたリザードは持ち主のトラッシュ（観測から）
    assert candidate_of(b.seat(t[0], "candidates")["response"], "remove_disguise") is None
