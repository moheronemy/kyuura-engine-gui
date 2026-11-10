"""U7-5f・g（v0.172）の検証用の固定例の JSON を作る（開発者の道具。実行時には使わない）。

導入済みの固定版のエンジン（requirements.txt の通常のインストール）の公開の入口だけを使う（エンジンのテストのモジュール・作業ツリーを読まない）。
導入済みのエンジンのコミットが contract/kyuura-client-api-v1.json の engine.commit と違えば止まる。前の固定例（build_u7_5_scenarios.py・
build_u7_5e_scenarios.py）は作り直さない。

    server/.venv/Scripts/python server/tools/build_u7_5fg_scenarios.py   # Windows
    server/.venv/bin/python server/tools/build_u7_5fg_scenarios.py       # macOS・Linux

作る固定例（seed・デッキ・操作の列はブラウザへ返さない。返すのは固定例の名前と説明だけ）:

- カツラ（new_game から始める）: エンジンのテスト（tests/test_legal_actions_u7_5g_energy2.py の BLAINE_DECK・BLAINE_SEED）と同じデッキ同士・seed 1。
  準備から先はブラウザが client_api だけで進める（カツラを使い、attach_energy の任意の 3 段目 energy2 で 2 枚をつける）
- うらのカードの特殊能力（new_game から始める）: マンキー（ジャングル）4・ロケット団のヒトカゲ 4・マチスの秘策 4・闘エネルギー 48 対 RC_DECK。seed は GUI の側で
  事前に上限を決めた探索（seed 1〜40。準備のあとの先攻の手札にマチスの秘策・マンキー・ロケット団のヒトカゲがある最初）で決めた 8。どちらをうらにするかは画面で選ぶ
  （マンキーの［スパイ］は入力なし、ロケット団のヒトカゲの［ほのおをもらう］は 2 段の型で入力を返さない）
- フラッシュ（再生する）: ヒトカゲ 4・炎エネルギー 56 対 ヒトカゲ 4・フラッシュ 4・炎エネルギー 52。seed は同じ探索（seed 1〜20。後攻の最初の番の手札に
  フラッシュがある最初）で決めた 2。準備・番を終える・フラッシュ・先攻の並べ替えの決定を U7 の候補で送った列を再生し、後攻が自分の山札の並べ替えに答える決定の直前で止める
  （先攻の山札の上 5 枚がおもて。決定の回答者の coverage に R-4）。並べ替え（5 枚の順）は画面の決定でも答えられる

作ったあと、各固定例の全入口の観測の sha256（views_sha256）を、記録したエンジンで入れる（scenarios.build と同じ作り方）。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent
sys.path.insert(0, str(SERVER))
sys.path.insert(0, str(HERE))

from kyuura_engine import __version__, command_to_dict  # noqa: E402
from kyuura_engine import adapter as A  # noqa: E402
from kyuura_engine import legal_actions as L  # noqa: E402

from build_u7_5e_scenarios import FIRE, RC_DECK, _kind, _Recording, _send, _setup  # noqa: E402
from kyuura_gui_server import scenarios  # noqa: E402
from kyuura_gui_server.engine_source import verify_engine_source  # noqa: E402

OUT = SERVER / "kyuura_gui_server" / "scenarios"
CONTRACT = json.loads((SERVER.parent / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))

FIGHTING = "PMCG1-102"
# エンジンのテスト tests/test_legal_actions_u7_5g_energy2.py の BLAINE_DECK（カツラのガーディ 4・カツラ 4・炎エネルギー 52）と BLAINE_SEED
BLAINE_DECK = ["PMCG6-027"] * 4 + ["PMCG6-093"] * 4 + [FIRE] * 52
FACE_DOWN_DECK = ["PMCG2-028"] * 4 + ["PMCG4-012"] * 4 + ["PMCG5-093"] * 4 + [FIGHTING] * 48  # マンキー（ジャングル）・ロケット団のヒトカゲ・マチスの秘策・闘エネルギー
CHARMANDER_DECK = ["PMCG1-014"] * 4 + [FIRE] * 56
FLASH_DECK = ["PMCG1-014"] * 4 + ["ES2-035"] * 4 + [FIRE] * 52  # ヒトカゲ・フラッシュ・炎エネルギー
STARTS = {
    "blaine_seed1.json": ("kyuura-engine tests/test_legal_actions_u7_5g_energy2.py BLAINE_DECK 同士（seed 1。エンジンのテストの BLAINE_SEED と同じ）", BLAINE_DECK, BLAINE_DECK, 1),
    "face_down_power_seed8.json": ("マンキー（PMCG2-028）4・ロケット団のヒトカゲ 4・マチスの秘策 4・闘エネルギー 48 対 RC_DECK（GUI の側のデッキ。seed 8 は GUI の事前に上限を決めた探索 seed 1〜40）",
                                   FACE_DOWN_DECK, RC_DECK, 8),
}
FLASH = "flash_seed2.json"
FLASH_SEED = 2


def _flash_commands():
    """準備 → 先攻は番を終える → 後攻がフラッシュを使う → 先攻が自分の山札の上 5 枚の並べ替えに答える（見た順のまま）。後攻の並べ替えの決定の直前まで。"""
    start = A.start_game(CHARMANDER_DECK, FLASH_DECK, FLASH_SEED)
    game = _Recording(start.state.clone())
    host = L.ActionHost(game)
    _setup(host)
    s0 = host.session(0)
    r = s0.candidates()
    _send(s0, r, _kind(r, L.KIND_END_TURN), [])
    s1 = host.session(1)
    r = s1.candidates()
    trainer = _kind(r, L.KIND_PLAY_TRAINER)
    stage = s1.inputs(r["game"], r["revision"], trainer["id"])["stages"][0]
    _send(s1, r, trainer, [next(o["id"] for o in stage["options"] if o["card_id"] == "ES2-035")])
    decision = game.state.decision
    if decision is None or decision.player != 0:
        raise SystemExit("フラッシュのあと、先攻の決定にならない")
    r = s0.candidates()
    answer = _kind(r, L.KIND_ANSWER_DECISION)
    stage = s0.inputs(r["game"], r["revision"], answer["id"])["stages"][0]
    _send(s0, r, answer, [o["id"] for o in stage["options"]][: stage["count"]["max"]])
    decision = game.state.decision
    if decision is None or decision.player != 1:
        raise SystemExit("先攻の並べ替えのあと、後攻の決定にならない")
    return game.sent, game.state


def _write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print("書き出し:", OUT / name)


def main() -> int:
    pinned = CONTRACT["engine"]["commit"]
    verify_engine_source(pinned, CONTRACT["engine"]["version"])  # 導入済みのエンジンが固定版（違えば例外で止まる）
    base = {"engine_commit": pinned, "engine_version": __version__}
    for name, (source, deck0, deck1, seed) in STARTS.items():
        _write(name, {"source": source, **base, "decks": [deck0, deck1], "seed": seed})
    commands, state = _flash_commands()
    _write(FLASH, {
        "source": "ヒトカゲ 4・炎エネルギー 56 対 ヒトカゲ 4・フラッシュ 4・炎エネルギー 52（GUI の側のデッキ。seed 2 は GUI の事前に上限を決めた探索 seed 1〜20）。"
                  "準備・番を終える・フラッシュ・先攻の並べ替えの決定を U7 の候補で送った列（GUI の画面でもできる操作だけ）",
        **base, "decks": [CHARMANDER_DECK, FLASH_DECK], "seed": FLASH_SEED, "commands": [command_to_dict(c) for c in commands],
        "points": {"flash_decision": {"commands": len(commands), "phase": state.phase.value, "decision_kind": state.decision.kind}}})
    original = scenarios._verify_views
    scenarios._verify_views = lambda *args: None  # 照らす値そのものを作るので、照らさずに作る
    try:
        for scenario_id, spec in scenarios.SCENARIOS.items():
            if spec["file"] not in (*STARTS, FLASH):
                continue
            hub, _notice = scenarios.build(scenario_id)
            path = OUT / spec["file"]
            data = json.loads(path.read_text(encoding="utf-8"))
            data.setdefault("views_sha256", {})[scenario_id] = scenarios.digest(scenarios.views(hub))
            _write(spec["file"], data)
    finally:
        scenarios._verify_views = original
    return 0


if __name__ == "__main__":
    sys.exit(main())
