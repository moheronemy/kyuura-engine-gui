"""0.192.0（R-2 のアンノーンの自己持ち主: 本人のうらのバトル場のアンノーンX・A のワザの宣言に、使い手自身の［XXXXX］・［ANGER］を示す）の構築盤面。
テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンのテスト ``tests/test_legal_actions_r2_unown_self_v0_192.py`` が使う
``fd(real, bench=..., opponent=..., opponent_bench=...)``（``tests/test_legal_actions_r2_unown_v0_191.py``）と ``H.with_coin_bits(state, *COINS)``
（XP1 の盤面は ``H.with_coin_bits(state, HD, *COINS)``）を写した。組み立ては 0.191.0 の ``tests/r2u_boards.py`` の ``board`` をそのまま使う（同じ ``fd``）。

- 盤面はどれもスナップショットにできる通常の状態（期限のある効果・この番の使用の記録・ダメージを受けない状態などの注入は使わない）
- コインの結果を決める仕掛けは ``r2_boards._rng_with_coin_bits``（テスト専用）。製品のコード（``kyuura_gui_server``）はこのモジュールを import しない
- 出典の盤面との一致（状態の書き出しと乱数の指紋。コインを決めたあとも）は、エンジンの固定コミット（5808739）の tests で確かめた（docs/engine-contract.md 34 章・証跡）

本当のカード・持ち主・抑止の発生源はどれも登録された実在のカード。
"""

from __future__ import annotations

from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import check_invariants
from kyuura_engine.state import GameState

from .p6_boards import install_boards
from .r2_boards import HEADS, _rng_with_coin_bits
from .r2u_boards import COINS, MUK, ONIX, PICHU, RATTATA, UNOWN_A, UNOWN_X, board

# 盤面の名前 → (うらにする本当のカード, 自分のベンチ（(カード, ダメージ) を左から）, 相手のバトル場, 相手のベンチ, 次のコインの面（None は決めない）)。
# 名前は結果を予告しない
BOARDS = {
    "r2us_x": (UNOWN_X, ((RATTATA, 0),), ONIX, (), COINS),  # エンジンの test_self_powers_same_as_direct（X）
    "r2us_a": (UNOWN_A, ((RATTATA, 0),), ONIX, (), COINS),  # 同（A）
    "r2us_x_ax": (UNOWN_X, ((UNOWN_A, 20), (UNOWN_X, 0)), ONIX, (), COINS),  # test_self_and_other_holders_same_as_direct・test_check_combinations
    "r2us_a_ax": (UNOWN_A, ((UNOWN_A, 20), (UNOWN_X, 0)), ONIX, (), COINS),  # 同（自己 A）
    "r2us_gas": (UNOWN_X, ((MUK, 0),), ONIX, (), None),  # NotOfferedTest.test_suppressed_by_chemical_gas（自分のベンチのかがくへんかガス）
    "r2us_baby": (UNOWN_X, ((RATTATA, 0),), PICHU, (RATTATA,), (HEADS, *COINS)),  # test_existing_stops_are_kept_and_the_answer_can_be_redone（baby）
}

SOURCE = {
    "engine_commit": "58087397890db729f12085b4fbe71a38638b372c",
    "engine_version": "0.192.0",
    "files": {
        "tests/test_legal_actions_r2_unown_self_v0_192.py": "OfferTest.test_self_xxxxx_offered・test_self_anger_offered_with_zero_counters・"
                                                            "test_self_first_then_other_holders_in_field_order・test_check_combinations・"
                                                            "NotOfferedTest.test_suppressed_by_chemical_gas・SubmitTest.test_self_powers_same_as_direct・"
                                                            "test_self_and_other_holders_same_as_direct・test_existing_stops_are_kept_and_the_answer_can_be_redone（baby）",
        "tests/test_legal_actions_r2_unown_v0_191.py": "fd・mon・COINS",
        "tests/test_damage_reactions_poison_sleep_v0_119.py": "mon（MUK）",
        "tests/helpers.py": "with_coin_bits",
    },
}


def board_state(board_id: str) -> GameState:
    real, bench, opponent, opponent_bench, bits = BOARDS[board_id]
    state = board(real, bench, opponent, opponent_bench)
    if bits is not None:
        state = state.clone()
        state.rng = _rng_with_coin_bits(*bits)  # エンジンのテストの with_coin_bits(state, *bits)
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"R-2 アンノーン自己持ち主の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "r2us_x": "R-2 アンノーン自己持ち主 構築盤面 S1（テスト専用・new_game からではない）",
    "r2us_a": "R-2 アンノーン自己持ち主 構築盤面 S2（テスト専用・new_game からではない）",
    "r2us_x_ax": "R-2 アンノーン自己持ち主 構築盤面 S3（テスト専用・new_game からではない）",
    "r2us_a_ax": "R-2 アンノーン自己持ち主 構築盤面 S4（テスト専用・new_game からではない）",
    "r2us_gas": "R-2 アンノーン自己持ち主 構築盤面 対照 G2（テスト専用・new_game からではない）",
    "r2us_baby": "R-2 アンノーン自己持ち主 構築盤面 S5（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.192.0 のテストの盤面を写したもの。new_game からの到達ではない。次のコインの面を決めた盤面がある）。"
               "プレイヤー 0 の番の MAIN で、バトル場はうらのポケモン（超エネルギー 1 枚）、ベンチにおもてのポケモン。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に、この構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
