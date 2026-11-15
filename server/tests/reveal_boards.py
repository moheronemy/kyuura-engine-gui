"""0.184.0（見せる 17 の呼ぶ箇所の card_id）の代表の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンの v0.184 の回帰テスト
``tests/test_reveal_identify_v0_184.py`` の代表 3 事例が使う盤面（どれも ``tests/helpers.py`` の ``build_test_state`` で作る）と同じ状態を、
この盤面に要る部分だけの組み立てで作る（バトル場 → ベンチ → 手札 → 山札 → サイド → トラッシュの順の番号）。

- ``reveal_master_ball``（A トレーナー。``test_a_master_ball``・``tests/test_search_recovery_trainers_v0_73.board([MASTER_BALL], deck=[RATTATA] + [FIRE] * 7)``）
- ``reveal_gift``（B 特殊能力［おくりもの］。``test_b_gift_both_players``。使った人と相手の両方が見せる。出来事に ``power``）
- ``reveal_jellyfish``（C ワザの要素「くらげのむれ」。``test_c_named_pokemon_any_and_exactly_one``・``tests/test_deck_search_decision_presence_v0_150.board``。出来事に ``effect``）
- どれもログは空（``baseline_end`` は (0, 0)）。出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミット（a9add68）の tests で確かめた
  （docs/engine-contract.md 26 章・証跡）

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
TURN = 7

SOURCE = {
    "engine_commit": "a9add68b1e56a574e9bc1672951d48cad2b3b814",
    "engine_version": "0.184.0",
    "files": {
        "tests/test_reveal_identify_v0_184.py": "IdentifiedTest.test_a_master_ball・test_b_gift_both_players・test_c_named_pokemon_any_and_exactly_one（くらげのむれ）の盤面と選び方",
        "tests/test_search_recovery_trainers_v0_73.py": "board・TURN",
        "tests/test_light_powers_evolution_v0_84.py": "board・mon（test_shining_gentle_v0_83・test_neo_trainer_components_v0_80 から）",
        "tests/test_deck_search_decision_presence_v0_150.py": "PATHS（くらげのむれ）・board",
        "tests/helpers.py": "build_test_state（バトル場・エネルギー・場に出た番・ベンチ・手札・山札・サイド・トラッシュの部分だけ）",
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
        p.discard = []
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
        raise RuntimeError(f"0.184.0 の代表の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "reveal_master_ball": "見せる 構築盤面 A マスターボール（テスト専用・new_game からではない）",
    "reveal_gift": "見せる 構築盤面 B おくりもの（テスト専用・new_game からではない）",
    "reveal_jellyfish": "見せる 構築盤面 C くらげのむれ（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.184.0 の回帰テストの代表の盤面と同じ状態。new_game からの到達ではない）。"
               "プレイヤー 0 の番の MAIN で、山札からカードを見せて手札に加えるトレーナー・特殊能力・ワザの要素を使える。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。交換おじさん・パソコン通信の盤面（trader_boards）も一緒に加える。"""
    from . import trader_boards
    from .p6_boards import install_boards

    boards = {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}
    boards.update({board_id: (trader_boards.LABELS[board_id], trader_boards.DESCRIPTION, trader_boards.build) for board_id in trader_boards.LABELS})
    install_boards(scenarios_module, boards, monkeypatch)
