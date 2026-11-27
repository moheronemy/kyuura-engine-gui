"""0.193.0（C-TF1: 変身で写した、ワザといっしょに宣言する特殊能力を、おもての 2 段目に示さない）と 0.194.0（C-TF2: ワザの宣言でおもてにした使い手の姿の固定）の
構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの固定コミット（f747dc9）のテストの盤面を写した:

- C-TF1（``tests/test_r2_transform_copied_power_v0_193.py`` の ``up(active, opponent=..., bench=...)``。``build_test_state`` で番 9・プレイヤー 0 の番の MAIN）
  - ``tf1_copy_x``: おもてのメタモン（超 1 枚）・相手のバトル場のアンノーンX・自分のベンチのアンノーンA（``InputApiTest.test_other_real_holder_is_offered_with_its_number``。
    コインは ``with_coin_bits(state, *COINS_X)``）
  - ``tf1_copy_lanturn``: おもてのメタモン（水 3 枚）・相手のバトル場のランターン（``InputApiTest.test_copied_powers_are_not_offered`` と
    ``CopiedAttackPowerTest.test_without_the_power_the_copied_attack_is_unchanged``。コインは (TL,)）
  - 本来の持ち主の対照: ``tf1_orig_x``（アンノーンX・ベンチのアンノーンA・相手はイワーク。``test_original_holders_are_unchanged``・``test_original_unown_is_unchanged``）、
    ``tf1_orig_lanturn``（ランターン（雷 2・水 1）・相手はイワーク。``test_original_lanturn_is_unchanged``。コインは (TL,)）
- C-TF2（``tests/test_r2_transform_frozen_reveal_v0_194.py`` の ``VulpixSwitchTest`` の盤面 ``own_bench_ditto``。``tests/test_r2_transform_preconditions_v0_192.py`` の ``up``・``fd``）
  - ``tf2_vulpix_up``: おもてのメタモン（水 2 枚）・自分のベンチのメタモン・相手のバトル場のロコン（炎 1 枚）・相手のベンチのフシギダネ・ゼニガメ（番 9）
  - ``tf2_vulpix_fd``: 同じ組で、メタモンをマチスの秘策でうらにしてバトル場へ（番 7 から。水を 1 番に 1 枚ずつ）

組み立ては ``build_test_state`` のうち、この盤面に要る部分（バトル場 → ベンチ → 手札 → 山札 → サイドの番号。ポケモンの中は 下のカード → そのカード → エネルギー）
だけを写した ``_initial`` と、うらの盤面は公開のコマンド（``apply_command``）だけで進める。コインの結果を決める仕掛けは ``r2_boards._rng_with_coin_bits``（テスト専用）。
出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で確かめた（docs/engine-contract.md 35 章・証跡）。製品のコード（``kyuura_gui_server``）は
このモジュールを import しない。盤面はどれもスナップショットにできる通常の状態（注入・人工の差しかえは使わない）。
"""

from __future__ import annotations

import random

from kyuura_engine import AttachEnergy, EndTurn, PlayTrainer, ResolveDecision, Retreat
from kyuura_engine.cards import load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

from .p6_boards import FIGHTING, FIRE, HITMONCHAN, SECRET_PLAN, _uid, install_boards
from .r2_boards import TAILS, _rng_with_coin_bits
from .r2u_boards import COINS, ONIX, PSYCHIC, UNOWN_A, UNOWN_X

# カード（エンジンの tests/helpers.py・test_r2_transform_*.py の定数と同じ値）
DITTO = "PMCG3-042"  # メタモン（［へんしん］。ワザなし）
LANTURN, CHINCHOU = "neo1-040", "neo1-037"  # ランターン（［すいりょくはつでん］）とその下のチョンチー
VULPIX = "ES3-009"  # ロコン（きつねび: のぞむなら相手のベンチと入れ替えてからダメージ）
BULBASAUR, SQUIRTLE = "PMCG1-001", "PMCG1-023"
WATER, LIGHTNING = "PMCG1-099", "PMCG1-100"


