"""PT-5e（山札から引いて試すトレーナー 5 つの型・6 枚の使うための条件を、候補の作成で呼ぶ。エンジン 0.176.0）の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない）。エンジンの tests は導入したパッケージに入っていないので、エンジンのテストの
``tests/test_legal_actions_pt5e_v0_176.py`` の ``table(card, hand=..., opponent_hand=..., flash=False)``（``tests/helpers.py`` の ``build_test_state``）の、
この盤面に要る部分だけを写した。手札の組み合わせは GUI の側で決めた（エンジンのテストの ``ControlTest``・``SameAsDirectTest`` の 1 枚ずつの例を 1 つの手札にまとめた）。

- 盤面はプレイヤー 0 の番 3 の MAIN。どちらもバトル場はエネルギーのないエビワラー・ベンチなし。山札は基本エネルギー 12 枚（並びはプレイヤーで逆）、サイドは 6 枚ずつ
  （0 は草・1 は炎エネルギー）。おもての山札はない（フラッシュを使わない。おもての山札の並びの不変条件が成り立つ）
- 不変条件の崩れた状態は作らない（エンジンの独立の課題。GUI は任意の状態を受け付けない）
- 出典との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests の ``table`` で 1 回確かめた（docs/engine-contract.md 16 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口（``POST /api/local-match``）へ任意の状態を渡す機能はない。
テストと e2e の入口（``tests/pt5e_server.py``）は、固定例の表に、このモジュールの名前の決まった盤面をプロセスの中で加える（``p6_boards.install_boards``）。
"""

from __future__ import annotations

import random

from kyuura_engine import load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

from .p6_boards import FIRE, HITMONCHAN, install_boards

# カード（エンジンの tests の定数と同じ値）
QUIZ1, QUIZ2, QUIZ3, PERSONALITY, CARD_FLIP, SWAP = "GD5-016", "GD5-017", "PMCG6-082", "neo4-105", "neo1-080", "PR1-027"
PORYGON_NO_DEX = "ES1-033"  # ポリゴン（記録に図鑑番号がない）
POTION, BILL = "PMCG1-071", "PMCG1-074"
ENERGIES = ("PMCG1-097", "PMCG1-098", "PMCG1-099", "PMCG1-100", "PMCG1-101", "PMCG1-102")
GRASS = ENERGIES[0]

# 盤面の名前 → (プレイヤー 0 の手札, プレイヤー 1 の手札)。名前は結果を予告しない（GUI・テストの表示は応答と観測から）
BOARDS = {
    # エンジンのテストでは: その2 は条件を通る（ほかの手札がある）。性格判定は手札に進化カードがない（Illegal）。その1 は手札のポケモンが図鑑番号のないポリゴンだけ（未対応）
    "pt5e_trainers_1": ((QUIZ2, PERSONALITY, QUIZ1, PORYGON_NO_DEX), (POTION, BILL)),
    # エンジンのテストでは: その3 はワザを持つポケモンが手札にない（未裁定 QZ1）。とりかえっこプリーズは相手の手札がない（Illegal）。マサキは PT-5e の外（対照）
    "pt5e_trainers_2": ((QUIZ3, SWAP, BILL), ()),
}

SOURCE = {
    "engine_commit": "6f627007a2a7101be066ac6ba035e838a75e36e1",
    "engine_version": "0.176.0",
    "files": {
        "tests/test_legal_actions_pt5e_v0_176.py": "table(card, hand=..., opponent_hand=..., flash=False)・ControlTest・SameAsDirectTest",
        "tests/helpers.py": "build_test_state（進化・特殊状態・効果・マーカーのない部分だけ）",
        "tests/test_quiz_answer_rejection_v0_135.py": "ENERGIES",
    },
}


def table(hand0: tuple[str, ...], hand1: tuple[str, ...]) -> GameState:
    """エンジンのテストの ``table(hand0[0], hand=hand0[1:], opponent_hand=hand1, flash=False)`` と同じ盤面。カード・場のポケモンの番号の振り方は
    ``build_test_state`` と同じ順（バトル場 → ベンチ → 手札 → 山札 → サイド → トラッシュ）。"""
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    specs = [
        {"hand": list(hand0), "deck": list(ENERGIES) * 2, "prizes": [GRASS] * 6},
        {"hand": list(hand1), "deck": list(reversed(ENERGIES)) * 2, "prizes": [FIRE] * 6},
    ]
    players = []
    for owner, spec in enumerate(specs):
        p = PlayerState(deck=[])
        active = PokemonInPlay(new_uid(HITMONCHAN, owner), pokemon_id=owner + 1)
        active.played_turn = 0
        active.energy = []
        active.trainers = []
        active.damage = 0
        active.retreat_failed_turn = None
        p.active = active
        p.bench = []
        p.hand = [new_uid(c, owner) for c in spec["hand"]]
        p.deck = [new_uid(c, owner) for c in spec["deck"]]
        p.prizes = [new_uid(c, owner) for c in spec["prizes"]]
        p.discard = []
        p.placed_starting_pokemon = True
        players.append(p)
    used = {c.card_id for c in cards.values()}
    state = GameState(
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
        next_pokemon_id=3,
        effects=pool.effects,
    )
    problems = check_invariants(state)
    if problems or state.face_up_deck:
        raise RuntimeError(f"PT-5e の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(table(*BOARDS[board_id]))


LABELS = {
    "pt5e_trainers_1": "PT-5e 構築盤面 1（テスト専用・new_game からではない）",
    "pt5e_trainers_2": "PT-5e 構築盤面 2（テスト専用・new_game からではない）",
}
DESCRIPTION = ("テスト専用の構築盤面（エンジンの PT-5e のテストの盤面の形を写したもの。new_game からの到達ではない）。プレイヤー 0 の番の MAIN で、"
               "手札に山札から引いて試すトレーナー。バトル場はエビワラー。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に 2 つの構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
