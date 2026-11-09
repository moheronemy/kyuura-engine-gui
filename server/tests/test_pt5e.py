"""PT-5e（エンジン 0.176.0）: 山札から引いて試すトレーナー 5 つの型・6 枚の使うための条件を候補の作成で呼ぶ補完を、接続層が client_api へそのまま渡すこと
（実際の固定版のエンジン。模擬の応答を使わない）。新しい種類・段・処理可能性・理由の語彙はない。

盤面は ``tests/pt5e_boards.py`` の構築盤面（エンジンの PT-5e のテストの ``table`` の形。new_game からの到達ではない）。テストの中だけで固定例の表に加える
（製品のコードと通常の作成の口は変えていない）。操作は HTTP の口（candidates・inputs・check・submit・view・updates）だけで行い、入力はエンジンが返した
選べるものの id だけで作る（手札・カード定義から作らない）。

- 条件を通るカード: ``may_stop_later``（理由 preflight・continuation）で選べる。check は有効。送ると受理（受理のあとの決定に続く。完走の保証ではない）
- ゲーム上使えないカード（Illegal）: 選べるものに出ない（手札にはある）
- 未裁定・未対応のカード: 選べるものに出て ``eligible: false``・実行できない区分（理由 stops_before_acceptance）。check・submit は送る前に断る（CANDIDATE_NOT_EXECUTABLE）。
  状態・相手と観戦者への更新は変わらない
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from kyuura_engine import effects as E
from kyuura_engine import legal_actions as L

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import create_app

from . import pt5e_boards as PB
from .conftest import Bridge, candidate_of, tokens
from .test_u7_5e import handle_of

ONE, TWO = "pt5e_trainers_1", "pt5e_trainers_2"
PASSING = ("may_stop_later", True, ["continuation_not_evaluated", "preflight_not_evaluated"])
STOPS = ["stops_before_acceptance"]


@pytest.fixture()
def b(monkeypatch):
    PB.install(scenarios, monkeypatch)
    return Bridge(TestClient(create_app(), base_url="http://127.0.0.1"))


def start(b, board_id):
    created = b.create(mode="scenario", scenario=board_id)
    assert created["ok"] and created["match"]["origin"]["scenario"] == board_id
    return tokens(created["match"])


def open_trainer(b, token):
    response = b.seat(token, "candidates")["response"]
    cand = candidate_of(response, "play_trainer")
    handle = handle_of(response, cand)
    inputs = b.seat(token, "inputs", **handle)["response"]
    (stage,) = inputs["stages"]
    return cand, handle, {o["card_id"]: o for o in stage["options"]}


def status(option):
    return option["processability"], option["eligible"], sorted(option["reasons"])


def hand_ids(b, token):
    return [c["card_id"] for c in b.seat(token, "view")["observation"]["players"][0]["hand"]["cards"]]


def latest_of(b, t):
    return {w: b.updates(t[w])["latest"] for w in (1, "spectator")}


def test_registration_and_engine_constants():
    """対象の 5 つの型・6 枚を実際の登録で確かめる（名前から推測しない）。0.176.0 で PLAYABLE_NOT_EVALUATED は空、条件を呼ぶ側の表に移った。"""
    owners = {}
    for card_id in E.DEFAULT_EFFECTS._trainers:
        owner = L._use_condition_owner(E.DEFAULT_EFFECTS.trainer_entry(card_id).effect)
        if owner is not None and owner.__name__ in L.PLAYABLE_FACE_UP_PREFIX_TRIALS:
            owners[card_id] = owner.__name__
    assert owners == {PB.QUIZ1: "BlainesHeightQuiz", PB.QUIZ2: "SetAsideGuessKindQuiz", PB.QUIZ3: "BlainesQuiz", PB.PERSONALITY: "SetAsideGuessKindQuiz",
                      PB.CARD_FLIP: "GuessOpponentPrizeKind", PB.SWAP: "SwapPleaseTrainer"}
    assert L.PLAYABLE_NOT_EVALUATED == frozenset()
    assert "PLAYABLE_FACE_UP_PREFIX_TRIALS" in L.GUARANTEE_TRAINER["preconditions"]  # 保証文の変更（GUI は表示するだけで、合法性の判定に使わない）


def test_board_1_passing_illegal_and_not_implemented(b):
    t = start(b, ONE)
    assert sorted(hand_ids(b, t[0])) == sorted([PB.QUIZ2, PB.PERSONALITY, PB.QUIZ1, PB.PORYGON_NO_DEX])
    cand, handle, options = open_trainer(b, t[0])
    assert (cand["input_disclosure"], cand["processability"]) == ("confirmed", "may_stop_later")  # 候補の区分は選べるもののうち最もよいもの
    assert set(cand["guarantees"]) == set(L.GUARANTEE_TRAINER) and cand["guarantees"]["preconditions"] == L.GUARANTEE_TRAINER["preconditions"]
    assert set(options) == {PB.QUIZ2, PB.QUIZ1}  # 性格判定（手札に進化カードがない。ゲーム上使えない）は出ない
    assert status(options[PB.QUIZ2]) == PASSING
    assert status(options[PB.QUIZ1]) == ("not_implemented", False, STOPS)  # 未対応（図鑑番号のないポケモンだけ）。ゲーム上の禁止ではない
    latest = latest_of(b, t)
    refused = b.seat(t[0], "check", **handle, choices=[options[PB.QUIZ1]["id"]])["response"]
    assert (refused["valid"], refused["refusal"]["code"]) == (False, "CANDIDATE_NOT_EXECUTABLE")
    sent = b.seat(t[0], "submit", **handle, choices=[options[PB.QUIZ1]["id"]], operation_id="pt5e-not-executable")
    assert (sent["outcome"], sent["refusal"]["code"], sent["result"]) == ("refused", "CANDIDATE_NOT_EXECUTABLE", None), sent  # 送る前に断る（エンジンの状態は変わらない）
    assert hand_ids(b, t[0]).count(PB.QUIZ1) == 1
    for w in (1, "spectator"):
        assert b.updates(t[w], latest[w])["updates"] == []
    assert b.seat(t[0], "check", **handle, choices=[options[PB.QUIZ2]["id"]])["response"] == {"valid": True, "refusal": None}
    result = b.seat(t[0], "submit", **handle, choices=[options[PB.QUIZ2]["id"]], operation_id="pt5e-accept")
    assert (result["outcome"], result["result"]["status"]) == ("accepted", "awaiting_decision"), result  # 受理のあとの決定（置くカード）に続く。完走ではない
    after = b.seat(t[0], "candidates")["response"]
    assert [c["kind"] for c in after["candidates"]] == ["answer_decision"]
    assert PB.QUIZ2 not in hand_ids(b, t[0])


def test_board_2_unresolved_and_illegal(b):
    t = start(b, TWO)
    cand, handle, options = open_trainer(b, t[0])
    assert set(options) == {PB.QUIZ3, PB.BILL}  # とりかえっこプリーズ（相手の手札がない。ゲーム上使えない）は出ない
    assert status(options[PB.QUIZ3]) == ("unresolved_ruling", False, STOPS)  # 未裁定（ワザを持つポケモンが手札にない。QZ1）
    assert status(options[PB.BILL]) == PASSING  # PT-5e の外（対照）
    refused = b.seat(t[0], "check", **handle, choices=[options[PB.QUIZ3]["id"]])["response"]
    assert (refused["valid"], refused["refusal"]["code"]) == (False, "CANDIDATE_NOT_EXECUTABLE")
