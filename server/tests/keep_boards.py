"""0.181.0（E12 の修正。答えで指定しておもてにした相手のうらのカードが［KEEP］を持つとき、エネルギー・リムーブ・超エネルギーリムーブを内部の例外でなく
既存の KP1 ``UNRESOLVED_KEEP_PROTECTED_TARGET`` の通常の拒否にする）の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンのテストの
``tests/test_keep_designated_energy_removal_v0_181.py`` の ``opponent_face_down(card_id, trainer=, energies=, active_energies=)``・``face_up_bench(card_id, trainer=, energies=)``
（``tests/test_secret_plan_v0_67.py`` の ``board``・``place``・``opponent_turn`` と ``tests/helpers.py`` の ``build_test_state``）の、この盤面に要る部分だけを写した。

- 初期の盤面は PT-5t-C1 の組み立て（``tests/pt5t_boards.py`` の ``_initial``。エンジンのテストの ``board()`` と同じ番号の振り方）を共用する。新しい組み立て方は作らない
- そこから先は公開のコマンド（``apply_command``）だけで進める: 番を終える → 相手（1）がマチスの秘策で本当のカードをうらにしてベンチに出す →
  闘エネルギーをつけて番を終える（``energies`` 枚。2 枚目は 1 番あとの番）
- うらの本当のカードは、たね（ディグダ）・たねでない（炎エネルギー）・［KEEP］を持つたね（アンノーンK）の 3 つ（エンジンのテストの ``SECRETS``）。秘密だけが違う双子
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミット（a2b29e9）の tests で確かめた（docs/engine-contract.md 23 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/keep_server.py``）は、固定例の表に、このモジュールの名前の決まった盤面をプロセスの中で加える（``p6_boards.install_boards``）。
"""

from __future__ import annotations

from kyuura_engine import AttachEnergy, EndTurn, PlayTrainer, ResolveDecision
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.state import GameState

from .p6_boards import FIGHTING, FIRE, HITMONCHAN, SECRET_PLAN, install_boards
from .pt5t_boards import _initial, _uid

DIGLETT = "PMCG1-052"  # ディグダ（たね）
UNOWN_K = "neo3-030"  # アンノーンK（［KEEP］。たね）
ENERGY_REMOVAL = "PMCG1-070"  # エネルギー・リムーブ
SUPER_ENERGY_REMOVAL = "PMCG1-088"  # 超エネルギーリムーブ
SECRETS = {"a": DIGLETT, "b": FIRE, "c": UNOWN_K}  # エンジンのテストの SECRETS と同じ順

# 盤面の名前 → (形, トレーナー, 本当のカード, 相手のうらのエネルギーの枚数, 相手のバトル場のエネルギーの枚数)。名前は結果を予告しない
BOARDS = {
    **{f"keep_er_{k}": ("opponent_face_down", ENERGY_REMOVAL, real, 1, 1) for k, real in SECRETS.items()},
    "keep_er_face_up": ("face_up_bench", ENERGY_REMOVAL, DIGLETT, 1, 1),
    **{f"keep_ser_{k}": ("opponent_face_down", SUPER_ENERGY_REMOVAL, real, 2, 2) for k, real in SECRETS.items()},
    **{f"keep_ser_only_{k}": ("opponent_face_down", SUPER_ENERGY_REMOVAL, real, 2, 1) for k, real in SECRETS.items()},
}

SOURCE = {
    "engine_commit": "a2b29e9ae8dea35b645a8acf94e36f343e11eee5",
    "engine_version": "0.181.0",
    "files": {
        "tests/test_keep_designated_energy_removal_v0_181.py": "UNOWN_K・SECRETS・opponent_face_down(card_id, trainer, energies, active_energies)・face_up_bench(card_id, trainer, energies)・"
                                                                "SuperEnergyRemovalDesignatedKeepTest.stage2（energies=2・active_energies=2）・"
                                                                "test_face_down_as_the_only_target_is_rejected_at_play_for_every_identity（energies=2）",
        "tests/test_secret_plan_v0_67.py": "board・place・opponent_turn",
        "tests/helpers.py": "build_test_state（ベンチ・エネルギーの部分だけ）・DIGLETT・ENERGY_REMOVAL・SUPER_ENERGY_REMOVAL・FIGHTING・FIRE・HITMONCHAN・LT_SURGES_SECRET_PLAN",
    },
}


def opponent_face_down(card_id: str, trainer: str = ENERGY_REMOVAL, energies: int = 1, active_energies: int = 1) -> GameState:
    """エンジンのテストの ``opponent_face_down``。1 が ``card_id`` をうらでベンチに出し、自分の番ごとに闘エネルギーを 1 枚ずつ ``energies`` 枚つけて、0 の番にした状態。
    1 のバトル場（おもてのエビワラー）には闘エネルギー ``active_energies`` 枚。0 の手札はマチスの秘策と ``trainer``。"""
    state = _initial((trainer,), (SECRET_PLAN, card_id, *(FIGHTING,) * energies), active1={"card": HITMONCHAN, "energy": [FIGHTING] * active_energies},
                     turn_number=3)
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, PlayTrainer(1, _uid(state, SECRET_PLAN, 1)))
    state = apply_command(state, ResolveDecision(1, state.decision.id, (_uid(state, card_id, 1),)))
    placed = next(q for q in state.players[1].in_play() if state.is_face_down(q))
    for n in range(energies):
        state = apply_command(state, AttachEnergy(1, _uid(state, FIGHTING, 1), placed.card))
        state = apply_command(state, EndTurn(state.current_player))
        if n + 1 < energies:
            state = apply_command(state, EndTurn(state.current_player))
    return state


def face_up_bench(card_id: str, trainer: str = ENERGY_REMOVAL, energies: int = 1) -> GameState:
    """エンジンのテストの ``face_up_bench``。1 のベンチに ``card_id`` がおもてで、闘エネルギー ``energies`` 枚つき（0 の番 3 の MAIN）。"""
    return _initial((trainer,), (), bench1=[{"card": card_id, "energy": [FIGHTING] * energies}], turn_number=3)


def board_state(form: str, trainer: str, real: str, energies: int, active_energies: int) -> GameState:
    if form == "opponent_face_down":
        state, face_down = opponent_face_down(real, trainer, energies, active_energies), True
    else:
        state, face_down = face_up_bench(real, trainer, energies), False
    bench = state.players[1].bench
    if not (state.current_player == 0 and state.decision is None and len(bench) == 1 and state.is_face_down(bench[0]) == face_down
            and len(bench[0].energy) == energies):
        raise RuntimeError("KEEP の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"KEEP の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(*BOARDS[board_id]))


def _label(board_id: str) -> str:
    form, trainer, _real, _energies, _active = BOARDS[board_id]
    what = "エネルギー・リムーブ" if trainer == ENERGY_REMOVAL else "超エネルギーリムーブ"
    where = "相手のベンチはうら" if form == "opponent_face_down" else "相手のベンチはおもて"
    return f"KEEP 構築盤面 {board_id.removeprefix('keep_')}・{what}・{where}（テスト専用・new_game からではない）"


LABELS = {board_id: _label(board_id) for board_id in BOARDS}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.181.0 の KEEP のテストの盤面を写したもの。new_game からの到達ではない）。プレイヤー 0 の番の MAIN で、"
               "手札にエネルギー・リムーブか超エネルギーリムーブ。相手のベンチにエネルギーのついたポケモン。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
