"""0.177.0（PT5E-FROM-STATE-INVARIANT）: エンジンの ``ClientHub.from_state`` が、複製した状態を ``check_invariants`` で確かめ、不整合なら hub・セッション・
取っ手を作る前に ``UnusableStateError`` で拒否するようになったことへの、接続層の追従の確かめ（実際の固定版のエンジン。模擬の応答を使わない）。

GUI は新しい確かめを二重に作らない。製品のコードは変えていない: 固定例（``scenarios.build``）とテスト専用の構築盤面は今までどおり ``ClientHub.from_state`` を使い、
拒否の例外は接続層の既存の middleware が ``GUI_INTERNAL_ERROR`` の決まった応答にする（例外の文・``problems``・``__cause__``・traceback をブラウザへ返さない。
ホストのログにだけ残る）。

不整合な状態は**このテストの中だけ**で作る（PT-5e の構築盤面の状態を 1 か所だけ変える）。テストの中だけで固定例の表に名前の決まった盤面として加える
（``p6_boards.install_boards``。製品の作成の口は任意の状態を受け取らない）。エンジンの tests は import しない。
"""

from __future__ import annotations

import inspect
import logging

import pytest
from fastapi.testclient import TestClient
from kyuura_engine import adapter as A
from kyuura_engine import legal_actions as L
from kyuura_engine.client_api import ClientHub
from kyuura_engine.engine import check_invariants
from kyuura_engine.errors import EngineError

from kyuura_gui_server import scenarios
from kyuura_gui_server.app import ERRORS, GUI_SERVER_FORMAT, create_app

from . import pt5e_boards as PB
from .conftest import Bridge, tokens
from .p6_boards import install_boards

SECRET_CAUSE = "SECRET-CAUSE カード 5 が プレイヤー 1 の deck の 3 枚目"  # 確かめの途中の例外（__cause__）に入れる、ブラウザへ出てはいけない文
BOARD = "pt5e_trainers_1"


def broken_state():
    """テスト専用: 正しい構築盤面（PT-5e 1）の山札の 1 枚目を手札にも置く（カードが 2 か所にある。不変条件の崩れ）。"""
    state = PB.table(*PB.BOARDS[BOARD])
    me = state.players[0]
    me.hand.append(me.deck[0])
    return state


def install(monkeypatch, builders):
    install_boards(scenarios, {name: (f"テスト専用 {name}", "テスト専用", builder) for name, builder in builders.items()}, monkeypatch)


@pytest.fixture()
def app_and_bridge(monkeypatch):
    def check_error(_name):
        def failing_check(_state):
            raise RuntimeError(SECRET_CAUSE)

        monkeypatch.setattr(A, "check_invariants", failing_check)  # このテストの中だけ: 確かめの途中の例外（STATE_CHECK_ERROR）
        try:
            return ClientHub.from_state(PB.table(*PB.BOARDS[BOARD]))
        finally:
            monkeypatch.setattr(A, "check_invariants", check_invariants)

    install(monkeypatch, {
        "broken": lambda _name: ClientHub.from_state(broken_state()),
        "check_error": check_error,
        "valid": lambda name: ClientHub.from_state(PB.table(*PB.BOARDS[BOARD])),
    })
    app = create_app()
    return app, Bridge(TestClient(app, base_url="http://127.0.0.1"))


def test_engine_entry_checks_and_gui_paths_use_it():
    """エンジンの入口の形（固定版のコード）と、GUI の固定例・構築盤面がその入口を使うこと（内部の無検査の組み立てへ移していない）。"""
    assert "checked_state_copy(state)" in inspect.getsource(ClientHub.from_state)
    assert "checked_state_copy(state)" in inspect.getsource(L.ActionHost.from_state)
    assert issubclass(A.UnusableStateError, ValueError) and not issubclass(A.UnusableStateError, EngineError)
    assert "ClientHub.from_state(state)" in inspect.getsource(scenarios.build)
    for module in ("p6_boards", "r3a_boards", "pt5e_boards"):
        source = inspect.getsource(__import__(f"tests.{module}", fromlist=["build"]).build)
        assert "ClientHub.from_state(" in source and "HostedGame" not in source, module
    # 正しい構築盤面は受け付ける（両方の入口）
    for entry in (ClientHub.from_state, L.ActionHost.from_state):
        entry(PB.table(*PB.BOARDS[BOARD]))


def test_engine_rejects_the_broken_state_with_a_fixed_text():
    state = broken_state()
    with pytest.raises(A.UnusableStateError) as caught:
        ClientHub.from_state(state)
    error = caught.value
    assert error.code == A.STATE_INTEGRITY_CODE and error.problems  # problems はホスト・検証者だけが読む（カードの番号・ゾーンが入る）
    assert any("カード" in p for p in error.problems)
    assert all(p not in str(error) for p in error.problems)  # str() は固定の文
    with pytest.raises(TypeError):
        ClientHub.from_state(object())


@pytest.mark.parametrize("name, code", [("broken", A.STATE_INTEGRITY_CODE), ("check_error", A.STATE_CHECK_ERROR_CODE)])
def test_rejected_state_gives_the_fixed_response_and_no_new_match(app_and_bridge, caplog, name, code):
    app, b = app_and_bridge
    before = b.create(mode="scenario", scenario="valid")  # 拒否の前の対戦（拒否で置きかわらない・新しい入口が出ないことを見る）
    assert before["ok"]
    old = tokens(before["match"])
    old_match = app.state.registry.current()

    expected_problems = []
    if name == "broken":
        with pytest.raises(A.UnusableStateError) as direct:
            ClientHub.from_state(broken_state())
        expected_problems = list(direct.value.problems)
        assert expected_problems

    with caplog.at_level(logging.ERROR, logger="kyuura_gui_server"):
        response = b.client.post("/api/local-match", json={"mode": "scenario", "scenario": name})

    # プレイヤー（ブラウザ）向けの応答: 既存の決まった形だけ。問題の文・原因・traceback・例外の型・code・エンジンの固定の文を含まない
    status, message = ERRORS["GUI_INTERNAL_ERROR"]
    assert response.status_code == status
    assert response.json() == {"gui_server": GUI_SERVER_FORMAT, "ok": False, "error": {"code": "GUI_INTERNAL_ERROR", "message": message}}
    text = response.text
    for word in [*expected_problems, SECRET_CAUSE, "SECRET", "Traceback", "UnusableStateError", "RuntimeError", code,
                 A._UNUSABLE_STATE_TEXTS[code], "problems", "__cause__", "deck", "hand"]:
        assert word not in text, word

    # 拒否された状態の対戦は作られない（hub・入口・取っ手がない）。前の対戦はそのまま使える
    assert app.state.registry.current() is old_match
    assert b.seat(old[0], "candidates")["ok"]

    # ホスト側のログには残る（ホスト・検証者が調べる）。problems・__cause__ は例外のオブジェクトにあり、応答には出ていない
    records = [r for r in caplog.records if r.name == "kyuura_gui_server" and r.exc_info]
    assert len(records) == 1
    error = records[0].exc_info[1]
    assert isinstance(error, A.UnusableStateError) and error.code == code
    if name == "broken":
        assert list(error.problems) == expected_problems
    else:
        assert error.problems == () and isinstance(error.__cause__, RuntimeError) and SECRET_CAUSE in str(error.__cause__)
