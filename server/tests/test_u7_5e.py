"""U7-5e の特殊能力（use_power）を、接続層が client_api へそのまま渡すこと（実際の固定版のエンジン。模擬の応答を使わない）。

固定例（server/kyuura_gui_server/scenarios.py。tools/build_u7_5e_scenarios.py）から始め、選び方は e2e（web/e2e/u75e.spec.ts）と同じ。
候補は公開の kind と候補の power（エンジンが返した特殊能力の名前）で選び、入力はエンジンが返した選べるものの id だけで作る。

- ロケット団のヒトカゲ（new_game）: 番 1 にベンチ 2 匹・炎エネルギーをバトル場 → 番 3 に炎エネルギーをベンチのコラッタ →［ほのおをもらう］（2 段）。
  上流を混ぜた入力・逆の順・数の違う入力は断る → 受理 → 観測でエネルギーが移る → 同じ番には候補が出ない（ほかの元にエネルギーが残っていても。番ごとに 1 回）
- ダークユンゲラー（new_game）: 番 3 に進化 →［ぶっしつこうかん］（入力なし。choices []）→ 受理（本人の決定）→ 手札のカードを選ぶ → 同じ番には出ない
- エナジートランス（再生した固定例）: 3 段。3 段目の番号は 2 段目の選び方ごとに別。混ぜた入力は断る → 受理 → 観測でエネルギーが移る
"""

from __future__ import annotations

from .conftest import candidate_of, reach_first_turn, send_kind, tokens
from .test_attacks import card_ids


def handle_of(response, cand):
    return {"game": response["game"], "revision": response["revision"], "candidate": cand["id"]}


def power_of(b, token, name_ja=None):
    response = b.seat(token, "candidates")["response"]
    powers = [c for c in response["candidates"] if c["kind"] == "use_power"]
    assert len({c["id"] for c in powers}) == len(powers)  # 同じ種類の候補は id で区別する
    found = [c for c in powers if name_ja is None or c["power"]["name_ja"] == name_ja]
    return response, (found[0] if found else None), powers


def attach(card_id, where):
    """エネルギーをつける: 1 段目の card_id → 2 段目の where（場のポケモンのカード ID か "active"）。"""
    def pick(stages):
        first = next(o["id"] for o in stages[0]["options"] if o["card_id"] == card_id)
        by_id = {o["id"]: o for o in stages[1]["options"]}
        ok = [p["option"] for p in stages[1]["options_by_choice"][first] if p["eligible"]]
        return [first, next(i for i in ok if (by_id[i]["zone"] == "active" if where == "active" else by_id[i].get("card_id") == where))]
    return pick


def by_card(card_id):
    return lambda stages: [next(o["id"] for o in stages[0]["options"] if o.get("card_id") == card_id)]


def end_both(b, t):
    for seat in (0, 1):
        assert send_kind(b, t[seat], "end_turn", lambda s: [])[1]["outcome"] == "accepted"


def field(b, token, player=0):
    p = b.seat(token, "view")["observation"]["players"][player]
    return [p["active"], *p["bench"]]


