"""U7-4 のワザの宣言を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン・seed を固定した new_game）。

選び方は e2e（web/e2e/attacks.spec.ts）と同じ。候補は公開の kind で選ぶ（c1 などの番号・並びに依存しない）。
応答はすべて Bridge が禁じた項目（seed・乱数・完全な状態など）を確かめる。

- プリセットの 1・2 番目のデッキ: 番 1 にエネルギー → ジャブ（受理・番が移る）→ 番 3 にジャブ → きぜつ → サイドを取る決定（本人）→ 終局
- ファイヤー（ドライアップ）のデッキ 対 プリセットの 1 番目: 番 3 にドライアップ → 受理（対象を選ぶ決定）→ 答えると受理のあと停止（DU1）
"""

from __future__ import annotations

from .conftest import MOLTRES_DECK, candidate_of, first_eligible, reach_first_turn, send_kind


def attach_to_active(stages):
    """エネルギーをつける: 1 段目の最初 → その番号の組のうちバトル場のポケモン（e2e と同じ）。"""
    first = stages[0]["options"][0]["id"]
    zones = {o["id"]: o.get("zone") for o in stages[1]["options"]}
    pair = next(p for p in stages[1]["options_by_choice"][first] if p["eligible"] and zones[p["option"]] == "active")
    return [first, pair["option"]]


def card_ids(value) -> set[str]:
    if isinstance(value, dict):
        found = {value["card_id"]} if isinstance(value.get("card_id"), str) else set()
        return found.union(*(card_ids(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(*(card_ids(v) for v in value)) if value else set()
    return set()


def attack_inputs(b, token):
    response = b.seat(token, "candidates")["response"]
    attack = candidate_of(response, "use_attack")
    assert attack is not None, [c["kind"] for c in response["candidates"]]
    handle = {"game": response["game"], "revision": response["revision"], "candidate": attack["id"]}
    return attack, handle, b.seat(token, "inputs", **handle)["response"]


def test_attack_is_forwarded_and_turn_moves(fixed_bridge):
    b = fixed_bridge
    t = reach_first_turn(b)
    # エネルギーがないうちはワザの候補を出さない（評価はした: scope_kinds には入る）
    turn = b.seat(t[0], "candidates")["response"]
    assert candidate_of(turn, "use_attack") is None and "use_attack" in turn["coverage"]["scope_kinds"]
    assert "use_attack" not in turn["coverage"]["not_covered_kinds"]
    send_kind(b, t[0], "attach_energy", attach_to_active)

    attack, handle, inputs = attack_inputs(b, t[0])
    assert attack["processability"] == "may_stop_later" and attack["input_disclosure"] == "confirmed"
    assert set(attack["reasons"]) == {"continuation_not_evaluated", "preflight_not_evaluated"}
    first, second = inputs["stages"]
    assert (first["role"], first["meaning"], first["count"]) == ("attack", "attack", {"min": 1, "max": 1})
    option = first["options"][0]
    assert {k: option[k] for k in ("card_id", "attack_index", "route", "name_ja", "cost", "damage", "text_ja")} == {
        "card_id": "PMCG1-058", "attack_index": 0, "route": "form", "name_ja": "ジャブ", "cost": ["fighting"], "damage": "20", "text_ja": None}
    assert option["eligible"] is True and option["processability"] == "may_stop_later"
    # 宣言といっしょに選ぶものはない（0 個・空の組）
    assert (second["role"], second["count"], second["options"], second["depends_on_stage"]) == ("declaration_options", {"min": 0, "max": 0}, [], 1)
    assert second["options_by_choice"] == {option["id"]: []} and second["decline"] is True and second["order"] == "significant"
    # 情報境界: 入力のカード ID は、本人の観測にあるカードだけ
    assert card_ids(inputs) <= card_ids(b.seat(t[0], "view"))

    # 入力の誤りは client_api の段で断る（エンジンに渡さない）。拒否では相手・観戦者に更新がない
    latest = {who: b.updates(t[who])["latest"] for who in (1, "spectator")}
    for bad in ([], [option["id"], option["id"]], ["o9"], [option["id"], "o9"]):
        answer = b.seat(t[0], "check", **handle, choices=bad)["response"]
        assert answer["valid"] is False and answer["refusal"]["code"] == "CANDIDATE_INPUT_INVALID", bad
    refused = b.seat(t[0], "submit", **handle, choices=[option["id"], option["id"]], operation_id="dup")
    assert (refused["outcome"], refused["refusal"]["code"], refused["result"], refused["refetch_required"]) == ("refused", "CANDIDATE_INPUT_INVALID", None, False)
    for who in (1, "spectator"):
        assert b.updates(t[who], latest[who])["updates"] == []

    # 正しい入力（いっしょに選ぶもの 0 個）: check は通る（受理の保証ではない）→ submit が受理し、番が移る
    assert b.seat(t[0], "check", **handle, choices=[option["id"]])["response"] == {"valid": True, "refusal": None}
    hp_before = b.seat(t[1], "view")["observation"]["players"][1]["active"]
    result = b.seat(t[0], "submit", **handle, choices=[option["id"]], operation_id="jab")
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "in_progress", [{"kind": "turn_action", "player": 1}])
    assert result["refetch_required"] is True
    view = b.seat(t[1], "view")["observation"]
    assert view["current_player"] == 1 and view["players"][1]["active"]["damage"] == hp_before["damage"] + 20
    for who in (1, "spectator"):
        assert b.updates(t[who], latest[who])["updates"]  # 受理のあとは相手・観戦者にも更新がある
    assert b.seat(t[0], "check", **handle, choices=[option["id"]])["refetch_required"] is True  # 受理で取っ手は失効する
    assert b.seat(t[0], "candidates")["response"]["candidates"] == []


def test_attack_knock_out_leads_to_own_decision_then_game_over(fixed_bridge):
    b = fixed_bridge
    t = reach_first_turn(b)
    send_kind(b, t[0], "attach_energy", attach_to_active)
    _, result = send_kind(b, t[0], "use_attack", lambda s: [first_eligible(s[0])])
    assert result["outcome"] == "accepted"
    send_kind(b, t[1], "end_turn", lambda s: [], check=False)
    send_kind(b, t[0], "attach_energy", attach_to_active)
    _, result = send_kind(b, t[0], "use_attack", lambda s: [first_eligible(s[0])])
    # 受理のあとの決定（サイドを取る）は、宣言の前ではなく受理のあとに本人の候補で答える
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "awaiting_decision", [{"kind": "answer_decision", "player": 0}])
    own = b.seat(t[0], "candidates")["response"]
    assert [c["kind"] for c in own["candidates"]] == ["take_prize"]
    other = b.seat(t[1], "candidates")["response"]
    assert other["candidates"] == [] and other["situation"] == "waiting_for_player"
    _, result = send_kind(b, t[0], "take_prize", lambda s: [s[0]["options"][0]["id"]])
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "game_over")
    assert b.seat(t[1], "view")["status"]["status"] == "game_over"


