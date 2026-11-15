"""0.183.0（読み取りの要求 log）と 0.182.0（ポケモン交換おじさんの見せる 2 枚の card_id）の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンの v0.183 のテスト
（``tests/test_client_api_visible_log_v0_183.py``）が使う既存の盤面 ``tests/test_pokemon_trader_v0_24.py`` の ``board()`` と
``tests/test_computer_search_v0_22.py`` の ``board()``（どちらも ``tests/helpers.py`` の ``build_test_state``）の、この盤面に要る部分だけを写した。

- ``trader_log``: プレイヤー 0 の番 5 の MAIN。手札はポケモン交換おじさん・ジュゴン・炎エネルギー、山札は水エネルギー・パウワウ・マサキ・フシギダネ・フシギソウ
  （上から）、トラッシュに水エネルギー。1 はバトル場にヒトデマン・ベンチにパウワウ・手札は水エネルギーとポニータ・山札は水エネルギーとパウワウ
- ``computer_search_log``: 同じくプレイヤー 0 の番 5 の MAIN。手札はパソコン通信・炎エネルギー・ポニータ、山札は水エネルギー・パウワウ・マサキ・炎エネルギー
- どちらもログは空（構築盤面。``game_created`` はない）。``baseline_end`` は (0, 0)
- ``trader_log_baseline``: ``trader_log`` から、hub を作る前に公開のコマンド（``apply_command``）だけで交換おじさんを使い終えた状態（ジュゴンをもどし、フシギソウを探した。
  エンジンのテストの ``TraderIdentificationTest`` の選び方と同じ）。2 つの出来事は ``baseline_end`` より前（hub を作った時点の投影）になる。エンジンの v0.183 の
  baseline のテスト（同じ状態から後で作った hub）と同じ考え方で、GUI の注記の確かめに使う
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミット（05290415）の tests で確かめた（docs/engine-contract.md 25 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/trader_server.py``）は、固定例の表に、このモジュールの名前の決まった盤面をプロセスの中で加える（``p6_boards.install_boards``）。
"""

from __future__ import annotations

import random

from kyuura_engine import PlayTrainer, ResolveDecision
from kyuura_engine.cards import load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

POKEMON_TRADER = "PMCG1-093"  # ポケモン交換おじさん
COMPUTER_SEARCH = "PMCG1-090"  # パソコン通信
GROWLITHE, STARYU, SEEL, PONYTA = "PMCG1-018", "PMCG1-025", "PMCG1-029", "PMCG1-016"
DEWGONG, BULBASAUR, IVYSAUR = "PMCG1-030", "PMCG1-001", "PMCG1-008"
BILL, FIRE, WATER = "PMCG1-074", "PMCG1-098", "PMCG1-099"
TURN = 5  # 自分（プレイヤー 0）の番（エンジンのテストの TURN）

SOURCE = {
    "engine_commit": "05290415377738143c5ec2fa7f5cf092e9e0e5ae",
    "engine_version": "0.183.0",
    "files": {
        "tests/test_pokemon_trader_v0_24.py": "board（既定の hand・deck・active・bench・turn_number）・TURN",
        "tests/test_computer_search_v0_22.py": "board（既定の hand・deck・their_deck・active・bench）・TURN",
        "tests/helpers.py": "build_test_state（バトル場・ベンチ・手札・山札・トラッシュ・サイド 6 枚の部分だけ）・POKEMON_TRADER・COMPUTER_SEARCH・GROWLITHE・STARYU・SEEL・PONYTA・"
                            "DEWGONG・BULBASAUR・IVYSAUR・BILL・FIRE・WATER",
        "tests/test_client_api_visible_log_v0_183.py": "trader_hub・TraderIdentificationTest（この盤面を使う確かめ）",
    },
}

# 盤面の名前 → (プレイヤー 0 の指定, プレイヤー 1 の指定)。エンジンのテストの board() の既定値
BOARDS = {
    "trader_log": (
        {"active": GROWLITHE, "bench": [], "hand": [POKEMON_TRADER, DEWGONG, FIRE], "deck": [WATER, SEEL, BILL, BULBASAUR, IVYSAUR], "discard": [WATER]},
        {"active": STARYU, "bench": [SEEL], "hand": [WATER, PONYTA], "deck": [WATER, SEEL]},
    ),
    "computer_search_log": (
        {"active": GROWLITHE, "bench": [], "hand": [COMPUTER_SEARCH, FIRE, PONYTA], "deck": [WATER, SEEL, BILL, FIRE]},
        {"active": STARYU, "bench": [SEEL], "hand": [WATER], "deck": [WATER, WATER]},
    ),
}


def _uid(state: GameState, zone: str, card_id: str) -> int:
    return next(u for u in getattr(state.players[0], zone) if state.cards[u].card_id == card_id)


def board_state(board_id: str) -> GameState:
    if board_id == "trader_log_baseline":
        state = board_state("trader_log")
        state = apply_command(state, PlayTrainer(0, _uid(state, "hand", POKEMON_TRADER)))
        state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, "hand", DEWGONG),)))
        state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, "deck", IVYSAUR),)))
        kinds = [e["kind"] for e in state.log]
        if not ("return_to_deck" in kinds and "reveal_from_deck" in kinds and state.decision is None and state.current_player == 0):
            raise RuntimeError("交換おじさんの baseline の構築盤面が想定の形にならない（エンジンの版を確かめる）")
        return state
    return _base_state(board_id)


def _base_state(board_id: str) -> GameState:
    """エンジンのテストの ``build_test_state(players, turn_number=TURN)`` と同じ番号の振り方（バトル場 → ベンチ → 手札 → 山札 → サイド → トラッシュ）。"""
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(card_id: str, owner: int) -> PokemonInPlay:
        result = PokemonInPlay(new_uid(card_id, owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = 0
        result.energy = []
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        return result

    players = []
    for owner, spec in enumerate(BOARDS[board_id]):
        p = PlayerState(deck=[])
        p.active = pokemon(spec["active"], owner)
        p.bench = [pokemon(b, owner) for b in spec.get("bench", [])]
        p.hand = [new_uid(c, owner) for c in spec.get("hand", [])]
        p.deck = [new_uid(c, owner) for c in spec.get("deck", [FIRE] * 10)]
        p.prizes = [new_uid(c, owner) for c in [FIRE] * 6]
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
        raise RuntimeError(f"交換おじさん・パソコン通信の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "trader_log": "交換おじさん 構築盤面（公開のログ・テスト専用・new_game からではない）",
    "trader_log_baseline": "交換おじさん 構築盤面（使い終えてから接続・テスト専用・new_game からではない）",
    "computer_search_log": "パソコン通信 構築盤面（非公開の検索の対照・テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.183.0 の log のテストが使う、交換おじさん・パソコン通信のテストの盤面を写したもの。new_game からの到達ではない）。"
               "プレイヤー 0 の番の MAIN で、手札にポケモン交換おじさんかパソコン通信。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    from .p6_boards import install_boards

    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in LABELS}, monkeypatch)
