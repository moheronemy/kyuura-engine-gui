"""0.186.0（プレイ用の規約集合 CS-KYUURA-PLAY-TR3@1。突風・ポケモンいれかえ・きずぐすりの続行規約）の構築盤面。テスト専用（接続層のテストと e2e の起動の入口だけが使う）。

new_game からの到達ではない（seed の探索はしていない。3 条件の場面に対戦の中で到達した実績には数えない）。エンジンの tests は導入したパッケージに入っていないので、
エンジンの v0.186 の回帰テスト ``tests/test_play_convention_tr3_v0_186.py`` の盤面（どれも ``tests/helpers.py`` の ``build_test_state(players, turn_number=5)`` で作り、
``with_set``・``as_tr3`` で規約集合だけを置きかえる）と同じ状態を、この盤面に要る部分だけの組み立てで作る（バトル場 → エネルギー → ベンチ → 手札 → 山札 → サイド → トラッシュの順の番号）。

- ``board(kind, met)``: 自分（プレイヤー 0）の番 5 の MAIN。手札の先頭が対象のカード。``met`` なら未裁定の条件が成り立つ（突風: 相手のベンチが空・ポケモンいれかえ: 自分のベンチが空・
  きずぐすり: 自分の場にダメージのあるポケモンがいない）。偽なら対象がいる隣の場面（きずぐすりはバトル場にダメージ 20）
  - ``tr3_<kind>``（TR3・条件が成り立つ）・``cur_<kind>``（同じ盤面の CS-KYUURA-CURRENT@1。厳密側の未裁定の対照）・``tr3_<kind>_target``（TR3・対象がいる正常な対照）
- ``CandidateTest.mixed``: 手札に突風（相手のベンチが空）・きずぐすり（ダメージなし）・ポケモンいれかえ（自分の控えあり。実行できる）。``tr3_mixed``（TR3）・``cur_mixed``（CURRENT）
- ``CandidateTest.test_all_excluded_candidate``: 手札に突風・きずぐすり、両方のベンチが空。``tr3_all_excluded``（TR3。選べるものがすべて規約による除外）
- どれもログは空（``baseline_end`` は (0, 0)）。出典の盤面との一致（状態の書き出しと乱数の指紋）は、エンジンの固定コミットの tests で確かめた（docs/engine-contract.md 29 章・証跡）

製品のコード（``kyuura_gui_server``）はこのモジュールを import しない。通常の対戦の作成の口へ任意の状態・規約集合の状態を渡す機能はない（新しい対戦の規約集合は
``POST /api/local-match`` の ``conventions`` の決まった値だけ）。
"""

from __future__ import annotations

import random

from kyuura_engine.cards import load_card_pool
from kyuura_engine.client_api import ClientHub
from kyuura_engine.conventions import registered_identity
from kyuura_engine.engine import check_invariants
from kyuura_engine.rules import RULES_2000_02_14
from kyuura_engine.state import CardInstance, DataSource, GameState, Phase, PlayerState, PokemonInPlay, freeze_mapping

GROWLITHE, STARYU, SEEL, PONYTA = "PMCG1-018", "PMCG1-025", "PMCG1-029", "PMCG1-016"
FIRE, WATER = "PMCG1-098", "PMCG1-099"
POTION, GUST, SWITCH = "PMCG1-071", "PMCG1-072", "PMCG1-073"  # きずぐすり・突風・ポケモンいれかえ
TURN = 5
TR3 = ("CS-KYUURA-PLAY-TR3", 1)
CURRENT = ("CS-KYUURA-CURRENT", 1)
CARDS = {"gust": GUST, "switch": SWITCH, "potion": POTION}

SOURCE = {
    "engine_commit": "a1b765918dc8e0f8ff326fa732d2c8220edab8e2",
    "engine_version": "0.186.0",
    "files": {
        "tests/test_play_convention_tr3_v0_186.py": "board(kind, met)・with_set・as_tr3・CASES・CandidateTest.mixed・test_all_excluded_candidate の盤面",
        "tests/helpers.py": "build_test_state（バトル場・エネルギー・ダメージ・ベンチ・手札・山札・サイド 6 枚の部分だけ）・GROWLITHE・STARYU・SEEL・PONYTA・FIRE・WATER・POTION・GUST・SWITCH",
    },
}


def _me(hand, *, bench=True, damage=0):
    return {"active": {"card": GROWLITHE, "energy": [FIRE], "damage": damage}, "bench": [PONYTA] if bench else [], "hand": list(hand), "deck": [FIRE] * 8}


def _them(*, bench=True):
    return {"active": {"card": STARYU}, "bench": [SEEL] if bench else [], "hand": [WATER], "deck": [WATER] * 8}


def _board(kind: str, met: bool):
    """エンジンのテストの ``board(kind, met=met)`` と同じ指定。"""
    me, them = _me([CARDS[kind]]), _them()
    if kind == "gust" and met:
        them["bench"] = []
    if kind == "switch" and met:
        me["bench"] = []
    if kind == "potion" and not met:
        me["active"]["damage"] = 20
    return me, them