def test_rocket_charmander_two_stages_mixed_refused_and_once_per_turn(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="rocket_charmander")
    assert t["mulligans"] == 0
    for card in ("PMCG4-012", "PMCG1-060"):
        assert send_kind(b, t[0], "play_basic", by_card(card))[1]["outcome"] == "accepted"
    assert send_kind(b, t[0], "attach_energy", attach("PMCG1-098", "active"))[1]["outcome"] == "accepted"
    end_both(b, t)
    assert send_kind(b, t[0], "attach_energy", attach("PMCG1-098", "PMCG1-060"))[1]["outcome"] == "accepted"

    response, power, powers = power_of(b, t[0], "ほのおをもらう")
    assert power is not None and len(powers) == 1
    assert (power["pokemon"]["card_id"], power["pokemon"]["zone"], power["power"]["card_id"], power["power"]["index"]) == ("PMCG4-012", "bench", "PMCG4-012", 0)
    assert (power["processability"], power["input_disclosure"], len(power["input_stages"])) == ("may_stop_later", "confirmed", 2)
    handle = handle_of(response, power)
    inputs = b.seat(t[0], "inputs", **handle)["response"]
    first, second = inputs["stages"]
    assert [(s["role"], s["meaning"], s["count"]) for s in inputs["stages"]] == [("source", "pokemon", {"min": 1, "max": 1}), ("energy", "card", {"min": 1, "max": 1})]
    assert "upstream_stages" not in first and (second["depends_on_stage"], second["upstream_stages"]) == (1, [1])
    sources = {o["card_id"]: o["id"] for o in first["options"]}
    assert set(sources) == {"PMCG1-016", "PMCG1-060"}  # 炎エネルギーのついているポニータ・コラッタ（ロケット団のヒトカゲ自身はない）
    for option in second["options"]:
        assert option["id"] in {p["option"] for p in second["options_by_choice"][option["after"]]}
    energy_of = {src: second["options_by_choice"][oid][0]["option"] for src, oid in sources.items()}
    assert card_ids(inputs) <= card_ids(b.seat(t[0], "view"))
    # 断る入力（ホストの段。エンジンに渡さない）。相手・観戦者に更新はない
    latest = {w: b.updates(t[w])["latest"] for w in (1, "spectator")}
    for bad in ([sources["PMCG1-016"], energy_of["PMCG1-060"]], [energy_of["PMCG1-016"], sources["PMCG1-016"]], [sources["PMCG1-016"]], []):
        answer = b.seat(t[0], "check", **handle, choices=bad)["response"]
        assert (answer["valid"], answer["refusal"]["code"]) == (False, "CANDIDATE_INPUT_INVALID"), bad
    refused = b.seat(t[0], "submit", **handle, choices=[sources["PMCG1-016"], energy_of["PMCG1-060"]], operation_id="mixed")
    assert (refused["outcome"], refused["refusal"]["code"]) == ("refused", "CANDIDATE_INPUT_INVALID")
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []
    chosen = [sources["PMCG1-016"], energy_of["PMCG1-016"]]
    assert b.seat(t[0], "check", **handle, choices=chosen)["response"] == {"valid": True, "refusal": None}
    result = b.seat(t[0], "submit", **handle, choices=chosen, operation_id="power")
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "in_progress", [{"kind": "turn_action", "player": 0}])
    # 観測から: ポニータのエネルギーがロケット団のヒトカゲへ移った。コラッタにはまだ炎エネルギーがある
    energy = {s["card_id"]: len(s["energy"]) for s in field(b, t[1])}
    assert energy == {"PMCG1-016": 0, "PMCG4-012": 1, "PMCG1-060": 1}
    _r, again, _ = power_of(b, t[0], "ほのおをもらう")
    assert again is None  # 自分の番ごとに 1 回（エンジンが候補に出さない。GUI は数えない）
    # 相手の候補に特殊能力の入力はない（番でない主体）
    assert b.seat(t[1], "candidates")["response"]["situation"] == "waiting_for_player"


