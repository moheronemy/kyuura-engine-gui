"""0.188.0・0.189.0（R-2 の初回対応: 本人のうらのバトル場のポケモンのワザの宣言に、クチバシティジムのコインを示す。0.189.0 で先読みの複製の元を修正）の構築盤面。
テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンのテスト ``tests/test_preflight_face_down_attacker_v0_189.py`` の ``board(real, stadium=...)``
（エネルギー 4 枚。``tests/test_secret_plan_v0_67.py`` の ``board``・``place``・``to_active``・``opponent_turn`` と ``tests/helpers.py`` の ``build_test_state``）と、
コインの結果を決める ``coins(state, side)``（``tests/helpers.py`` の ``with_coin_bits``・``rng_with_coin_bits``）を写した。

- 初期の盤面は P6 の構築盤面の組み立て（``tests/p6_boards.py`` の ``_initial``。``build_test_state`` と同じ番号の振り方）を共用し、新しい組み立て方は作らない
- そこから先は公開のコマンド（``apply_command``）だけで進める: マチスの秘策で ``real`` をうらにしてベンチに出す → にげるでうらのカードをバトル場へ → 番を 2 回終える →
  雷エネルギーを 4 枚つける（2 枚目からは番を 2 回終えてから） → クチバシティジムを出す（スタジアムなしの対照では出さない）
- コインの結果を決める仕掛け（``_rng_with_coin_bits``）はこのテスト専用のモジュールだけにある。製品のコード（``kyuura_gui_server``）はこのモジュールを import しない
- 出典の盤面との一致（状態の書き出しと乱数の指紋。コインを決めたあとも）は、エンジンの固定コミット（021510c）の tests で確かめた（docs/engine-contract.md 31 章・証跡）

通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。テストと e2e の入口（``tests/reveal_server.py``）は、固定例の表に、名前の決まった盤面を
プロセスの中で加える（monkeypatch）。
"""

from __future__ import annotations

import random

from kyuura_engine import AttachEnergy, EndTurn, PlayTrainer, ResolveDecision, Retreat
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.state import GameState

from .p6_boards import SECRET_PLAN, _initial, _uid, install_boards

# カード（エンジンの tests/helpers.py の定数と同じ値）
LIGHTNING = "PMCG1-100"
VERMILION_CITY_GYM = "PMCG5-076"  # クチバシティジム
MAGNEMITE = "PMCG5-037"  # マチスのコイル（たね・特殊能力なし。でんきショック・たいあたり）
SPEAROW = "PMCG5-057"  # マチスのオニスズメ（たね・特殊能力なし。ふきとばし・かまいたち）
RATICATE = "PMCG5-059"  # マチスのラッタ（1 進化・特殊能力なし）
MAGNETON = "PMCG5-040"  # マチスのレアコイル（1 進化・特殊能力［エナジーチャージ］）
HEADS, TAILS = 1, 0

# 盤面の名前 → (うらにする本当のカード, 場のスタジアム（None は出さない）, 次のコインの面（None は決めない）)。名前は結果を予告しない
BOARDS = {
    "r2_coin_magnemite_heads": (MAGNEMITE, VERMILION_CITY_GYM, HEADS),
    "r2_coin_magnemite_tails": (MAGNEMITE, VERMILION_CITY_GYM, TAILS),
    "r2_coin_spearow": (SPEAROW, VERMILION_CITY_GYM, TAILS),
    "r2_coin_raticate": (RATICATE, VERMILION_CITY_GYM, None),
    "r2_no_stadium": (MAGNEMITE, None, None),
    "r2_powered": (MAGNETON, VERMILION_CITY_GYM, None),
}

SOURCE = {
    "engine_commit": "021510c6f46d51a48553b597f1421172ae5f0e98",
    "engine_version": "0.189.0",
    "files": {
        "tests/test_preflight_face_down_attacker_v0_189.py": "board(real, stadium=..., energies=4)・coins(state, side)・MAGNEMITE・SPEAROW・RATICATE・MAGNETON",
        "tests/test_legal_actions_r2_stadium_coin_v0_188.py": "NotOfferedTest.test_no_stadium・test_real_card_with_a_power（示さない対照）・test_non_basic_target_is_trashed_without_a_coin",
        "tests/test_secret_plan_v0_67.py": "board・place・to_active・opponent_turn",
        "tests/helpers.py": "build_test_state（進化・特殊状態・効果・マーカーのない部分だけ）・with_coin_bits・rng_with_coin_bits・_untemper",
    },
}


