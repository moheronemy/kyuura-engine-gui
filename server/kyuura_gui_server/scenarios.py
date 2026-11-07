"""検証用の固定例（信頼されたホストの側だけで作る盤面）。

現行の API（U7-1・U7-2）では番の中の操作が「番を終える」だけなので、決定待ち・サドン・デスの待ちへは通常の画面操作では
到達できない。ここでは、エンジンのテストの既存の固定例（tests/sudden_death_games.py の方策で進めた、ピカチュウのデッキ・
seed 9 の対戦。エンジンの v0.2f 以来の固定例）で受理された操作の列を、``tools/build_scenarios.py`` で JSON に書き出したものを、
エンジンの公開の ``new_game``・``apply_command``・``command_from_dict`` で再生し、``ClientHub.from_state`` で包む。

- 再生はホストの側の準備で、client_api の契約の外（公開の更新を作らない）。包んだあとはブラウザから client_api だけで進める
- seed・デッキリスト・操作の列はブラウザへ返さない（返すのは固定例の名前と説明だけ）
- 再生の結果が記録した段階・決定と合わなければ、固定例を使わない（エンジンの固定コミットが変わったときの検出）

「停止」の固定例は操作の列を使わず、``ClientHub.start`` へ固定のデッキと seed を渡す（エンジンのテスト HALT_DECK と同じ）。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from kyuura_engine import apply_command, command_from_dict, new_game
from kyuura_engine.client_api import ClientHub

DATA = Path(__file__).resolve().parent / "scenarios"


class ScenarioError(RuntimeError):
    """固定例を再生できない・記録と合わない。"""


SCENARIOS: dict[str, dict[str, str]] = {
    "decision": {"label": "決定待ち（固定例）", "file": "pikachu_seed9.json", "point": "decision",
                 "description": "プレイヤー 0 がサイドを取る決定の直前。答えると、相手がバトル場に出すポケモンを選ぶ決定が続く。"},
    "sudden_death": {"label": "サドン・デス待ち（固定例）", "file": "pikachu_seed9.json", "point": "sudden_death",
                     "description": "両者が同時に最後のサイドを取りサドン・デスに移った直後。ホストが延長戦を始める。"},
    "halt": {"label": "準備で停止（固定例）", "file": "halt_seed1.json", "point": "start",
             "description": "たねポケモン 1 枚のデッキ同士。切り直しの補償が記録で決まらず、エンジンが対戦を止める。"},
}


def scenario_list() -> list[dict[str, str]]:
    return [{"id": key, "label": value["label"], "description": value["description"]} for key, value in SCENARIOS.items()]


def _load(name: str) -> dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def build(scenario_id: str) -> tuple[ClientHub | None, dict[str, Any] | None]:
    """固定例の hub を作る。2 つめの値は、``ClientHub.start`` の知らせ（停止の固定例）か None（操作の列の再生）。"""
    spec = SCENARIOS.get(scenario_id)
    if spec is None:
        raise ScenarioError("知らない固定例")
    data = _load(spec["file"])
    decks = data["decks"]
    if spec["point"] == "start":
        return ClientHub.start(decks[0], decks[1], data["seed"])
    point = data["points"][spec["point"]]
    state = new_game(decks[0], decks[1], data["seed"])
    for command in data["commands"][: point["commands"]]:
        state = apply_command(state, command_from_dict(command))
    if state.phase.value != point["phase"] or (state.decision.kind if state.decision is not None else None) != point.get("decision_kind"):
        raise ScenarioError("固定例の再生の結果が記録と合わない（エンジンの版を確かめる）")
    return ClientHub.from_state(state), None  # 再生はホストの側の準備（start の知らせはない）
