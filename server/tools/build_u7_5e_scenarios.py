"""U7-5e（特殊能力）の検証用の固定例の JSON を作る（開発者の道具。実行時には使わない）。

導入済みの固定版のエンジン（requirements.txt の通常のインストール）の公開の入口だけを使う（エンジンのテストのモジュール・作業ツリーを読まない）。
導入済みのエンジンのコミットが contract/kyuura-client-api-v1.json の engine.commit と違えば止まる。U7-5a〜d の固定例（build_u7_5_scenarios.py）は作り直さない。

    server/.venv/Scripts/python server/tools/build_u7_5e_scenarios.py   # Windows
    server/.venv/bin/python server/tools/build_u7_5e_scenarios.py       # macOS・Linux

作る固定例（seed・デッキ・操作の列はブラウザへ返さない。返すのは固定例の名前と説明だけ）:

- ロケット団のヒトカゲ（new_game から始める）: エンジンのテスト（tests/test_legal_actions_u7_5e.py の RC_DECK・RC_SEED）と同じデッキ同士・seed 1。
  準備から先はブラウザが client_api だけで進める（［ほのおをもらう］。2 段・自分の番ごとに 1 回）
- ダークユンゲラー（new_game から始める）: ケーシィ 4・ダークユンゲラー 4・超エネルギー 52 対 RC_DECK。seed は GUI の側で事前に上限を決めた探索
  （seed 1〜10 の最初）で決めた 1（［ぶっしつこうかん］。入力なし・受理のあとの決定・自分の番ごとに 1 回）
- エナジートランス（再生する）: フシギダネ・フシギソウ・フシギバナ各 4 と草エネルギー 48 対 RC_DECK・seed 1（同じ探索の最初）。2 進化に 3 回の自分の番が
  かかるので、e2e の手数を減らすためにホストの側で合法な操作の列を記録して再生する。列は U7 の候補（準備・ベンチ・エネルギー・進化・番を終える）だけで、
  GUI の画面でも同じ操作ができる（GUI の対象外の操作は含まない）

作ったあと、各固定例の全入口の観測の sha256（views_sha256）を、記録したエンジンで入れる（scenarios.build と同じ作り方）。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent
sys.path.insert(0, str(SERVER))

from kyuura_engine import __version__, command_to_dict  # noqa: E402
from kyuura_engine import adapter as A  # noqa: E402
from kyuura_engine import diagnostics as D  # noqa: E402
from kyuura_engine import legal_actions as L  # noqa: E402

from kyuura_gui_server import scenarios  # noqa: E402
from kyuura_gui_server.engine_source import verify_engine_source  # noqa: E402

OUT = SERVER / "kyuura_gui_server" / "scenarios"
CONTRACT = json.loads((SERVER.parent / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))

FIRE, PSYCHIC, GRASS = "PMCG1-098", "PMCG1-101", "PMCG1-097"
# エンジンのテスト tests/test_legal_actions_u7_5e.py の RC_DECK（ロケット団のヒトカゲ・コラッタ・ポニータ各 4 と炎エネルギー 48）
RC_DECK = ["PMCG4-012"] * 4 + ["PMCG1-060"] * 4 + ["PMCG1-016"] * 4 + [FIRE] * 48
KADABRA = ["PMCG1-043"] * 4 + ["PMCG4-034"] * 4 + [PSYCHIC] * 52  # ケーシィ・ダークユンゲラー・超エネルギー
VENUSAUR = ["PMCG1-001"] * 4 + ["PMCG1-008"] * 4 + ["PMCG1-011"] * 4 + [GRASS] * 48  # フシギダネ・フシギソウ・フシギバナ・草エネルギー
STARTS = {
    "rocket_charmander_seed1.json": ("kyuura-engine tests/test_legal_actions_u7_5e.py RC_DECK 同士（seed 1。エンジンのテストと同じ）", RC_DECK, RC_DECK, 1),
    "dark_kadabra_seed1.json": ("ケーシィ 4・ダークユンゲラー 4・超エネルギー 52 対 RC_DECK（GUI の側のデッキ。seed 1 は GUI の事前に上限を決めた探索）", KADABRA, RC_DECK, 1),
}
ENERGY_TRANS = "energy_trans_seed1.json"
ENERGY_TRANS_SEED = 1


class _Recording(A.HostedGame):
    """受理されたコマンドを記録する（ホストの側の準備）。"""

    def __init__(self, state):
        super().__init__(state)
        self.sent = []

    def submit(self, command, **kw):
        result = super().submit(command, **kw)
        if result.outcome == D.ACCEPTED:
            self.sent.append(command)
        return result


def _kind(response, kind):
    return next((c for c in response["candidates"] if c["kind"] == kind), None)


def _send(session, response, candidate, choices):
    if session.submit(response["game"], response["revision"], candidate["id"], choices).outcome != D.ACCEPTED:
        raise SystemExit(f"準備の操作が受理されない: {candidate['kind']}")


def _setup(host):
    """GUI の e2e と同じ準備（初期配置は最初の選べるもの・補償は最大・ジャンケンはプレイヤー0）。"""
    for _ in range(40):
        moved = False
        for actor in (0, 1):
            session = host.session(actor)
            r = session.candidates()
            c = next((c for c in r["candidates"] if c["kind"] in (L.KIND_PLACE_STARTING, L.KIND_MULLIGAN_DRAW)), None)
            if c is None:
                continue
            stage = session.inputs(r["game"], r["revision"], c["id"])["stages"][0]
            first = next(o["id"] for o in stage["options"] if o["eligible"]) if c["kind"] == L.KIND_PLACE_STARTING else stage["range"]["max"]
            _send(session, r, c, [first])
            moved = True
        if not moved:
            break
    hs = host.host_session()
    r = hs.candidates()
    _send(hs, r, _kind(r, L.KIND_REPORT_JANKEN), [0])


def _to_active(session, kind, first_card_ids):
    """kind（エネルギーをつける・進化）の 1 段目を first_card_ids のカードにし、2 段目をバトル場にする。できなければ何もしない。"""
    r = session.candidates()
    c = _kind(r, kind)
    if c is None:
        return
    stages = session.inputs(r["game"], r["revision"], c["id"])["stages"]
    first = next((o for o in stages[0]["options"] if o["card_id"] in first_card_ids), None)
    if first is None:
        return
    zones = {o["id"]: o["zone"] for o in stages[1]["options"]}
    target = next((p["option"] for p in stages[1]["options_by_choice"][first["id"]] if p["eligible"] and zones[p["option"]] == "active"), None)
    if target is not None:
        _send(session, r, c, [first["id"], target])


def _energy_trans_commands():
    """フシギダネをバトル場に出し、自分の番ごとにベンチに出す・進化・草エネルギーをバトル場へ、で 3 回目の自分の番にエナジートランス（3 段）の候補が出るまでの列。"""
    start = A.start_game(VENUSAUR, RC_DECK, ENERGY_TRANS_SEED)
    game = _Recording(start.state.clone())
    host = L.ActionHost(game)
    _setup(host)
    for turn in range(3):
        session = host.session(0)
        r = session.candidates()
        basic = _kind(r, L.KIND_PLAY_BASIC)
        if basic is not None:
            stage = session.inputs(r["game"], r["revision"], basic["id"])["stages"][0]
            _send(session, r, basic, [stage["options"][0]["id"]])
        _to_active(session, L.KIND_EVOLVE, ("PMCG1-008", "PMCG1-011"))
        _to_active(session, L.KIND_ATTACH_ENERGY, (GRASS,))
        found = [c for c in session.candidates()["candidates"] if c["kind"] == L.KIND_USE_POWER and len(c["input_stages"]) == 3]
        if found:
            return game.sent, game.state
        for actor in (0, 1):
            s = host.session(actor)
            r = s.candidates()
            _send(s, r, _kind(r, L.KIND_END_TURN), [])
    raise SystemExit("エナジートランスの候補に届かない")


def _write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("書き出し:", OUT / name)


def main() -> int:
    pinned = CONTRACT["engine"]["commit"]
    verify_engine_source(pinned, CONTRACT["engine"]["version"])  # 導入済みのエンジンが固定版（違えば例外で止まる）
    base = {"engine_commit": pinned, "engine_version": __version__}
    for name, (source, deck0, deck1, seed) in STARTS.items():
        _write(name, {"source": source, **base, "decks": [deck0, deck1], "seed": seed})
    commands, state = _energy_trans_commands()
    _write(ENERGY_TRANS, {
        "source": "フシギダネ・フシギソウ・フシギバナ各 4 と草エネルギー 48 対 RC_DECK（GUI の側のデッキ。seed 1 は GUI の事前に上限を決めた探索）。"
                  "準備・ベンチ・進化・エネルギー・番を終えるを U7 の候補で送った列（GUI の画面でもできる操作だけ）",
        **base, "decks": [VENUSAUR, RC_DECK], "seed": ENERGY_TRANS_SEED, "commands": [command_to_dict(c) for c in commands],
        "points": {"energy_trans": {"commands": len(commands), "phase": state.phase.value, "decision_kind": None}}})
    original = scenarios._verify_views
    scenarios._verify_views = lambda *args: None  # 照らす値そのものを作るので、照らさずに作る
    try:
        for scenario_id, spec in scenarios.SCENARIOS.items():
            if spec["file"] not in (*STARTS, ENERGY_TRANS):
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
