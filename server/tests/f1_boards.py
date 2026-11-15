"""F-1（エンジン 0.180.0。本人のうらのバトル場のポケモンのワザの候補だけに、実装に合う保証の文 GUARANTEE_FACE_DOWN_ATTACK を付ける）の構築盤面。
テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンのテスト ``tests/test_legal_actions_f1_v0_180.py`` は、P6 のテストの
``face_down_active(real)``（REALS = コラッタ・イワーク・ユンゲラー・炎エネルギー）と、おもての対照 ``tests/test_secret_plan_v0_67.py`` の ``board()`` を使う。

- うらのコラッタ・イワーク・ユンゲラーは、既存の P6 の構築盤面（``tests/p6_boards.py`` の ``p6_face_down_retreat_a``〜``c``）をそのまま再利用する（同じ盤面を別の名前で作らない）
- 足りない 2 つだけを加える（どちらも P6 の盤面の組み立て ``_initial``・``face_down_active`` を共用し、新しい組み立て方は作らない）
  - ``f1_face_down_energy``: うらの本当のカードが炎エネルギー（印刷のワザがない）。エンジンのテストの ``face_down_active(H.FIRE)``
  - ``f1_face_up``: おもての対照。バトル場は闘エネルギー 2 枚のエビワラー、手札はマチスの秘策だけ。エンジンのテストの ``S.board()``
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミット（27ba35d）の tests で確かめた（docs/engine-contract.md 20 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/f1_server.py``）は、固定例の表に、名前の決まった盤面（P6 の 3 つとこの 2 つ）をプロセスの中で加える（monkeypatch）。
"""

from __future__ import annotations

from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import check_invariants
from kyuura_engine.state import GameState

from . import p6_boards
from .p6_boards import FIRE, _initial, face_down_active, install_boards

# 盤面の名前 → うらにする本当のカード（None はおもての対照）。名前は結果を予告しない（GUI・テストの表示は応答と観測から）
BOARDS = {
    "f1_face_down_energy": FIRE,  # 印刷のワザがない本当のカード（エンジンのテストでは not_implemented・no_printed_attack・入力なし）
    "f1_face_up": None,  # おもてのエビワラー（エンジンのテストでは GUARANTEE_ATTACK・may_stop_later）
}
# 再利用する P6 の盤面（うらのコラッタ・イワーク・ユンゲラー）
FACE_DOWN_BOARDS = {**p6_boards.BOARDS, "f1_face_down_energy": FIRE}

SOURCE = {
    "engine_commit": "27ba35d7d325aabe4a8804c57e095e00fc3b81c6",
    "engine_version": "0.180.0",
    "files": {
        "tests/test_legal_actions_f1_v0_180.py": "REALS（RATTATA・ONIX・KADABRA・FIRE）・CandidateTest（face_down_active・S.board()）",
        "tests/test_legal_actions_p6_face_down_retreat_v0_174.py": "face_down_active(real)",
        "tests/test_secret_plan_v0_67.py": "board()",
    },
}


def face_up() -> GameState:
    """エンジンのテストの ``test_secret_plan_v0_67.board()`` と同じ盤面（プレイヤー 0 の番 3 の MAIN。バトル場は闘エネルギー 2 枚のおもてのエビワラー）。"""
    state = _initial(None, hand_extra=())
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"F-1 のおもての対照の盤面が不変条件を満たさない: {problems}")
    return state


def board_state(board_id: str) -> GameState:
    real = BOARDS[board_id]
    return face_up() if real is None else face_down_active(real)


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "f1_face_down_energy": "F-1 構築盤面 D（テスト専用・new_game からではない）",
    "f1_face_up": "F-1 構築盤面 おもて（テスト専用・new_game からではない）",
}
DESCRIPTIONS = {
    "f1_face_down_energy": p6_boards.DESCRIPTION,
    "f1_face_up": ("テスト専用の構築盤面（エンジンのマチスの秘策のテストの盤面を写したもの。new_game からの到達ではない）。プレイヤー 0 の番の MAIN で、"
                   "バトル場は闘エネルギー 2 枚のエビワラー。"),
}


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に、P6 の 3 つの構築盤面とこの 2 つを加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    boards = {board_id: (p6_boards.LABELS[board_id], p6_boards.DESCRIPTION, p6_boards.build) for board_id in p6_boards.BOARDS}
    boards.update({board_id: (LABELS[board_id], DESCRIPTIONS[board_id], build) for board_id in BOARDS})
    install_boards(scenarios_module, boards, monkeypatch)
