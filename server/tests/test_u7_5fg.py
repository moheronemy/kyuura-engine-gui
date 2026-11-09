"""U7-5f・g（v0.172）の公開 API を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。

固定例（server/kyuura_gui_server/scenarios.py。tools/build_u7_5fg_scenarios.py）から始め、選び方は e2e（web/e2e/u75fg.spec.ts）と同じ。
入力はエンジンが返した選べるものの id だけで作る（カード名・カード ID から組を作らない）。

- カツラ（new_game）: カツラの前の attach_energy は 2 段のまま → カツラ → 任意の 3 段目 energy2（path_stages [1, 2]・options_by_path）。
  鍵は 1・2 段目の選ぶものを / でつないだもの、同じカードの 2 回の指定・知らない番号・4 つ以上・別の組の 3 段目は断る（他者に更新なし）→ 2 枚で受理 →
  観測で 2 枚 → 同じ番には attach_energy の候補が出ない。1 枚だけの入力も今までの形で受理（別の対戦）
- フラッシュ（再生した固定例）: 後攻の並べ替えの決定の回答者の coverage が R-4 で partial → 答えて番を終える → 先攻の MAIN に check_face_up_deck の
  表示だけの候補（owner・position だけ。送れば CANDIDATE_NOT_EXECUTABLE）→ 番でない後攻は候補なし・R-4 で partial（「操作なし」と断定しない）
- うらのカードの特殊能力（new_game）: マチスの秘策でマンキーをうらに出す → 本人の候補に face_down の［スパイ］（入力なし・unverified）、相手・観戦者には
  出ない → 受理（おもてにしてから決定）。ロケット団のヒトカゲをうらにしたときは入力を返さない（R-3・actor。check は断る）。
  0.175.0（U-R3a）から 2 段の型も組が完成すれば入力を返すが、この固定例の番 1 は自分の場のどのポケモンにもカードがついておらず組が完成しないので、
  今までどおり入力を返さない（0.175.0・81e9e99 で確かめた。2〜3 段の入力は tests/test_r3a.py の構築盤面）
"""

from __future__ import annotations

import json

from .conftest import candidate_of, reach_first_turn, send_kind, tokens
from .test_u7_5e import by_card, field, handle_of

BLAINE, FIRE = "PMCG6-093", "PMCG1-098"
SECRET_PLAN, MANKEY, ROCKET_CHARMANDER = "PMCG5-093", "PMCG2-028", "PMCG4-012"


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (1, "spectator")}


def assert_no_updates(b, t, latest):
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == [], w


def attach_inputs(b, token):
    response = b.seat(token, "candidates")["response"]
    cand = candidate_of(response, "attach_energy")
    return response, cand, (b.seat(token, "inputs", **handle_of(response, cand))["response"]["stages"] if cand else None)


def blaine_turn(b):
    t = reach_first_turn(b, scenario="blaine")
    _r, _c, stages = attach_inputs(b, t[0])
    assert [s["role"] for s in stages] == ["energy", "target"]  # カツラの前は今までの 2 段
    assert all("path_stages" not in s for s in stages)
    assert send_kind(b, t[0], "play_trainer", by_card(BLAINE))[1]["outcome"] == "accepted"
    return t


def test_blaine_energy2_by_path(bridge):
    b = bridge
    t = blaine_turn(b)
    response, cand, stages = attach_inputs(b, t[0])
    handle = handle_of(response, cand)
    assert [s["role"] for s in stages] == ["energy", "target", "energy2"]
    first, second, third = stages
    assert (third["count"], third["decline"], third["path_stages"], third["meaning"]) == ({"min": 0, "max": 1}, True, [1, 2], "card")
    assert not {"options_by_choice", "depends_on_stage", "upstream_stages"} & set(third)
    ids1, ids2 = {o["id"] for o in first["options"]}, {o["id"] for o in second["options"]}
    card_of = {o["id"]: o["card"] for o in (*first["options"], *third["options"])}
    for key, refs in third["options_by_path"].items():
        a, c = key.split("/")
        assert a in ids1 and c in ids2 and c in {p["option"] for p in second["options_by_choice"][a]}
        options = [r["option"] for r in refs]
        assert len(options) == len(set(options)) and card_of[a] not in {card_of[o] for o in options}  # 同じカードは選べるものにしない
    key = next(iter(third["options_by_path"]))
    e1, target = key.split("/")
    e2 = third["options_by_path"][key][0]["option"]
    same_card = next(o["id"] for o in third["options"] if o["card"] == card_of[e1])
    other_first = next(i for i in ids1 if card_of[i] == card_of[e2])  # 1 段目を e2 のカードに変えると、古い 3 段目は同じカードの 2 回の指定
    latest = latest_of(b, t)
    for bad in ([e1, target, same_card], [other_first, target, e2], [e1, target, "o999"], [e1, target, e2, e2], [target, e1, e2]):
        answer = b.seat(t[0], "check", **handle, choices=bad)["response"]
        assert (answer["valid"], answer["refusal"]["code"]) == (False, "CANDIDATE_INPUT_INVALID"), bad
    refused = b.seat(t[0], "submit", **handle, choices=[other_first, target, e2], operation_id="stale-third")
    assert (refused["outcome"], refused["refusal"]["code"]) == ("refused", "CANDIDATE_INPUT_INVALID")
    assert_no_updates(b, t, latest)
    assert b.seat(t[0], "check", **handle, choices=[e1, target])["response"] == {"valid": True, "refusal": None}  # 3 段目は任意
    assert b.seat(t[0], "check", **handle, choices=[e1, target, e2])["response"] == {"valid": True, "refusal": None}
    before = {s["pokemon_id"]: len(s["energy"]) for s in field(b, t[1])}
    target_pokemon = next(o["pokemon"] for o in second["options"] if o["id"] == target)
    result = b.seat(t[0], "submit", **handle, choices=[e1, target, e2], operation_id="two")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")
    after = {s["pokemon_id"]: len(s["energy"]) for s in field(b, t[1])}  # 相手の観測から
    assert after[target_pokemon] == before[target_pokemon] + 2
    assert candidate_of(b.seat(t[0], "candidates")["response"], "attach_energy") is None  # 2 枚のあとは候補が出ない（GUI は数えない）