def _mon(card, energy=(), below=()):
    return (card, tuple(energy), tuple(below))


def _lanturn(energy=(LIGHTNING, LIGHTNING)):
    return _mon(LANTURN, energy, (CHINCHOU,))


# 盤面の名前 → (組み立て, プレイヤー 0 のバトル場, 自分のベンチ, 相手のバトル場, 相手のベンチ, 次のコインの面（None は決めない）)。名前は結果を予告しない
BOARDS = {
    "tf1_copy_x": ("up", _mon(DITTO, (PSYCHIC,)), (_mon(UNOWN_A),), _mon(UNOWN_X, (PSYCHIC,)), (), COINS),
    "tf1_copy_lanturn": ("up", _mon(DITTO, (WATER, WATER, WATER)), (), _lanturn(), (), (TAILS,)),
    "tf1_orig_x": ("up", _mon(UNOWN_X, (PSYCHIC,)), (_mon(UNOWN_A),), _mon(ONIX), (), COINS),
    "tf1_orig_lanturn": ("up", _lanturn((LIGHTNING, LIGHTNING, WATER)), (), _mon(ONIX), (), (TAILS,)),
    "tf2_vulpix_up": ("up", _mon(DITTO, (WATER, WATER)), (_mon(DITTO),), _mon(VULPIX, (FIRE,)), (_mon(BULBASAUR), _mon(SQUIRTLE)), None),
    "tf2_vulpix_fd": ("fd", _mon(DITTO, (WATER, WATER)), (_mon(DITTO),), _mon(VULPIX, (FIRE,)), (_mon(BULBASAUR), _mon(SQUIRTLE)), None),
}

SOURCE = {
    "engine_commit": "f747dc971126145d1e61c4e6b14d8229c6a37e13",
    "engine_version": "0.194.0",
    "files": {
        "tests/test_r2_transform_copied_power_v0_193.py": "up・mon・lanturn・COINS_X・InputApiTest.test_copied_powers_are_not_offered・"
                                                          "test_other_real_holder_is_offered_with_its_number・test_original_holders_are_unchanged・"
                                                          "CopiedAttackPowerTest.test_without_the_power_the_copied_attack_is_unchanged・test_original_lanturn_is_unchanged・"
                                                          "CopiedGroupPowerTest.test_other_real_holder_still_usable（face_up）・test_original_unown_is_unchanged",
        "tests/test_r2_transform_frozen_reveal_v0_194.py": "OPP_V・V_BENCH・OTHER_DITTO・VulpixSwitchTest（own_bench_ditto）・ApiTest",
        "tests/test_r2_transform_preconditions_v0_192.py": "fd・up・mon",
        "tests/test_secret_plan_v0_67.py": "board・place・to_active・opponent_turn",
        "tests/helpers.py": "build_test_state（進化した番の既定を含む。特殊状態・効果・マーカーのない部分だけ）・with_coin_bits",
    },
}


def _evolved_turn(depth: int, owner: int, turn: int) -> int:
    """``build_test_state`` の進化した番の既定（今の番より前の、持ち主の番の最後。2 進化はその 2 つ目から）。"""
    owned = [t for t in range(3, turn + 1) if t % 2 == (1 if owner == 0 else 0)][depth - 1:]
    earlier = [t for t in owned if t < turn]
    return earlier[-1] if earlier else owned[-1]