# 盤面の名前 → ((プレイヤー 0, プレイヤー 1), 規約集合)
BOARDS = {}
for _kind in CARDS:
    BOARDS[f"tr3_{_kind}"] = (_board(_kind, True), TR3)
    BOARDS[f"cur_{_kind}"] = (_board(_kind, True), CURRENT)
    BOARDS[f"tr3_{_kind}_target"] = (_board(_kind, False), TR3)
BOARDS["tr3_mixed"] = ((_me([GUST, POTION, SWITCH]), _them(bench=False)), TR3)
BOARDS["cur_mixed"] = ((_me([GUST, POTION, SWITCH]), _them(bench=False)), CURRENT)
BOARDS["tr3_all_excluded"] = ((_me([GUST, POTION], bench=False), _them(bench=False)), TR3)


def board_state(board_id: str) -> GameState:
    (spec0, spec1), convention_set = BOARDS[board_id]
    pool = load_card_pool()
    cards: dict[int, CardInstance] = {}
    next_pokemon_id = [1]

    def new_uid(card_id: str, owner: int) -> int:
        uid = len(cards)
        cards[uid] = CardInstance(uid, card_id, owner)
        return uid

    def pokemon(spec: dict, owner: int) -> PokemonInPlay:
        result = PokemonInPlay(new_uid(spec["card"], owner), pokemon_id=next_pokemon_id[0])
        next_pokemon_id[0] += 1
        result.played_turn = 0
        result.energy = [new_uid(e, owner) for e in spec.get("energy", [])]
        result.trainers = []
        result.damage = spec.get("damage", 0)
        result.retreat_failed_turn = None
        return result

    players = []
    for owner, spec in enumerate((spec0, spec1)):
        p = PlayerState(deck=[])
        p.active = pokemon(spec["active"], owner)
        p.bench = [pokemon({"card": b}, owner) for b in spec["bench"]]
        p.hand = [new_uid(c, owner) for c in spec["hand"]]
        p.deck = [new_uid(c, owner) for c in spec["deck"]]
        p.prizes = [new_uid(c, owner) for c in [FIRE] * 6]
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
        turn_number=TURN,
        current_player=0,
        first_player=0,
        energy_attachments_this_turn=0,
        next_pokemon_id=next_pokemon_id[0],
        effects=pool.effects,
    )
    state.conventions = registered_identity(convention_set)  # エンジンのテストの with_set と同じ（規約集合だけを置きかえる）
    problems = check_invariants(state)
    if problems:
        raise RuntimeError(f"TR3 の構築盤面が不変条件を満たさない: {problems}")
    return state


def build(board_id: str) -> ClientHub:
    """名前の決まった盤面だけ（任意の状態は受け取らない）。"""
    return ClientHub.from_state(board_state(board_id))


_KIND_LABELS = {"gust": "突風", "switch": "ポケモンいれかえ", "potion": "きずぐすり"}
_MET = {"gust": "相手のベンチが空", "switch": "自分のベンチが空", "potion": "ダメージのあるポケモンなし"}
LABELS = {}
for _kind, _name in _KIND_LABELS.items():
    LABELS[f"tr3_{_kind}"] = f"TR3 構築盤面 {_name} 対象なし（{_MET[_kind]}・TR3・テスト専用・new_game からではない）"
    LABELS[f"cur_{_kind}"] = f"TR3 構築盤面 {_name} 対象なし CURRENT（{_MET[_kind]}・既定の集合・テスト専用・new_game からではない）"
    LABELS[f"tr3_{_kind}_target"] = f"TR3 構築盤面 {_name} 対象あり（TR3・テスト専用・new_game からではない）"
LABELS["tr3_mixed"] = "TR3 構築盤面 混在 突風・きずぐすり・ポケモンいれかえ（TR3・テスト専用・new_game からではない）"
LABELS["cur_mixed"] = "TR3 構築盤面 混在 突風・きずぐすり・ポケモンいれかえ CURRENT（既定の集合・テスト専用・new_game からではない）"
LABELS["tr3_all_excluded"] = "TR3 構築盤面 全除外 突風・きずぐすり（TR3・テスト専用・new_game からではない）"
DESCRIPTION = ("テスト専用の構築盤面（エンジンの 0.186.0 の回帰テストの盤面と同じ状態。規約集合は盤面ごとに TR3 か既定の CURRENT。new_game からの到達ではない）。"
               "プレイヤー 0 の番の MAIN で、手札の突風・ポケモンいれかえ・きずぐすりの候補を確かめる。")


def install(scenarios_module, monkeypatch=None) -> None:
    """固定例の表に構築盤面を加える（同じプロセスの中だけ。テストは monkeypatch で戻す）。"""
    from .p6_boards import install_boards

    install_boards(scenarios_module, {board_id: (LABELS[board_id], DESCRIPTION, build) for board_id in BOARDS}, monkeypatch)
