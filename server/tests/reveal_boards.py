"""0.184.0（見せる 17 の呼ぶ箇所の card_id）と 0.185.0（化石の発掘の山札の側・スロットゲームの束の card_ids）の代表の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンの v0.184 の回帰テスト
``tests/test_reveal_identify_v0_184.py`` の代表 3 事例が使う盤面（どれも ``tests/helpers.py`` の ``build_test_state`` で作る）と同じ状態を、
この盤面に要る部分だけの組み立てで作る（バトル場 → ベンチ → 手札 → 山札 → サイド → トラッシュの順の番号）。

- ``reveal_master_ball``（A トレーナー。``test_a_master_ball``・``tests/test_search_recovery_trainers_v0_73.board([MASTER_BALL], deck=[RATTATA] + [FIRE] * 7)``）
- ``reveal_gift``（B 特殊能力［おくりもの］。``test_b_gift_both_players``。使った人と相手の両方が見せる。出来事に ``power``）
- ``reveal_jellyfish``（C ワザの要素「くらげのむれ」。``test_c_named_pokemon_any_and_exactly_one``・``tests/test_deck_search_decision_presence_v0_150.board``。出来事に ``effect``）
- 0.185.0 の ``tests/test_fossil_slot_reveal_v0_185.py`` から:
  - ``reveal_fossil``（化石の発掘。``fossil_board``・``T73.board([FOSSIL_EXCAVATION], deck=[FIRE, MYSTERIOUS_FOSSIL, CLEFAIRY_DOLL], discard=[MYSTERIOUS_FOSSIL, CLEFAIRY_DOLL])``）
  - ``reveal_slot_pair``（スロットゲーム。``test_s1_two_same_named_and_one_returned``・``T80.board([SLOT_GAME], deck=[W, W, G])``。同じ card_id 2 枚と 1 枚）
  - ``reveal_slot_triple``（``test_s2_three_with_the_same_card_id_are_kept_per_position``・``deck=[W, W, W]``。同じ card_id 3 枚）
  - 本人だけが見る束の対照（``PrivateBundleTest.test_master_ball``）は ``reveal_master_ball`` と同じ盤面なので、それを使う
- どれもログは空（``baseline_end`` は (0, 0)）。出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で確かめた
  （0.184.0 の 3 は a9add68 と fa98012、0.185.0 の 3 は fa98012。docs/engine-contract.md 26・27 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口へ任意の状態を渡す機能はない。
"""

from __future__ import annotations

import random

from kyuura_engine.cards import load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

HITMONCHAN, RATTATA, FIRE, WATER, POTION = "PMCG1-058", "PMCG1-060", "PMCG1-098", "PMCG1-099", "PMCG1-071"
MASTER_BALL = "GD6-023"  # マスターボール
TOGEPI, LIGHT_TOGETIC, BERRY = "neo1-066", "neo4-095", "neo1-073"  # トゲピー・ひかるトゲチック（［おくりもの］）・どうぐ
JELLYFISH_ATTACKER, JELLYFISH_TARGET = "GD2-003", "PMCG3-011"  # くらげのむれのワザを持つポケモン・山札から見せるポケモン
GRASS = "PMCG1-097"
FOSSIL_EXCAVATION, MYSTERIOUS_FOSSIL, CLEFAIRY_DOLL = "ES1-035", "PMCG3-046", "PMCG1-091"  # 化石の発掘・なにかの化石・ピッピ人形
SLOT_GAME = "neo1-090"  # スロットゲーム
TURN = 7

SOURCE = {
    "engine_commit": "fa98012f7534fe89667730ffa3e997342bde22a6",
    "engine_version": "0.185.0",
    "files": {
        "tests/test_fossil_slot_reveal_v0_185.py": "fossil_board・SlotGameTest.test_s1・test_s2・PrivateBundleTest.test_master_ball の盤面と選び方",
        "tests/test_neo_trainer_components_v0_80.py": "board・SLOT_GAME・TURN",
        "tests/test_reveal_identify_v0_184.py": "IdentifiedTest.test_a_master_ball・test_b_gift_both_players・test_c_named_pokemon_any_and_exactly_one（くらげのむれ）の盤面と選び方",
        "tests/test_search_recovery_trainers_v0_73.py": "board・TURN",
        "tests/test_light_powers_evolution_v0_84.py": "board・mon（test_shining_gentle_v0_83・test_neo_trainer_components_v0_80 から）",
        "tests/test_deck_search_decision_presence_v0_150.py": "PATHS（くらげのむれ）・board",
        "tests/helpers.py": "build_test_state（バトル場・エネルギー・場に出た番・ベンチ・手札・山札・サイド・トラッシュの部分だけ）・MYSTERIOUS_FOSSIL・CLEFAIRY_DOLL",
    },
}


def _mon(card, energy=(), played=0):
    return {"card": card, "energy": list(energy), "played": played}


