"""0.190.0（R-2 の［めいれい］: 本人のうらのバトル場のポケモンのワザの宣言に、自分の場のおもてのポケモンの［めいれい］を示す）の構築盤面。
テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンのテスト ``tests/test_legal_actions_r2_with_power_v0_190.py`` の ``fd(real, bench=...)``
（``tests/test_secret_plan_v0_67.py`` の ``board``・``place``・``to_active``・``opponent_turn`` と ``tests/helpers.py`` の ``build_test_state``。始まりの番 7）と、
コインの結果を決める ``H.with_coin_bits(state, *bits, *[TL] * 6)`` を写した。

- 初期の盤面は ``build_test_state`` のうち、この盤面に要る部分（進化した持ち主の下のカードの重なりと進化した番。特殊状態・効果・マーカーはない）だけを写した
  ``_initial``（番号の振り方は同じ: バトル場 → ベンチ → 手札 → 山札 → サイド。ポケモンの中は 下のカード → そのカード → エネルギー）。P6 の ``p6_boards._initial`` は
  進化したベンチと始まりの番を持たないため、ここで別に写した
- そこから先は公開のコマンド（``apply_command``）だけで進める: マチスの秘策で ``real`` をうらにしてベンチに出す → にげるでうらのカードをバトル場へ → 番を 2 回終える →
  草エネルギーを 1 枚つける
- コインの結果を決める仕掛けは ``r2_boards._rng_with_coin_bits``（テスト専用）を使う。製品のコード（``kyuura_gui_server``）はこのモジュールを import しない
- 出典の盤面との一致（状態の書き出しと乱数の指紋。コインを決めたあとも）は、エンジンの固定コミット（daf2718）の tests で確かめた（docs/engine-contract.md 32 章・証跡）

ワザは既存の検証の「にどげり」（コイン 2 枚 × 10）を使う。実在しない組み合わせ（コインと［めいれい］の同時の提示など）はこの盤面に含めない（画面テストの人工の応答で別に扱う）。
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
from .r2_boards import HEADS, TAILS, _rng_with_coin_bits

# カード（エンジンの tests/helpers.py・test_damage_reactions_poison_sleep_v0_119.py の定数と同じ値）
GRASS = "PMCG1-097"
TARGET = "PMCG6-004"  # サカキのニドラン♂（たね・特殊能力なし。にどげり（無）10×・いかりのいちげき（草）30）
NOT_NAMED = "PMCG1-005"  # ニドラン♂（たね・特殊能力なし。名前が［めいれい］の対象と違う）
KING = "PR1-068"  # サカキのニドキング（2 進化。［めいれい］: 自分の「サカキのニドラン♂」「サカキのニドリーノ」のワザのダメージ +10）
KING_BELOW = ("PMCG6-004", "PMCG6-013")  # その下のカード（サカキのニドラン♂・サカキのニドリーノ。下から順）
RATTATA = "PMCG1-060"
MUK = "PMCG3-007"  # ベトベトン（1 進化。かがくへんかガス）
MUK_BELOW = ("PMCG4-004",)  # ロケット団のベトベター
BELOW = {KING: KING_BELOW, MUK: MUK_BELOW}
TURN = 7  # エンジンの fd() の始まりの番（2 進化の持ち主を置くため）

# 盤面の名前 → (うらにする本当のカード, 自分のベンチ（左から）, 次のコインの面（None は決めない）)。名前は結果を予告しない
BOARDS = {
    "r2wp_one_hh": (TARGET, (KING,), (HEADS, HEADS)),
    "r2wp_one_ht": (TARGET, (KING,), (HEADS, TAILS)),
    "r2wp_one_tt": (TARGET, (KING,), (TAILS, TAILS)),
    "r2wp_two": (TARGET, (KING, RATTATA, KING), (HEADS, HEADS)),
    "r2wp_gas": (TARGET, (KING, MUK), None),
    "r2wp_not_named": (NOT_NAMED, (KING,), None),
}

SOURCE = {
    "engine_commit": "daf271833de645de5707e5554b7c10f13b51075a",
    "engine_version": "0.190.0",
    "files": {
        "tests/test_legal_actions_r2_with_power_v0_190.py": "fd(real, bench=...)・king()・SubmitTest の with_coin_bits(state, *bits, *[TL] * 6)・"
                                                            "test_two_holders_in_field_order...・test_holder_power_suppressed・test_name_mismatch",
        "tests/test_secret_plan_v0_67.py": "board・place・to_active・opponent_turn",
        "tests/test_damage_reactions_poison_sleep_v0_119.py": "mon・BELOW（NIDOKING・MUK）",
        "tests/helpers.py": "build_test_state（進化した番の既定を含む。特殊状態・効果・マーカーのない部分だけ）・with_coin_bits・rng_with_coin_bits",
    },
}


def _evolved_turn(depth: int, owner: int) -> int:
    """``build_test_state`` の進化した番の既定（今の番より前の、持ち主の番の最後。2 進化はその 2 つ目から）。"""
    owned = [t for t in range(3, TURN + 1) if t % 2 == (1 if owner == 0 else 0)][depth - 1:]
    earlier = [t for t in owned if t < TURN]
    return earlier[-1] if earlier else owned[-1]


def _initial(real: str, bench: tuple[str, ...]) -> GameState:
    """エンジンの ``S.board(hand=(real, GRASS), bench=bench, turn_number=7)``（``fd`` の既定のエネルギー 1 枚・スタジアムなし）と同じ初期の盤面。"""
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(card_id: str, energy: list[str], owner: int) -> PokemonInPlay:
        stack = tuple(new_uid(c, owner) for c in BELOW.get(card_id, ()))
        result = PokemonInPlay(new_uid(card_id, owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = 0
        if stack:
            result.evolution_stack = stack
            result.evolved_turn = _evolved_turn(len(stack), owner)
        result.energy = [new_uid(e, owner) for e in energy]
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        return result

    specs = [
        {"active": (HITMONCHAN, [FIGHTING, FIGHTING]), "bench": list(bench), "hand": [SECRET_PLAN, real, GRASS]},
        {"active": (HITMONCHAN, [FIGHTING]), "bench": [], "hand": []},
    ]
    players = []
    for owner, spec in enumerate(specs):
        p = PlayerState(deck=[])
        p.active = pokemon(*spec["active"], owner)
        p.bench = [pokemon(card_id, [], owner) for card_id in spec["bench"]]
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
        turn_number=TURN,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )


def board(real: str, bench: tuple[str, ...]) -> GameState:
    """エンジンのテストの ``fd(real, bench=...)``（エネルギー 1 枚・スタジアムなし）と同じ手順。プレイヤー 0 の番の MAIN。バトル場はうらの ``real`` に草エネルギー 1 枚、
    ベンチは ``bench``（おもて）。相手のバトル場は闘エネルギー 1 枚のエビワラー。"""
    state = _initial(real, bench)
    state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
    state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
    placed = next(q for q in state.players[0].in_play() if state.is_face_down(q))
    state = apply_command(state, Retreat(0, tuple(state.players[0].active.energy), placed.card))
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, AttachEnergy(0, _uid(state, GRASS), state.players[0].active.card))
    active = state.players[0].active
    if not (state.is_face_down(active) and len(active.energy) == 1 and state.current_player == 0 and state.decision is None):
        raise RuntimeError("R-2［めいれい］の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    return state


def board_state(board_id: str) -> GameState:
    real, bench, bits = BOARDS[board_id]
    state = board(real, bench)
    if bits is not None:
        state = state.clone()
        state.rng = _rng_with_coin_bits(*bits, *[TAILS] * 6)  # エンジンのテストの with_coin_bits(state, *bits, *[TL] * 6)
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"R-2［めいれい］の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


LABELS = {
    "r2wp_one_hh": "R-2［めいれい］構築盤面 W1（テスト専用・new_game からではない）",
    "r2wp_one_ht": "R-2［めいれい］構築盤面 W1b（テスト専用・new_game からではない）",
    "r2wp_one_tt": "R-2［めいれい］構築盤面 W1c（テスト専用・new_game からではない）",
    "r2wp_two": "R-2［めいれい］構築盤面 W2（テスト専用・new_game からではない）",
    "r2wp_gas": "R-2［めいれい］構築盤面 対照 G（テスト専用・new_game からではない）",
    "r2wp_not_named": "R-2［めいれい］構築盤面 対照 N（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.190.0 のテストの盤面を写したもの。new_game からの到達ではない。次のコインの面を決めた盤面がある）。"
               "プレイヤー 0 の番の MAIN で、バトル場はうらのポケモン（草エネルギー 1 枚）、ベンチにおもてのポケモン。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に、この構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