def test_attack_with_decision_after_acceptance_then_halt(fixed_bridge):
    """ドライアップ: 宣言は受理（対象は宣言のあとの決定）。答えると、コインの結果でエンジンが対戦を止める（受理のあとの停止。拒否ではない）。"""
    b = fixed_bridge
    t = reach_first_turn(b, decks=[MOLTRES_DECK, b.preset_decks()[0]])
    send_kind(b, t[0], "attach_energy", attach_to_active)
    assert candidate_of(b.seat(t[0], "candidates")["response"], "use_attack") is None  # 炎 1 個ではワザを宣言できない
    send_kind(b, t[0], "end_turn", lambda s: [], check=False)
    send_kind(b, t[1], "end_turn", lambda s: [], check=False)
    send_kind(b, t[0], "attach_energy", attach_to_active)

    _, handle, inputs = attack_inputs(b, t[0])
    names = [o["name_ja"] for o in inputs["stages"][0]["options"]]
    assert names == ["ドライアップ"]  # ほのおのつばさ（炎 3・無色 1）はエネルギーが足りないので出さない
    dry = inputs["stages"][0]["options"][0]
    assert dry["damage"] is None and dry["cost"] == ["fire", "fire"] and "コイン" in dry["text_ja"]
    # 宣言の入力に対象・コインはない（対象は受理のあとの決定。コインはエンジンが投げる）
    assert inputs["stages"][1]["options"] == [] and len(inputs["stages"]) == 2
    latest = {who: b.updates(t[who])["latest"] for who in (1, "spectator")}
    result = b.seat(t[0], "submit", **handle, choices=[dry["id"]], operation_id="dry")
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "awaiting_decision", [{"kind": "answer_decision", "player": 0}])
    for who in (1, "spectator"):
        assert b.updates(t[who], latest[who])["updates"]
    # 本人の回答待ち・相手は待つ
    assert b.seat(t[1], "candidates")["response"]["situation"] == "waiting_for_player"
    response = b.seat(t[0], "candidates")["response"]
    answer = candidate_of(response, "answer_decision")
    stages = b.seat(t[0], "inputs", game=response["game"], revision=response["revision"], candidate=answer["id"])["response"]["stages"]
    assert stages[0]["decision_kind"] == "select_pokemon" and stages[0]["meaning"] == "pokemon"
    assert card_ids(stages) <= card_ids(b.seat(t[0], "view"))
    _, result = send_kind(b, t[0], "answer_decision", lambda s: [s[0]["options"][0]["id"]])
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "halted")
    assert result["result"]["halt"]["category"] == "unresolved_ruling"
    for who in (0, 1, "spectator"):
        view = b.seat(t[who], "view")
        assert view["status"]["status"] == "halted" and view["status"]["halt"]["diagnostic_id"] == "UNRESOLVED_DRY_UP_WATER_ENERGY_SHORT"
    for who in (0, 1):
        assert b.seat(t[who], "candidates")["response"]["candidates"] == []