def _initial(specs, turn: int) -> GameState:
    """``build_test_state(specs, turn_number=turn, current_player=0)`` と同じ初期の盤面（specs は (バトル場, ベンチ, 手札) をプレイヤーごとに）。"""
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(spec, owner: int) -> PokemonInPlay:
        card_id, energy, below = spec
        stack = tuple(new_uid(c, owner) for c in below)
        result = PokemonInPlay(new_uid(card_id, owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = 0
        if stack:
            result.evolution_stack = stack
            result.evolved_turn = _evolved_turn(len(stack), owner, turn)
        result.energy = [new_uid(e, owner) for e in energy]
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        return result

    players = []
    for owner, (active, bench, hand) in enumerate(specs):
        p = PlayerState(deck=[])
        p.active = pokemon(active, owner)
        p.bench = [pokemon(b, owner) for b in bench]
        p.hand = [new_uid(c, owner) for c in hand]
        p.deck = [new_uid(c, owner) for c in [FIRE] * 10]
        p.prizes = [new_uid(c, owner) for c in [FIRE] * 6]
        p.discard = []
        p.placed_starting_pokemon = True
        players.append(p)
    used = {c.card_id for c in cards.values()}
    return GameState(
        rules=RULES_2000_02_14,
        card_data=DataSource(pool.source["repository"], pool.source["commit"], pool.source["path"]),
        seed=0,
        rng=random.Random(0),
        cards=freeze_mapping(cards),
        definitions=freeze_mapping({c: pool.get(c) for c in used}),
        decklists=((), ()),
        players=players,
        phase=Phase.MAIN,
        turn_number=turn,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )


def up(active, bench, opponent, opponent_bench) -> GameState:
    """エンジンのテストの ``up``（おもてのバトル場。番 9・手札なし）。"""
    return _initial([(active, bench, ()), (opponent, opponent_bench, ())], 9)


def fd(active, bench, opponent, opponent_bench) -> GameState:
    """エンジンのテストの ``fd(real, energies, bench=..., opponent=..., opponent_bench=...)``（``S.board(hand=(real, *energies), ..., turn_number=7)``）と同じ手順。
    マチスの秘策で ``real`` をうらにしてベンチに出す → にげるでバトル場へ → 番を 2 回終える → エネルギーを 1 番に 1 枚ずつ（2 枚目からは番を 2 回終えてから）。"""
    real, energies, below = active
    assert not below
    state = _initial([((HITMONCHAN, (FIGHTING, FIGHTING), ()), bench, (SECRET_PLAN, real, *energies)), (opponent, opponent_bench, ())], 7)
    state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
    state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
    placed = next(q for q in state.players[0].in_play() if state.is_face_down(q))
    state = apply_command(state, Retreat(0, tuple(state.players[0].active.energy), placed.card))
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, EndTurn(state.current_player))
    for i, energy in enumerate(energies):
        if i:
            state = apply_command(state, EndTurn(state.current_player))
            state = apply_command(state, EndTurn(state.current_player))
        state = apply_command(state, AttachEnergy(0, _uid(state, energy), state.players[0].active.card))
    if not (state.is_face_down(state.players[0].active) and state.current_player == 0 and state.decision is None):
        raise RuntimeError("C-TF2 のうらの構築盤面が想定の形にならない（エンジンの版を確かめる）")
    return state


def board_state(board_id: str) -> GameState:
    maker, active, bench, opponent, opponent_bench, bits = BOARDS[board_id]
    state = (up if maker == "up" else fd)(active, bench, opponent, opponent_bench)
    if bits is not None:
        state = state.clone()
        state.rng = _rng_with_coin_bits(*bits)  # エンジンのテストの with_coin_bits(state, *bits)
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"C-TF の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "tf1_copy_x": "変身 C-TF1 構築盤面 T1（テスト専用・new_game からではない）",
    "tf1_copy_lanturn": "変身 C-TF1 構築盤面 T2（テスト専用・new_game からではない）",
    "tf1_orig_x": "変身 C-TF1 構築盤面 対照 O1（テスト専用・new_game からではない）",
    "tf1_orig_lanturn": "変身 C-TF1 構築盤面 対照 O2（テスト専用・new_game からではない）",
    "tf2_vulpix_up": "変身 C-TF2 構築盤面 V1（テスト専用・new_game からではない）",
    "tf2_vulpix_fd": "変身 C-TF2 構築盤面 V2（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.194.0 のテストの盤面を写したもの。new_game からの到達ではない。次のコインの面を決めた盤面がある）。"
               "プレイヤー 0 の番の MAIN。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に、この構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
