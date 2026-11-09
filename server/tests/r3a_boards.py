"""U-R3a（本人のうらのカードの、宣言の段が 2〜3 段の特殊能力の入力。エンジン 0.175.0）の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンのテストの
``tests/test_legal_actions_u_r3a_v0_175.py`` の ``placed(real)``（``tests/test_secret_plan_v0_67.py`` の ``board``・``place`` と ``tests/helpers.py`` の
``build_test_state``）の、この盤面に要る部分だけを写した。初期の盤面の組み立ては P6 の構築盤面（``tests/p6_boards.py`` の ``_initial``）と共用する。

- 初期の盤面（プレイヤー 0 の番 3 の MAIN）: 自分のバトル場は闘エネルギー 2 枚のエビワラー、ベンチは炎・水エネルギーのコラッタ、手札はマチスの秘策と ``real``。
  相手のバトル場は闘エネルギー 1 枚のエビワラー（手札なし）
- そこから先は公開のコマンド（``apply_command``）だけで進める: マチスの秘策で ``real`` をうらにしてベンチに出す（エンジンのテストの ``place``）
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で 1 回確かめた（docs/engine-contract.md 15 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/r3a_server.py``）は、固定例の表に、このモジュールの名前の決まった 2 つの盤面をプロセスの中で加える（monkeypatch）。
"""

from __future__ import annotations

from kyuura_engine import PlayTrainer, ResolveDecision
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.state import GameState

from .p6_boards import FIGHTING, FIRE, HITMONCHAN, RATTATA, SECRET_PLAN, _initial, _uid, install_boards

# カード（エンジンの tests/helpers.py の定数と同じ値）
WATER = "PMCG1-099"
ROCKET_CHARMANDER = "PMCG4-012"  # ロケット団のヒトカゲ（たね。［ほのおをもらう］: source → energy の 2 段）
VENUSAUR = "PMCG1-011"  # フシギバナ（2 進化。［エナジートランス］: source → energy → target の 3 段）

# 盤面の名前 → うらにする本当のカード。名前は結果を予告しない（GUI・テストの表示は応答と観測から）。受理・拒否は入力の選び方で決まる（同じ盤面）
BOARDS = {
    "r3a_face_down_power_1": ROCKET_CHARMANDER,  # エンジンのテストでは、コラッタ → 炎エネルギーで受理、エビワラー → 闘エネルギーで WRONG_ENERGY_TYPE の拒否
    "r3a_face_down_power_2": VENUSAUR,  # エンジンのテストでは、3 段を選んで送るとおもてにしてトラッシュ（たねでない）
}

SOURCE = {
    "engine_commit": "81e9e99f76c2a2071fbbc50f852d6c28a026d080",
    "engine_version": "0.175.0",
    "files": {
        "tests/test_legal_actions_u_r3a_v0_175.py": "placed(real)・RATTATA_FW・SameAsDirectTest（RC・VENUSAUR）",
        "tests/test_secret_plan_v0_67.py": "board・place・face_down",
        "tests/helpers.py": "build_test_state（進化・特殊状態・効果・マーカーのない部分だけ）",
    },
}

__all__ = ["BOARDS", "SOURCE", "placed", "build", "install", "FIRE", "WATER", "FIGHTING", "HITMONCHAN", "RATTATA", "ROCKET_CHARMANDER", "VENUSAUR"]


def placed(real: str) -> GameState:
    """エンジンのテストの ``placed(real)`` と同じ手順。プレイヤー 0 の番 3 の MAIN。ベンチは炎・水エネルギーのコラッタと、うらの ``real``（何もついていない）。"""
    state = _initial(real, hand_extra=(), bench=((RATTATA, [FIRE, WATER]),))
    state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
    state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
    face_down = [q for q in state.players[0].in_play() if state.is_face_down(q)]
    if not (len(face_down) == 1 and face_down[0].energy == [] and face_down[0].damage == 0 and state.decision is None and state.current_player == 0):
        raise RuntimeError("U-R3a の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"U-R3a の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(placed(BOARDS[board_id]))


LABELS = {
    "r3a_face_down_power_1": "U-R3a 構築盤面 1（テスト専用・new_game からではない）",
    "r3a_face_down_power_2": "U-R3a 構築盤面 2（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの U-R3a のテストの盤面を写したもの。new_game からの到達ではない）。プレイヤー 0 の番の MAIN で、"
               "バトル場は闘エネルギー 2 枚のエビワラー、ベンチは炎・水エネルギーのコラッタと、うらのポケモン（何もついていない）。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に 2 つの構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
