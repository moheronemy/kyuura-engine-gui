"""UP-5t-C1（エンジン 0.178.0。特殊能力の候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず unverified にする）の構築盤面。
テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンのテストの
``tests/test_legal_actions_up5t_c1_v0_178.py`` の ``opponent_face_down(power, real, **user)``・``opponent_face_up(power)``（``tests/test_secret_plan_v0_67.py`` の
``board``・``place``・``to_active`` と ``tests/helpers.py`` の ``build_test_state``）の、この盤面に要る部分だけを写した。

- 初期の盤面（プレイヤー 0 の番 5 の MAIN）だけを、導入したエンジンの状態の型で組み立てる（``build_test_state`` のうち、進化（重なり 1 枚）・こんらんのある部分）
- そこから先は公開のコマンド（``apply_command``）だけで進める: マチスの秘策で ``real`` をうらにしてベンチに出す → にげるでうらのカードをバトル場へ → 番を終える
- 使う人はプレイヤー 1（番 6 の MAIN）。プレイヤー 1 のバトル場にわるいクサイハナ（ロケット団のナゾノクサから進化）かスリープ
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で 1 回確かめた（docs/engine-contract.md 18 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/up5t_server.py``）は、固定例の表に、このモジュールの名前の決まった盤面をプロセスの中で加える（``p6_boards.install_boards``）。
"""

from __future__ import annotations

import random

from kyuura_engine import EndTurn, PlayTrainer, ResolveDecision, Retreat, load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CONFUSED, CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, SpecialConditions, freeze_mapping

from .p6_boards import FIGHTING, FIRE, HITMONCHAN, KADABRA, RATTATA, SECRET_PLAN, install_boards

DITTO = "PMCG3-042"  # メタモン（たね。［へんしん］）
DARK_GLOOM, ROCKETS_ODDISH = "PMCG4-006", "PMCG4-003"  # わるいクサイハナ（［くさいかふん］）・ロケット団のナゾノクサ
DROWZEE = "PMCG4-033"  # スリープ（［えんかくさいみん］）
POWERS = {"くさいかふん": {"card": DARK_GLOOM, "evolved_from": ROCKETS_ODDISH}, "えんかくさいみん": {"card": DROWZEE}}
REALS = {"a": RATTATA, "b": KADABRA, "c": DITTO}  # たねポケモン・たねポケモンでない・メタモン（エンジンのテストの REALS と同じ）

# 盤面の名前 → (特殊能力, うらのカードの本当のカード（None ならおもての対照）, 使う人がこんらん)。名前は結果を予告しない
BOARDS = {
    **{f"up5t_kusaikafun_{k}": ("くさいかふん", real, False) for k, real in REALS.items()},
    **{f"up5t_enkakusaimin_{k}": ("えんかくさいみん", real, False) for k, real in REALS.items()},
    "up5t_kusaikafun_face_up": ("くさいかふん", None, False),
    "up5t_enkakusaimin_face_up": ("えんかくさいみん", None, False),
    "up5t_kusaikafun_confused_a": ("くさいかふん", RATTATA, True),
    "up5t_enkakusaimin_confused_a": ("えんかくさいみん", RATTATA, True),
}

SOURCE = {
    "engine_commit": "8f5329d6fb9eeeb783f3d6f57128069ffc0d98a0",
    "engine_version": "0.178.0",
    "files": {
        "tests/test_legal_actions_up5t_c1_v0_178.py": "POWERS・REALS・opponent_face_down(power, real, **user)・opponent_face_up(power)・ControlTest（confusion=True）",
        "tests/test_secret_plan_v0_67.py": "board・place・to_active・face_down",
        "tests/helpers.py": "build_test_state（進化の重なり 1 枚・こんらんの部分だけ）",
    },
}


def _initial(power: str, real: str | None, confused: bool) -> GameState:
    """エンジンのテストの ``board(hand=(real,), opponent={**POWERS[power], **user}, turn_number=5)``（おもての対照は ``board(opponent=POWERS[power], turn_number=5)``）。
    0: バトル場は闘エネルギー 2 枚のエビワラー・手札はマチスの秘策と ``real``。1: バトル場は特殊能力のポケモン（エネルギーなし）・手札なし。山札は炎エネルギー 10 枚、サイドは各 6 枚。
    カード・場のポケモンの番号の振り方は ``build_test_state`` と同じ順（進化の重なり → バトル場 → エネルギー → ベンチ → 手札 → 山札 → サイド）。"""
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
            result.evolved_turn = 4  # build_test_state の既定（プレイヤー 1 の番 5 より前の最後の自分の番）
        result.energy = [new_uid(e, owner) for e in spec.get("energy", [])]
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        if spec.get("confusion"):
            result.conditions = SpecialConditions(poison=None, exclusive=CONFUSED)
        return result

    user = {**POWERS[power], **({"confusion": True} if confused else {})}
    specs = [
        {"active": {"card": HITMONCHAN, "energy": [FIGHTING, FIGHTING]}, "hand": [SECRET_PLAN, *((real,) if real else ())]},
        {"active": user, "hand": []},
    ]
    players = []
    for owner, spec in enumerate(specs):
        p = PlayerState(deck=[])
        p.active = pokemon(spec["active"], owner)
        p.bench = []
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
        turn_number=5,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )


def _uid(state: GameState, card_id: str, player: int = 0) -> int:
    return next(u for u in state.players[player].hand if state.cards[u].card_id == card_id)


def board_state(power: str, real: str | None, confused: bool = False) -> GameState:
    """エンジンのテストと同じ手順。``real`` があれば、プレイヤー 0 がうらにして出し、にげるでバトル場へ入れ替えて番を終える。なければ番を終えるだけ。"""
    state = _initial(power, real, confused)
    if real is not None:
        state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
        state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
        placed = next(q for q in state.players[0].in_play() if state.is_face_down(q))
        active = state.players[0].active
        state = apply_command(state, Retreat(0, tuple(active.energy), placed.card))
    state = apply_command(state, EndTurn(0))
    face_down = state.is_face_down(state.players[0].active)
    if not (state.current_player == 1 and state.decision is None and face_down == (real is not None)):
        raise RuntimeError("UP-5t-C1 の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"UP-5t-C1 の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(*BOARDS[board_id]))


def _label(board_id: str) -> str:
    power, real, confused = BOARDS[board_id]
    where = "相手のバトル場はおもて" if real is None else "相手のバトル場はうら"
    suffix = board_id.rsplit("_", 1)[-1].upper() if real is not None else ""
    return f"UP-5t-C1 構築盤面 ［{power}］・{where}{'・こんらん' if confused else ''}{' ' + suffix if suffix else ''}（テスト専用・new_game からではない）"


LABELS = {board_id: _label(board_id) for board_id in BOARDS}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの UP-5t-C1 のテストの盤面を写したもの。new_game からの到達ではない）。プレイヤー 1 の番の MAIN で、"
               "プレイヤー 1 のバトル場に特殊能力のポケモン、プレイヤー 0 のバトル場はエビワラーかうらのカード。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
