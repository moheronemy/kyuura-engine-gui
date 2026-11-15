"""P6（本人のうらのバトル場のポケモンのにげる。エンジン 0.174.0）の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンのテストの
``tests/test_legal_actions_p6_face_down_retreat_v0_174.py`` の ``face_down_active(real)``（``tests/test_secret_plan_v0_67.py`` の ``board``・``place``・
``to_active``・``opponent_turn`` と ``tests/helpers.py`` の ``build_test_state``）の、この盤面に要る部分だけを写した。

- 初期の盤面（プレイヤー 0 の番 3 の MAIN）だけを、導入したエンジンの状態の型で組み立てる（``build_test_state`` のうち、進化・特殊状態・効果・マーカーのない部分）
- そこから先は公開のコマンド（``apply_command``）だけで進める: マチスの秘策で ``real`` をうらにしてベンチに出す → にげるでうらのカードをバトル場へ →
  番を 2 回終える → 闘エネルギーをうらのバトル場のポケモンにつける
- 出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で 1 回確かめた（docs/engine-contract.md 14 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/p6_server.py``）は、固定例の表（``scenarios.SCENARIOS``・``scenarios.build``）に、このモジュールの名前の決まった 3 つの盤面を
プロセスの中で加える（monkeypatch）。
"""

from __future__ import annotations

import random

from kyuura_engine import AttachEnergy, EndTurn, PlayTrainer, ResolveDecision, Retreat, load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import apply_command, check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

# カード（エンジンの tests/helpers.py の定数と同じ値）
HITMONCHAN = "PMCG1-058"  # エビワラー（たね・闘・にげる 2）
RATTATA = "PMCG1-060"  # コラッタ（たね・無色・にげる 0）
ONIX = "PMCG1-054"  # イワーク（たね・闘・にげる 3）
KADABRA = "PMCG1-046"  # ユンゲラー（1 進化・超・にげる 3）
FIRE = "PMCG1-098"
FIGHTING = "PMCG1-102"
SECRET_PLAN = "PMCG5-093"  # マチスの秘策

# 盤面の名前 → うらにする本当のカード。名前は結果を予告しない（GUI・テストの表示は応答と観測から）
BOARDS = {
    "p6_face_down_retreat_a": RATTATA,  # エンジンのテストでは受理（たね・にげる 0）
    "p6_face_down_retreat_b": ONIX,  # エンジンのテストではエネルギー不足で拒否（たね・にげる 3・闘エネルギー 1 枚）
    "p6_face_down_retreat_c": KADABRA,  # エンジンのテストではおもてにしてトラッシュ（たねでない）→ バトル場に出す決定
}

SOURCE = {
    "engine_commit": "f7bf450580bf0d02573b4d032271be6b8e12d699",
    "engine_version": "0.174.0",
    "files": {
        "tests/test_legal_actions_p6_face_down_retreat_v0_174.py": "face_down_active(real)・SameAsDirectTest（TWINS = RATTATA・ONIX・KADABRA）",
        "tests/test_secret_plan_v0_67.py": "board・place・to_active・opponent_turn",
        "tests/helpers.py": "build_test_state（進化・特殊状態・効果・マーカーのない部分だけ）",
    },
}