def _untemper(y: int) -> int:
    """MT19937 の出力の調律（tempering）の逆（エンジンの tests/helpers.py と同じ）。"""
    y ^= y >> 18
    y ^= (y << 15) & 0xEFC60000
    result = y
    for _ in range(5):
        result = y ^ ((result << 7) & 0x9D2C5680)
    y = result
    result = y
    for _ in range(3):
        result = y ^ (result >> 11)
    return result & 0xFFFFFFFF


def _rng_with_coin_bits(*sides: int) -> random.Random:
    """テスト専用: 次に ``getrandbits(1)`` を len(sides) 回使うとその面（1 = おもて）になる乱数（エンジンの tests/helpers.py の ``rng_with_coin_bits`` と同じ）。"""
    words = list(random.Random(0).getstate()[1][:624])
    for i, side in enumerate(sides):
        words[i] = _untemper((side << 31) | 0x12345)
    rng = random.Random()
    rng.setstate((3, tuple(words) + (0,), None))
    probe = random.Random()
    probe.setstate(rng.getstate())
    if [probe.getrandbits(1) for _ in sides] != list(sides):
        raise AssertionError("乱数の状態の組み立ての誤り")
    return rng


def board(real: str, stadium: str | None = VERMILION_CITY_GYM, energies: int = 4) -> GameState:
    """エンジンのテストの ``board(real, stadium=stadium)`` と同じ手順。プレイヤー 0 の番の MAIN。バトル場はうらの ``real`` に雷エネルギー ``energies`` 枚、
    ベンチはおもてのエビワラー（エネルギーなし）。相手のバトル場は闘エネルギー 1 枚のエビワラー。場のスタジアムは ``stadium``。"""
    state = _initial(real, hand_extra=(*([LIGHTNING] * energies), *(() if stadium is None else (stadium,))))
    state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
    state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
    placed = next(q for q in state.players[0].in_play() if state.is_face_down(q))
    state = apply_command(state, Retreat(0, tuple(state.players[0].active.energy), placed.card))
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, EndTurn(state.current_player))
    for i in range(energies):
        if i:
            state = apply_command(state, EndTurn(state.current_player))
            state = apply_command(state, EndTurn(state.current_player))
        state = apply_command(state, AttachEnergy(0, _uid(state, LIGHTNING), state.players[0].active.card))
    if stadium is not None:
        state = apply_command(state, PlayTrainer(0, _uid(state, stadium)))
    if not (state.is_face_down(state.players[0].active) and state.current_player == 0 and state.decision is None):
        raise RuntimeError("R-2 の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    return state


def board_state(board_id: str) -> GameState:
    real, stadium, side = BOARDS[board_id]
    state = board(real, stadium)
    if side is not None:
        state = state.clone()
        state.rng = _rng_with_coin_bits(*[side] * 8)  # エンジンのテストの coins(state, side)（with_coin_bits と同じく複製に置く）
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"R-2 の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "r2_coin_magnemite_heads": "R-2 構築盤面 A（テスト専用・new_game からではない）",
    "r2_coin_magnemite_tails": "R-2 構築盤面 A2（テスト専用・new_game からではない）",
    "r2_coin_spearow": "R-2 構築盤面 B（テスト専用・new_game からではない）",
    "r2_coin_raticate": "R-2 構築盤面 C（テスト専用・new_game からではない）",
    "r2_no_stadium": "R-2 構築盤面 対照 スタジアムなし（テスト専用・new_game からではない）",
    "r2_powered": "R-2 構築盤面 対照 D（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.189.0 のテストの盤面を写したもの。new_game からの到達ではない。次のコインの面を決めた盤面がある）。"
               "プレイヤー 0 の番の MAIN で、バトル場はうらのポケモン（雷エネルギー 4 枚）、ベンチにエビワラー。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に、この構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