def test_dark_kadabra_no_input_then_decision_and_once_per_turn(bridge):
    b = bridge
    t = reach_first_turn(b, scenario="dark_kadabra")
    assert t["mulligans"] == 0
    assert send_kind(b, t[0], "attach_energy", attach("PMCG1-101", "active"))[1]["outcome"] == "accepted"
    end_both(b, t)

    def evolve(stages):
        card = next(o["id"] for o in stages[0]["options"] if o["card_id"] == "PMCG4-034")
        zones = {o["id"]: o["zone"] for o in stages[1]["options"]}
        return [card, next(p["option"] for p in stages[1]["options_by_choice"][card] if p["eligible"] and zones[p["option"]] == "active")]

    assert send_kind(b, t[0], "evolve", evolve)[1]["outcome"] == "accepted"
    response, power, _ = power_of(b, t[0])
    assert (power["power"]["card_id"], power["input_disclosure"], power["input_stages"], power["choices_format"]) == ("PMCG4-034", "no_input", [], "[]")
    handle = handle_of(response, power)
    assert b.seat(t[0], "inputs", **handle)["response"]["stages"] == []
    assert b.seat(t[0], "check", **handle, choices=["o1"])["response"]["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    assert b.seat(t[0], "check", **handle, choices=[])["response"] == {"valid": True, "refusal": None}
    before = b.seat(t[0], "view")["observation"]["players"][0]
    result = b.seat(t[0], "submit", **handle, choices=[], operation_id="power")
    assert (result["outcome"], result["result"]["status"], result["result"]["next"]) == ("accepted", "awaiting_decision", [{"kind": "answer_decision", "player": 0}])
    assert b.seat(t[1], "candidates")["response"]["situation"] == "waiting_for_player"
    # 受理のあとの決定（宣言の前には聞かない）: 手札のカードを 1 枚選ぶ
    turn = b.seat(t[0], "candidates")["response"]
    answer = candidate_of(turn, "answer_decision")
    stage = b.seat(t[0], "inputs", **handle_of(turn, answer))["response"]["stages"][0]
    assert (stage["decision_kind"], stage["count"], stage["decline"]) == ("discard_from_hand", {"min": 1, "max": 1}, False)
    done = b.seat(t[0], "submit", **handle_of(turn, answer), choices=[stage["options"][0]["id"]], operation_id="answer")
    assert done["outcome"] == "accepted"
    after = b.seat(t[0], "view")["observation"]["players"][0]
    assert (len(after["discard"]), after["hand"]["count"]) == (len(before["discard"]) + 1, before["hand"]["count"])  # 1 枚トラッシュして 1 枚引く（観測から）
    assert power_of(b, t[0])[1] is None  # 自分の番ごとに 1 回


def test_energy_trans_three_stages(bridge):
    b = bridge
    created = b.create(mode="scenario", scenario="energy_trans")
    assert created["ok"]
    t = tokens(created["match"])
    response, power, _ = power_of(b, t[0], "エナジートランス")
    assert (power["pokemon"]["card_id"], power["pokemon"]["zone"], len(power["input_stages"])) == ("PMCG1-011", "active", 3)
    handle = handle_of(response, power)
    stages = b.seat(t[0], "inputs", **handle)["response"]["stages"]
    assert [s["role"] for s in stages] == ["source", "energy", "target"]
    assert [(s.get("depends_on_stage"), s.get("upstream_stages")) for s in stages] == [(None, None), (1, [1]), (2, [1, 2])]
    source = stages[0]["options"][0]["id"]
    energies = [p["option"] for p in stages[1]["options_by_choice"][source]]
    assert len(energies) >= 2
    targets = {e: [p["option"] for p in stages[2]["options_by_choice"][e]] for e in energies}
    assert not set(targets[energies[0]]) & set(targets[energies[1]])  # 3 段目の番号は 2 段目の選び方ごとに別
    mixed = [source, energies[0], targets[energies[1]][0]]
    assert b.seat(t[0], "check", **handle, choices=mixed)["response"]["refusal"]["code"] == "CANDIDATE_INPUT_INVALID"
    chosen = [source, energies[0], targets[energies[0]][0]]
    assert b.seat(t[0], "check", **handle, choices=chosen)["response"]["valid"] is True
    target_pokemon = next(o["pokemon"] for o in stages[2]["options"] if o["id"] == chosen[2])
    before = {s["pokemon_id"]: len(s["energy"]) for s in field(b, t[1])}
    result = b.seat(t[0], "submit", **handle, choices=chosen, operation_id="trans")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "in_progress")
    after = {s["pokemon_id"]: len(s["energy"]) for s in field(b, t[1])}
    active = field(b, t[1])[0]["pokemon_id"]
    assert after[active] == before[active] - 1 and after[target_pokemon] == before[target_pokemon] + 1  # 相手の観測でも移った
    assert power_of(b, t[0], "エナジートランス")[1] is not None  # エナジートランスは回数の制限がない（エンジンが続けて候補に出す）
