"""PT-5t-C1（エンジン 0.179.0。トレーナーの候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず、その選べるものを unverified にする）の構築盤面。
テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンのテストの
``tests/test_legal_actions_pt5t_c1_v0_179.py`` の ``opponent_face_down(trainer, real, bench=, extra_hand=, turn_number=)``・``opponent_face_up(trainer)``・
``own_face_down(real)``・``with_allergy_pollen(trainer, real)``（``tests/test_secret_plan_v0_67.py`` の ``board``・``place``・``to_active`` と
``tests/helpers.py`` の ``build_test_state``）の、この盤面に要る部分だけを写した。

- 初期の盤面（プレイヤー 0 の番の MAIN）だけを、導入したエンジンの状態の型で組み立てる（``build_test_state`` のうち、進化（重なり 1 枚）・ベンチのある部分）
- そこから先は公開のコマンド（``apply_command``）だけで進める: マチスの秘策で ``real`` をうらにしてベンチに出す → にげるでうらのカードをバトル場へ → 番を終える
- 使う人はプレイヤー 1（相手のうらの盤面・おもての対照・［アレルギーかふん］の対照）か、プレイヤー 0（本人のうらのバトル場の対照。イマクニ？）
- 相手のうらの盤面は、使う人の手札にマサキ（PT-5t-C1 の外のトレーナー）も置く（エンジンの関数の ``extra_hand``）。同じ play_trainer の候補に、選べるものごとの
  区分の違うもの（unverified と may_stop_later）が並ぶかを見るため
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で 1 回確かめた（docs/engine-contract.md 19 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/pt5t_server.py``）は、固定例の表に、このモジュールの名前の決まった盤面をプロセスの中で加える（``p6_boards.install_boards``）。
"""

from __future__ import annotations

import random

from kyuura_engine import EndTurn, EvolvePokemon, PlayTrainer, ResolveDecision, Retreat, load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

from .p6_boards import FIGHTING, FIRE, HITMONCHAN, KADABRA, RATTATA, SECRET_PLAN, install_boards

DITTO = "PMCG3-042"  # メタモン
SLEEP_TRAINER = "PMCG4-054"  # ねむれ!ねむれ!（CoinStatusOnOpponentActiveTrainer）
TROPICAL_WIND = "PR1-074"  # トロピカルウインド（CoinHealBothElseSleepBoth）
BILL = "PMCG1-074"  # マサキ（PT-5t-C1 の外のトレーナー）
IMAKUNI = "PR1-013"  # イマクニ？（自分のバトル場をこんらんにする）
DARK_GLOOM, ROCKET_ODDISH, DARK_VILEPLUME = "PMCG4-006", "PMCG4-003", "PMCG4-010"  # わるいクサイハナ・ロケット団のナゾノクサ・わるいラフレシア（［アレルギーかふん］）
GLOOM = {"card": DARK_GLOOM, "evolved_from": ROCKET_ODDISH, "evolved_turn": 4}
TRAINERS = {"sleep": SLEEP_TRAINER, "tropical": TROPICAL_WIND}
REALS = {"a": RATTATA, "b": KADABRA, "c": DITTO}  # たねポケモン・たねポケモンでない・メタモン（エンジンのテストの REALS と同じ）

# 盤面の名前 → (形, トレーナー, うらのカードの本当のカード)。名前は結果を予告しない
BOARDS = {
    **{f"pt5t_{t}_{k}": ("opponent_face_down", trainer, real) for t, trainer in TRAINERS.items() for k, real in REALS.items()},
    **{f"pt5t_{t}_face_up": ("opponent_face_up", trainer, None) for t, trainer in TRAINERS.items()},
    "pt5t_own_face_down_a": ("own_face_down", IMAKUNI, RATTATA),
    "pt5t_sleep_allergy_a": ("allergy", SLEEP_TRAINER, RATTATA),
}

SOURCE = {
    "engine_commit": "4b6e3fea9212c50622dcfea7142dcc76fd14b09d",
    "engine_version": "0.179.0",
    "files": {
        "tests/test_legal_actions_pt5t_c1_v0_179.py": "TRAINERS・REALS・IMAKUNI・GLOOM・opponent_face_down(trainer, real, extra_hand=(BILL,))・opponent_face_up(trainer)・"
                                                      "own_face_down(real)・with_allergy_pollen(trainer, real)",
        "tests/test_secret_plan_v0_67.py": "board・place・to_active・face_down",
        "tests/helpers.py": "build_test_state（進化の重なり 1 枚・ベンチの部分だけ）・SLEEP_TRAINER・BILL・DITTO・DARK_GLOOM・ROCKET_ODDISH・DARK_VILEPLUME",
    },
}