def test_blaine_one_card_keeps_the_old_shape(bridge):
    b = bridge
    t = blaine_turn(b)
    response, cand, stages = attach_inputs(b, t[0])
    key = next(iter(stages[2]["options_by_path"]))
    e1, target = key.split("/")
    target_pokemon = next(o["pokemon"] for o in stages[1]["options"] if o["id"] == target)
    before = {s["pokemon_id"]: len(s["energy"]) for s in field(b, t[1])}
    result = b.seat(t[0], "submit", **handle_of(response, cand), choices=[e1, target], operation_id="one")
    assert result["outcome"] == "accepted"
    assert {s["pokemon_id"]: len(s["energy"]) for s in field(b, t[1])}[target_pokemon] == before[target_pokemon] + 1


def coverage_of(b, token):
    response = b.seat(token, "candidates")["response"]
    return response, response["coverage"]


def test_flash_face_up_display_only_and_r4(bridge):
    b = bridge
    created = b.create(mode="scenario", scenario="flash")
    assert created["ok"]
    t = tokens(created["match"])
    # 決定の回答者（後攻）: 相手の山札のおもてが 2 枚以上なので R-4 で partial（候補は決定だけ）
    response, cov = coverage_of(b, t[1])
    assert [c["kind"] for c in response["candidates"]] == ["answer_decision"]
    assert (cov["completeness"], cov["not_covered_kinds"], cov["residual"]["present"], cov["display_only_kinds"]) == (
        "partial", ["check_face_up_deck"], [{"id": "R-4", "scope": "public"}], [])
    answer = response["candidates"][0]
    stage = b.seat(t[1], "inputs", **handle_of(response, answer))["response"]["stages"][0]
    assert (stage["decision_kind"], stage["count"], stage["order"]) == ("arrange_deck_top", {"min": 5, "max": 5}, "significant")
    assert b.seat(t[1], "submit", **handle_of(response, answer), choices=[o["id"] for o in stage["options"]], operation_id="arrange")["outcome"] == "accepted"
    assert send_kind(b, t[1], "end_turn", lambda s: [])[1]["outcome"] == "accepted"
    # 先攻の MAIN: 表示だけの候補。位置は owner・position だけ（カード ID・uid・名前はない）
    response, cov = coverage_of(b, t[0])
    face_up = candidate_of(response, "check_face_up_deck")
    assert (face_up["processability"], face_up["reasons"], face_up["input_disclosure"]) == ("unresolved_ruling", ["stops_before_acceptance"], "confirmed")
    assert (cov["display_only_kinds"], cov["not_covered_kinds"], cov["completeness"], cov["partial_residual"]) == (["check_face_up_deck"], [], "partial", ["R-2"])
    handle = handle_of(response, face_up)
    stages = b.seat(t[0], "inputs", **handle)["response"]["stages"]
    assert [(s["role"], s["meaning"], s["count"]) for s in stages] == [("face_up_position", "deck_position", {"min": 1, "max": 1})]
    options = stages[0]["options"]
    assert all(set(o) == {"id", "owner", "position", "eligible", "processability", "reasons"} for o in options)
    assert [(o["owner"], o["position"], o["eligible"]) for o in options] == [(1, p, False) for p in range(1, 5)]  # 相手の山札の 2〜5 枚目（0 がいちばん上）
    # エンジンは送る前に断る（GUI はこの候補に check・submit を呼ばない。ここでは接続層がそのまま渡すことだけを確かめる）
    latest = latest_of(b, t)
    assert b.seat(t[0], "check", **handle, choices=[options[0]["id"]])["response"]["refusal"]["code"] == "CANDIDATE_NOT_EXECUTABLE"
    assert b.seat(t[0], "check", **handle, choices=["o99"])["response"]["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    assert_no_updates(b, t, latest)
    # 番でない後攻: 候補はないが、R-4 で partial（「操作なし」と断定しない）
    response, cov = coverage_of(b, t[1])
    assert (response["candidates"], response["situation"], response["empty_reason"]) == ([], "waiting_for_player", "kinds_not_covered")
    assert (cov["completeness"], cov["not_covered_kinds"], cov["residual"]["present"]) == ("partial", ["check_face_up_deck"], [{"id": "R-4", "scope": "public"}])


def secret_plan(b, t, real):
    """マチスの秘策 → うらにするカードを選ぶ決定で real を選ぶ。"""
    assert send_kind(b, t[0], "play_trainer", by_card(SECRET_PLAN))[1]["outcome"] == "accepted"
    assert send_kind(b, t[0], "answer_decision", by_card(real))[1]["outcome"] == "accepted"


def face_down_powers(response):
    return [c for c in response["candidates"] if c["kind"] == "use_power" and c["power"].get("face_down")]


def test_face_down_power_owner_only_then_reveal(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="face_down_power")
    secret_plan(b, t, MANKEY)
    response = b.seat(t[0], "candidates")["response"]
    [power] = face_down_powers(response)
    assert (power["power"]["name_ja"], power["power"]["card_id"], power["power"]["face_down"]) == ("スパイ", MANKEY, True)
    assert (power["pokemon"]["face_down"], "card_id" in power["pokemon"], power["pokemon"]["zone"]) == (True, False, "bench")
    assert (power["processability"], power["reasons"], power["input_disclosure"], power["input_stages"]) == ("unverified", ["face_down_reveal_not_evaluated"], "no_input", [])
    assert {"reason": "face_down_reveal_not_evaluated", "candidates": [power["id"]]} in response["coverage"]["unverified_paths"]
    # 相手・観戦者: 能力の名前・候補・本当のカードは出ない。盤面のうらのカードは裏のまま（カード ID・real がない）
    bench_index = power["pokemon"]["bench_index"]
    for w in (1, "spectator"):
        slot = b.seat(t[w], "view")["observation"]["players"][0]["bench"][bench_index]
        assert slot.get("face_down") is True and "card_id" not in slot and "real" not in slot
    other = b.seat(t[1], "candidates")["response"]
    assert "スパイ" not in json.dumps(other, ensure_ascii=False) and other["coverage"]["residual"]["present"] == [] and other["coverage"]["unverified_paths"] == []
    own_slot = b.seat(t[0], "view")["observation"]["players"][0]["bench"][bench_index]
    assert own_slot.get("face_down") is True and own_slot["real"]["card_id"] == MANKEY  # 本人の観測にだけ本人の知識
    handle = handle_of(response, power)
    assert b.seat(t[0], "inputs", **handle)["response"]["stages"] == []
    latest = latest_of(b, t)
    assert b.seat(t[0], "check", **handle, choices=[])["response"] == {"valid": True, "refusal": None}
    assert_no_updates(b, t, latest)  # 検査は相手・観戦者に更新を作らない
    result = b.seat(t[0], "submit", **handle, choices=[], operation_id="spy")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "awaiting_decision")  # おもてにしてから使い、受理のあとの決定
    slot = b.seat(t[1], "view")["observation"]["players"][0]["bench"][bench_index]
    assert slot.get("card_id") == MANKEY and "face_down" not in slot  # 受理のあと、おもてにしたカードは全員に公開（観測から）
    assert [c["kind"] for c in b.seat(t[0], "candidates")["response"]["candidates"]] == ["answer_decision"]


def test_face_down_power_without_inputs_is_not_sendable(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="face_down_power")
    secret_plan(b, t, ROCKET_CHARMANDER)
    response = b.seat(t[0], "candidates")["response"]
    [power] = face_down_powers(response)
    assert (power["power"]["name_ja"], power["processability"], power["input_disclosure"]) == ("ほのおをもらう", "not_implemented", "unconfirmed")
    cov = response["coverage"]
    assert {"id": "R-3", "scope": "actor", "candidate": power["id"]} in cov["residual"]["present"] and power["id"] in cov["withheld_input_candidates"]
    handle = handle_of(response, power)
    inputs = b.seat(t[0], "inputs", **handle)["response"]
    assert (inputs["stages"], inputs["withheld"]["code"]) == ([], "INPUT_BOUNDARY_UNCONFIRMED")
    assert b.seat(t[0], "check", **handle, choices=[])["response"]["refusal"]["code"] == "CANDIDATE_NOT_EXECUTABLE"
    # 本人向けの残り（actor）は相手の応答に出ない
    other = b.seat(t[1], "candidates")["response"]["coverage"]
    assert other["residual"]["present"] == [] and other["withheld_input_candidates"] == []