# 盤面の名前 → (プレイヤー 0, プレイヤー 1)。山札は先頭が一番上。サイドは各 6 枚
BOARDS = {
    "reveal_master_ball": (
        {"active": _mon(HITMONCHAN), "bench": [_mon(RATTATA)], "hand": [MASTER_BALL], "deck": [RATTATA] + [FIRE] * 7, "prizes": [FIRE] * 6},
        {"active": _mon(HITMONCHAN), "bench": [_mon(RATTATA)], "hand": [], "deck": [FIRE] * 10, "prizes": [FIRE] * 6},
    ),
    "reveal_gift": (
        {"active": _mon(TOGEPI, (WATER,), played=1), "bench": [_mon(RATTATA)], "hand": [LIGHT_TOGETIC], "deck": [WATER, BERRY, WATER], "prizes": [FIRE] * 6},
        {"active": _mon(HITMONCHAN), "bench": [_mon(RATTATA)], "hand": [], "deck": [WATER, BERRY, WATER], "prizes": [FIRE] * 6},
    ),
    "reveal_jellyfish": (
        {"active": _mon(JELLYFISH_ATTACKER, (WATER, WATER)), "bench": [], "hand": [], "deck": [JELLYFISH_TARGET] + [POTION] * 5, "prizes": [POTION] * 6},
        {"active": _mon(RATTATA), "bench": [_mon(RATTATA)], "hand": [], "deck": [WATER] * 10, "prizes": [WATER] * 6},
    ),
    "reveal_fossil": (
        {"active": _mon(HITMONCHAN), "bench": [_mon(RATTATA)], "hand": [FOSSIL_EXCAVATION], "deck": [FIRE, MYSTERIOUS_FOSSIL, CLEFAIRY_DOLL], "prizes": [FIRE] * 6,
         "discard": [MYSTERIOUS_FOSSIL, CLEFAIRY_DOLL]},
        {"active": _mon(HITMONCHAN), "bench": [_mon(RATTATA)], "hand": [], "deck": [FIRE] * 10, "prizes": [FIRE] * 6},
    ),
    "reveal_slot_pair": (
        {"active": _mon(HITMONCHAN, (FIRE,)), "bench": [_mon(RATTATA)], "hand": [SLOT_GAME], "deck": [WATER, WATER, GRASS], "prizes": [FIRE] * 6},
        {"active": _mon(HITMONCHAN, (FIRE,)), "bench": [_mon(RATTATA)], "hand": [POTION, WATER], "deck": [WATER] * 12, "prizes": [FIRE] * 6},
    ),
    "reveal_slot_triple": (
        {"active": _mon(HITMONCHAN, (FIRE,)), "bench": [_mon(RATTATA)], "hand": [SLOT_GAME], "deck": [WATER, WATER, WATER], "prizes": [FIRE] * 6},
        {"active": _mon(HITMONCHAN, (FIRE,)), "bench": [_mon(RATTATA)], "hand": [POTION, WATER], "deck": [WATER] * 12, "prizes": [FIRE] * 6},
    ),
}


def board_state(board_id: str) -> GameState:
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(spec: dict, owner: int) -> PokemonInPlay:
        result = PokemonInPlay(new_uid(spec["card"], owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = spec["played"]
        result.energy = [new_uid(e, owner) for e in spec["energy"]]
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        return result

    players = []
    for owner, spec in enumerate(BOARDS[board_id]):
        p = PlayerState(deck=[])
        p.active = pokemon(spec["active"], owner)
        p.bench = [pokemon(b, owner) for b in spec["bench"]]
        p.hand = [new_uid(c, owner) for c in spec["hand"]]
        p.deck = [new_uid(c, owner) for c in spec["deck"]]
        p.prizes = [new_uid(c, owner) for c in spec["prizes"]]
        p.discard = [new_uid(c, owner) for c in spec.get("discard", [])]
        p.placed_starting_pokemon = True
        players.append(p)
    used = {c.card_id for c in cards.values()}
    state = GameState(
        rules=RULES_2000_02_14,
        card_data=DataSource(pool.source["repository"], pool.source["commit"], pool.source["path"]),
        seed=0,
        rng=random.Random(0),
        cards=freeze_mapping(cards),
        definitions=freeze_mapping({c: pool.get(c) for c in used}),
        decklists=((), ()),
        players=players,
        phase=Phase.MAIN,
        turn_number=TURN,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"見せたカードの代表の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "reveal_master_ball": "見せる 構築盤面 A マスターボール（テスト専用・new_game からではない）",
    "reveal_gift": "見せる 構築盤面 B おくりもの（テスト専用・new_game からではない）",
    "reveal_jellyfish": "見せる 構築盤面 C くらげのむれ（テスト専用・new_game からではない）",
    "reveal_fossil": "見せる 構築盤面 F 化石の発掘（テスト専用・new_game からではない）",
    "reveal_slot_pair": "見せる 構築盤面 S スロットゲーム 同じ ID 2 枚と 1 枚（テスト専用・new_game からではない）",
    "reveal_slot_triple": "見せる 構築盤面 S スロットゲーム 同じ ID 3 枚（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.184.0・0.185.0 の回帰テストの代表の盤面と同じ状態。new_game からの到達ではない）。"
               "プレイヤー 0 の番の MAIN で、山札からカードを見せて手札に加える・山札の上から見せるトレーナー・特殊能力・ワザの要素を使える。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。交換おじさん・パソコン通信の盤面（trader_boards）も一緒に加える。"""
    from . import trader_boards
    from .p6_boards import install_boards

    boards = {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}
    boards.update({board_id: (trader_boards.LABELS[board_id], trader_boards.DESCRIPTION, trader_boards.build) for board_id in trader_boards.LABELS})
    install_boards(scenarios_module, boards, monkeypatch)