def _initial(hand0, hand1, *, bench1=(), turn_number=5, active1=None) -> GameState:
    """エンジンのテストの ``board(hand=hand0, opponent_hand=hand1, opponent_bench=bench1, turn_number=turn_number)``。
    0: バトル場は闘エネルギー 2 枚のエビワラー・手札はマチスの秘策と ``hand0``。1: バトル場は闘エネルギー 1 枚のエビワラー・ベンチ ``bench1``・手札 ``hand1``。
    山札は炎エネルギー 10 枚、サイドは各 6 枚（炎エネルギー）。番号の振り方は ``build_test_state`` と同じ順（進化の重なり → バトル場 → エネルギー → ベンチ → 手札 → 山札 → サイド）。
    ``active1`` は 1 のバトル場（省略で闘エネルギー 1 枚のエビワラー。エンジンのテストの ``board(opponent=...)``。0.181.0 の KEEP の構築盤面 ``tests/keep_boards.py`` が使う）。"""
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(spec: dict, owner: int) -> PokemonInPlay:
        below = spec.get("evolved_from")
        stack = (new_uid(below, owner),) if below else ()
        result = PokemonInPlay(new_uid(spec["card"], owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = 0
        if stack:
            result.evolution_stack = stack
            result.evolved_turn = spec["evolved_turn"]
        result.energy = [new_uid(e, owner) for e in spec.get("energy", [])]
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        return result

    specs = [
        {"active": {"card": HITMONCHAN, "energy": [FIGHTING, FIGHTING]}, "bench": [], "hand": [SECRET_PLAN, *hand0]},
        {"active": active1 or {"card": HITMONCHAN, "energy": [FIGHTING]}, "bench": list(bench1), "hand": list(hand1)},
    ]
    players = []
    for owner, spec in enumerate(specs):
        p = PlayerState(deck=[])
        p.active = pokemon(spec["active"], owner)
        p.bench = [pokemon(b, owner) for b in spec["bench"]]
        p.hand = [new_uid(c, owner) for c in spec["hand"]]
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
        turn_number=turn_number,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )


def _uid(state: GameState, card_id: str, player: int = 0) -> int:
    return next(u for u in state.players[player].hand if state.cards[u].card_id == card_id)


def _place_and_to_active(state: GameState, real: str) -> GameState:
    """``place(state, real)`` → ``to_active(state, face_down(state)[0])``（マチスの秘策でうらにしてベンチ → にげるでバトル場へ）。"""
    state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
    state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
    placed = next(q for q in state.players[0].in_play() if state.is_face_down(q))
    return apply_command(state, Retreat(0, tuple(state.players[0].active.energy), placed.card))


def opponent_face_down(trainer: str, real: str, *, bench=(), extra_hand=(BILL,), turn_number=5) -> GameState:
    state = _initial((real,), (trainer, *extra_hand), bench1=bench, turn_number=turn_number)
    state = _place_and_to_active(state, real)
    return apply_command(state, EndTurn(0))


def opponent_face_up(trainer: str) -> GameState:
    return apply_command(_initial((), (trainer,)), EndTurn(0))


def own_face_down(real: str) -> GameState:
    return _place_and_to_active(_initial((real, IMAKUNI), ()), real)


def with_allergy_pollen(trainer: str, real: str) -> GameState:
    """使う人（1）が番の中で、ベンチのわるいクサイハナをわるいラフレシアに進化させる（［アレルギーかふん］。だれもトレーナーを使えない。読む前の公開の拒否）。"""
    state = opponent_face_down(trainer, real, bench=[GLOOM], extra_hand=(DARK_VILEPLUME,), turn_number=7)
    return apply_command(state, EvolvePokemon(1, _uid(state, DARK_VILEPLUME, 1), state.players[1].bench[0].pokemon_id))


def board_state(form: str, trainer: str, real: str | None) -> GameState:
    if form == "opponent_face_down":
        state, actor, face_down = opponent_face_down(trainer, real), 1, True
    elif form == "opponent_face_up":
        state, actor, face_down = opponent_face_up(trainer), 1, False
    elif form == "own_face_down":
        state, actor, face_down = own_face_down(real), 0, True
    else:
        state, actor, face_down = with_allergy_pollen(trainer, real), 1, True
    if not (state.current_player == actor and state.decision is None and state.is_face_down(state.players[0].active) == face_down):
        raise RuntimeError("PT-5t-C1 の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"PT-5t-C1 の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(*BOARDS[board_id]))


def _label(board_id: str) -> str:
    form, _trainer, _real = BOARDS[board_id]
    where = {"opponent_face_down": "相手のバトル場はうら", "opponent_face_up": "相手のバトル場はおもて",
             "own_face_down": "自分のバトル場はうら", "allergy": "相手のバトル場はうら・アレルギーかふん"}[form]
    return f"PT-5t-C1 構築盤面 {board_id.removeprefix('pt5t_')}・{where}（テスト専用・new_game からではない）"


LABELS = {board_id: _label(board_id) for board_id in BOARDS}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの PT-5t-C1 のテストの盤面を写したもの。new_game からの到達ではない）。手札のトレーナーを使う番の MAIN で、"
               "相手（または自分）のバトル場はエビワラーかうらのカード。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
