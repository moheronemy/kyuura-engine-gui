"""検証用の固定例（信頼されたホストの側だけで作る盤面）。

作った当時の API（U7-1・U7-2）では番の中の操作が「番を終える」だけで、決定待ち・サドン・デスの待ちへは通常の画面操作では
到達できなかった（U7-4 からは決定待ちへは通常の操作でも届く。サドン・デスなどの確かめのために残している）。ここでは、エンジンのテストの既存の固定例（tests/sudden_death_games.py の方策で進めた、ピカチュウのデッキ・
seed 9 の対戦。エンジンの v0.2f 以来の固定例）で受理された操作の列を、``tools/build_scenarios.py`` で JSON に書き出したものを、
エンジンの公開の ``new_game``・``apply_command``・``command_from_dict`` で再生し、``ClientHub.from_state`` で包む。

- 再生はホストの側の準備で、client_api の契約の外（公開の更新を作らない）。包んだあとはブラウザから client_api だけで進める
- seed・デッキリスト・操作の列はブラウザへ返さない（返すのは固定例の名前と説明だけ）
- 再生の結果が記録した段階・決定と合わなければ、固定例を使わない（エンジンの固定コミットが変わったときの検出）

「停止」の固定例は操作の列を使わず、``ClientHub.start`` へ固定のデッキと seed を渡す（エンジンのテスト HALT_DECK と同じ）。

U7-5 の固定例（``tools/build_u7_5_scenarios.py``。導入済みのエンジンの公開の入口だけで作る）:

- new_game から始める 5 つ（point が start）: ``ClientHub.start`` へ固定のデッキと seed を渡すだけで、準備から先はブラウザが client_api で進める
  （通常の合法な操作の列。seed を画面に返さないための入口）
- 再生する 1 つ（「ばける」）: タケシのキュウコンの「ばける」は特殊能力（GUI の対象外）なので、ホストの側の準備として操作の列を再生する。
  再生のあとの「ばける」の解除は、ブラウザから client_api だけで送る

U7-5e の固定例（``tools/build_u7_5e_scenarios.py``）: new_game から始める 2 つ（ロケット団のヒトカゲ・ダークユンゲラー）と、U7 の候補だけで送った
合法な列を再生する 1 つ（エナジートランス。2 進化までの手数を減らすため。GUI の対象外の操作は含まない）
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from kyuura_engine import apply_command, command_from_dict, new_game
from kyuura_engine.client_api import CONTRACT, FORMAT, ClientHub

DATA = Path(__file__).resolve().parent / "scenarios"
_VOLATILE = frozenset({"game", "revision"})  # 対戦ごとに変わる取っ手の識別子（比べない）


def _strip(value):
    if isinstance(value, dict):
        return {k: _strip(v) for k, v in value.items() if k not in _VOLATILE}
    if isinstance(value, list):
        return [_strip(v) for v in value]
    return value


def views(hub: ClientHub) -> dict[str, Any]:
    """全入口（プレイヤー0・1・観戦者・ホスト）の view の応答（取っ手の識別子を除く）。"""
    entries = {"player0": hub.player(0), "player1": hub.player(1), "spectator": hub.spectator(), "host": hub.host()}
    return {name: _strip(entry.handle({"contract": CONTRACT, "format": FORMAT, "type": "view"})) for name, entry in entries.items()}


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


class ScenarioError(RuntimeError):
    """固定例を再生できない・記録と合わない。"""


SCENARIOS: dict[str, dict[str, str]] = {
    "decision": {"label": "決定待ち（固定例）", "file": "pikachu_seed9.json", "point": "decision",
                 "description": "プレイヤー 0 がサイドを取る決定の直前。答えると、相手がバトル場に出すポケモンを選ぶ決定が続く。"},
    "sudden_death": {"label": "サドン・デス待ち（固定例）", "file": "pikachu_seed9.json", "point": "sudden_death",
                     "description": "両者が同時に最後のサイドを取りサドン・デスに移った直後。ホストが延長戦を始める。"},
    "halt": {"label": "準備で停止（固定例）", "file": "halt_seed1.json", "point": "start",
             "description": "たねポケモン 1 枚のデッキ同士。切り直しの補償が記録で決まらず、エンジンが対戦を止める。"},
    # U7-5（tools/build_u7_5_scenarios.py。new_game から始める 5 つと、特殊能力の「ばける」をホストの側で再生する 1 つ）
    "lucky_stadium": {"label": "ラッキースタジアム（固定例・new_game）", "file": "lucky_stadium_seed1.json", "point": "start",
                      "description": "ラッキースタジアムを入れたデッキで、準備から画面で進める。手札から出す（トレーナー）と、場のスタジアムを使う（入力なし）を確かめる。"},
    "saffron_gym": {"label": "ヤマブキシティジム（固定例・new_game）", "file": "saffron_gym_seed1.json", "point": "start",
                    "description": "ナツメのケーシィ・ヤマブキシティジムのデッキで、準備から画面で進める。エネルギーをつけてから、場のスタジアムで手札にもどすエネルギーを選ぶ。"},
    "secret_plan": {"label": "マチスの秘策（固定例・new_game）", "file": "secret_plan_seed1.json", "point": "start",
                    "description": "マチスの秘策を入れたデッキで、準備から画面で進める。使ったあとの決定でうらにするカードを選び、うらのカードをおもてにする。"},
    "clefairy_doll": {"label": "ピッピ人形（固定例・new_game）", "file": "clefairy_doll_seed1.json", "point": "start",
                      "description": "ピッピ人形を入れたデッキ同士で、準備から画面で進める。手札から出し（トレーナー）、場からすてる。"},
    "chaos_gym": {"label": "錯乱ジム（固定例・new_game）", "file": "chaos_gym_seed1.json", "point": "start",
                  "description": "錯乱ジム・ポケモン交換おじさんのデッキ 対 たねポケモン 1 枚のデッキ。準備から画面で進め、コインの結果のあとに相手が答える決定を確かめる。"},
    "disguise": {"label": "「ばける」の解除（固定例・再生）", "file": "disguise_seed10.json", "point": "disguise",
                 "description": "プレイヤー 0 の番 3。タケシのキュウコンに「ばける」でリザードをのせた直後（「ばける」の宣言はホストの側で再生した）。"},
    # U7-5e（tools/build_u7_5e_scenarios.py。new_game から始める 2 つと、U7 の候補だけの列を再生する 1 つ）
    "rocket_charmander": {"label": "ロケット団のヒトカゲ（固定例・new_game）", "file": "rocket_charmander_seed1.json", "point": "start",
                          "description": "ロケット団のヒトカゲのデッキ同士で、準備から画面で進める。特殊能力［ほのおをもらう］（2 段: 元のポケモン → エネルギー。自分の番ごとに 1 回）。"},
    "dark_kadabra": {"label": "ダークユンゲラー（固定例・new_game）", "file": "dark_kadabra_seed1.json", "point": "start",
                     "description": "ケーシィ・ダークユンゲラーのデッキで、準備から画面で進める。特殊能力［ぶっしつこうかん］（入力なし。受理のあとに手札のカードを選ぶ決定。自分の番ごとに 1 回）。"},
    "energy_trans": {"label": "エナジートランス（固定例・再生）", "file": "energy_trans_seed1.json", "point": "energy_trans",
                     "description": "プレイヤー 0 の番 5。フシギバナに進化した直後（準備・ベンチ・進化・エネルギーの合法な列を再生した）。特殊能力［エナジートランス］（3 段: 元 → エネルギー → 先）。"},
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
        hub, notice = ClientHub.start(decks[0], decks[1], data["seed"])
        _verify_views(data, scenario_id, hub)
        return hub, notice
    point = data["points"][spec["point"]]
    state = new_game(decks[0], decks[1], data["seed"])
    for command in data["commands"][: point["commands"]]:
        state = apply_command(state, command_from_dict(command))
    if state.phase.value != point["phase"] or (state.decision.kind if state.decision is not None else None) != point.get("decision_kind"):
        raise ScenarioError("固定例の再生の結果が記録と合わない（エンジンの版を確かめる）")
    hub = ClientHub.from_state(state)
    _verify_views(data, scenario_id, hub)
    return hub, None  # 再生はホストの側の準備（start の知らせはない）


def _verify_views(data: dict[str, Any], scenario_id: str, hub: ClientHub | None) -> None:
    """記録した時点の全入口の観測（views_sha256）と同じか。違えば固定例を使わない（エンジンを更新したら tools/scenario_views.py で比べる）。"""
    expected = data.get("views_sha256", {}).get(scenario_id)
    if hub is None or expected is None or digest(views(hub)) != expected:
        raise ScenarioError("固定例の観測が記録と合わない（エンジンの版を確かめる）")