def _initial(real: str | None, *, hand_extra: tuple[str, ...] = (FIGHTING,), bench: tuple[tuple[str, list[str]], ...] = ()) -> GameState:
    """プレイヤー 0 の番 3 の MAIN。0: バトル場は闘エネルギー 2 枚のエビワラー・ベンチは ``bench``・手札はマチスの秘策・``real``・``hand_extra``・山札は炎エネルギー 10 枚。
    1: バトル場は闘エネルギー 1 枚のエビワラー・山札は炎エネルギー 10 枚。サイドは各 6 枚（炎エネルギー）。

    カード・場のポケモンの番号の振り方は ``build_test_state`` と同じ順（バトル場 → ベンチ → 手札 → 山札 → サイド）。P6 は既定（ベンチなし・手札に闘エネルギー）、
    U-R3a（``tests/r3a_boards.py``）はベンチに炎・水エネルギーのコラッタ・手札に追加なし。F-1 のおもての対照（``tests/f1_boards.py``）は ``real`` なし（None）・手札に追加なし
    （手札はマチスの秘策だけ。エンジンのテストの ``test_secret_plan_v0_67.board()``）。"""
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(card_id: str, energy: list[str], owner: int) -> PokemonInPlay:
        result = PokemonInPlay(new_uid(card_id, owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = 0
        result.energy = [new_uid(e, owner) for e in energy]
        result.trainers = []
        result.damage = 0
        result.retreat_failed_turn = None
        return result

    specs = [
        {"active": (HITMONCHAN, [FIGHTING, FIGHTING]), "bench": list(bench), "hand": [SECRET_PLAN, *(() if real is None else (real,)), *hand_extra]},
        {"active": (HITMONCHAN, [FIGHTING]), "bench": [], "hand": []},
    ]
    players = []
    for owner, spec in enumerate(specs):
        p = PlayerState(deck=[])
        p.active = pokemon(*spec["active"], owner)
        p.bench = [pokemon(card_id, list(energy), owner) for card_id, energy in spec["bench"]]
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
        turn_number=3,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )


def _uid(state: GameState, card_id: str, player: int = 0) -> int:
    return next(u for u in state.players[player].hand if state.cards[u].card_id == card_id)


def face_down_active(real: str) -> GameState:
    """エンジンのテストの ``face_down_active(real)`` と同じ手順。プレイヤー 0 の番 5 の MAIN。バトル場はうらの ``real``（闘エネルギー 1 枚）、
    ベンチはエネルギーのないエビワラー。この番にまだにげていない。"""
    state = _initial(real)
    state = apply_command(state, PlayTrainer(0, _uid(state, SECRET_PLAN)))
    state = apply_command(state, ResolveDecision(0, state.decision.id, (_uid(state, real),)))
    placed = next(q for q in state.players[0].in_play() if state.is_face_down(q))
    active = state.players[0].active
    state = apply_command(state, Retreat(0, tuple(active.energy), placed.card))
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, EndTurn(state.current_player))
    state = apply_command(state, AttachEnergy(0, _uid(state, FIGHTING), state.players[0].active.card))
    p = state.players[0]
    if not (state.is_face_down(p.active) and len(p.active.energy) == 1 and len(p.bench) == 1 and state.current_player == 0):
        raise RuntimeError("P6 の構築盤面が想定の形にならない（エンジンの版を確かめる）")
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"P6 の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(face_down_active(BOARDS[board_id]))


LABELS = {
    "p6_face_down_retreat_a": "P6 構築盤面 A（テスト専用・new_game からではない）",
    "p6_face_down_retreat_b": "P6 構築盤面 B（テスト専用・new_game からではない）",
    "p6_face_down_retreat_c": "P6 構築盤面 C（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの P6 のテストの盤面を写したもの。new_game からの到達ではない）。プレイヤー 0 の番の MAIN で、"
               "バトル場はうらのポケモン（闘エネルギー 1 枚）、ベンチにエビワラー。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に 3 つの構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)


def install_boards(scenarios_module, boards, monkeypatch=None) -> None:
    """名前の決まった構築盤面（名前 → (表示名, 説明, 名前から ClientHub を作る関数)）を固定例の表に加える。P6・U-R3a（``tests/r3a_boards.py``）で共用。
    任意の状態は受け取らない（名前の表にない盤面は作れない）。"""
    original = scenarios_module.build
    table = dict(scenarios_module.SCENARIOS)
    for board_id, (label, description, _builder) in boards.items():
        table[board_id] = {"label": label, "file": "", "point": "constructed", "description": description}

    def build_with_boards(scenario_id: str):
        if scenario_id in boards:
            return boards[scenario_id][2](scenario_id), None
        return original(scenario_id)

    if monkeypatch is not None:
        monkeypatch.setattr(scenarios_module, "SCENARIOS", table)
        monkeypatch.setattr(scenarios_module, "build", build_with_boards)
    else:
        scenarios_module.SCENARIOS = table
        scenarios_module.build = build_with_boards
