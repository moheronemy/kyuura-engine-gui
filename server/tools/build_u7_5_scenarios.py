"""U7-5 の検証用の固定例の JSON を作る（開発者の道具。実行時には使わない）。

導入済みの固定版のエンジン（requirements.txt の通常のインストール）の公開の入口だけを使う（エンジンのテストのモジュール・作業ツリーを読まない）。
導入済みのエンジンのコミットが contract/kyuura-client-api-v1.json の engine.commit と違えば止まる。

    server/.venv/Scripts/python server/tools/build_u7_5_scenarios.py   # Windows
    server/.venv/bin/python server/tools/build_u7_5_scenarios.py       # macOS・Linux

作る固定例（seed・デッキはブラウザへ返さない。返すのは固定例の名前と説明だけ）:

- new_game から始める 5 つ（``ClientHub.start`` に固定のデッキと seed を渡す。準備から先はブラウザが client_api だけで進める）
  - ラッキースタジアム・ピッピ人形: エンジンのテスト（tests/test_legal_actions_u7_5d.py の LUCKY_DECK・LUCKY_SEED、
    tests/test_legal_actions_u7_5ab.py の DOLL_DECK・DOLL_SEED）と同じデッキ・seed
  - 錯乱ジム: エンジンのテスト（tests/test_legal_actions_u7_5c.py の CHAOS_DECK）のデッキと、相手を「たねポケモン 1 枚と炎エネルギー 59 枚」に
    したデッキ。seed は GUI の側で事前に固定した探索（seed 16・1 の 2 回）で決めた 1（交換おじさんのコインが「うら」で、相手の手札にポケモンがない）
  - マチスの秘策・ヤマブキシティジム: GUI の側で事前に固定した探索（seed 1〜6・1〜10 の最初）で決めた seed 1
- 再生する 1 つ（「ばける」）: タケシのキュウコンの「ばける」は特殊能力（UsePokemonPower。GUI の対象外の操作）なので、ホストの側の準備として
  合法な操作の列（U7 の候補・直接のコマンド）を送り、受理された列を記録する。seed は事前に固定した探索（seed 1〜10 の最初）で決めた 10

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
from kyuura_engine.commands import UsePokemonPower  # noqa: E402

from kyuura_gui_server import scenarios  # noqa: E402
from kyuura_gui_server.engine_source import verify_engine_source  # noqa: E402

OUT = SERVER / "kyuura_gui_server" / "scenarios"
CONTRACT = json.loads((SERVER.parent / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))

FIRE, PSYCHIC = "PMCG1-098", "PMCG1-101"
# エンジンのテストの接続のデッキ（tests/test_legal_actions_u7_3.py の CONNECT_DECK。並びは切る前のデッキの並び）
CONNECT = [c for c in ("PMCG1-014", "PMCG1-017", "PMCG1-018", "PMCG1-019", "PMCG1-015", "PMCG1-022", "PMCG1-016", "PMCG1-020") for _ in range(4)] + [FIRE] * 28


def _swap(deck, card):
    """炎エネルギー 4 枚を card 4 枚にする（エンジンのテストの LUCKY_DECK・DOLL_DECK と同じ作り方）。"""
    out = list(deck)
    for _ in range(4):
        out.remove(FIRE)
    return out + [card] * 4


CHAOS = [c for c in ("PMCG5-087", "PMCG1-093", "PMCG1-014", "PMCG1-017", "PMCG1-015", "PMCG1-016", "PMCG1-018", "PMCG1-020") for _ in range(4)] + [FIRE] * 28
LONE_MAGMAR = ["PMCG1-020"] + [FIRE] * 59  # たねポケモンはブーバー 1 枚だけ（バトル場に出すと手札にポケモンが残らない）
SAFFRON = ["PMCG6-043"] * 4 + ["PMCG6-090"] * 4 + [PSYCHIC] * 52  # ナツメのケーシィ・ヤマブキシティジム・超エネルギー
BROCK = [c for c in ("PMCG5-018", "PMCG5-019", "PMCG1-014", "PMCG1-017") for _ in range(4)] + [FIRE] * 44  # タケシのロコン・キュウコン・ヒトカゲ・リザード

STARTS = {
    "lucky_stadium_seed1.json": ("kyuura-engine tests/test_legal_actions_u7_5d.py LUCKY_DECK 対 tests/test_legal_actions_u7_3.py CONNECT_DECK（seed 1。エンジンのテストと同じ）",
                                 _swap(CONNECT, "PRN-015"), CONNECT, 1),
    "clefairy_doll_seed1.json": ("kyuura-engine tests/test_legal_actions_u7_5ab.py DOLL_DECK 同士（seed 1。エンジンのテストと同じ）",
                                 _swap(CONNECT, "PMCG1-091"), _swap(CONNECT, "PMCG1-091"), 1),
    "chaos_gym_seed1.json": ("kyuura-engine tests/test_legal_actions_u7_5c.py CHAOS_DECK 対 ブーバー 1 枚と炎エネルギー 59 枚（GUI の側のデッキ。seed 1 は GUI の事前に固定した探索）",
                             CHAOS, LONE_MAGMAR, 1),
    "secret_plan_seed1.json": ("CONNECT_DECK の炎エネルギー 4 枚をマチスの秘策（PMCG5-093）にしたデッキ 対 CONNECT_DECK（GUI の側のデッキ。seed 1 は GUI の事前に固定した探索）",
                               _swap(CONNECT, "PMCG5-093"), CONNECT, 1),
    "saffron_gym_seed1.json": ("ナツメのケーシィ 4・ヤマブキシティジム 4・超エネルギー 52 対 CONNECT_DECK（GUI の側のデッキ。seed 1 は GUI の事前に固定した探索）",
                               SAFFRON, CONNECT, 1),
}
DISGUISE_SEED = 10


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


def _send(session, response, candidate, choices):
    result = session.submit(response["game"], response["revision"], candidate["id"], choices)
    if result.outcome != D.ACCEPTED:
        raise SystemExit(f"準備の操作が受理されない: {candidate['kind']}")


def _kind(response, kind):
    return next((c for c in response["candidates"] if c["kind"] == kind), None)


def _disguise_commands():
    """タケシのロコンをバトル場に出し、番 3 にキュウコンへ進化させ、「ばける」で手札のリザードをのせるまでの合法な列。"""
    start = A.start_game(BROCK, CONNECT, DISGUISE_SEED)
    game = _Recording(start.state.clone())
    host = L.ActionHost(game)
    for _ in range(40):  # 準備（バトル場はタケシのロコンがあればそれ、補償は最大）
        moved = False
        for actor in (0, 1):
            session = host.session(actor)
            r = session.candidates()
            if not r["candidates"]:
                continue
            c = r["candidates"][0]
            stage = session.inputs(r["game"], r["revision"], c["id"])["stages"][0]
            if c["kind"] == L.KIND_PLACE_STARTING:
                options = [o for o in stage["options"] if o["eligible"]]
                _send(session, r, c, [next((o for o in options if o.get("card_id") == "PMCG5-018"), options[0])["id"]])
            else:
                _send(session, r, c, [stage["range"]["max"]])
            moved = True
        if not moved:
            break
    hs = host.host_session()
    r = hs.candidates()
    _send(hs, r, _kind(r, L.KIND_REPORT_JANKEN), [0])
    for _ in range(4):  # プレイヤー 0 の番に進化できれば進化し、「ばける」まで進む。ほかは番を終える（番 1・2 は進化できない）
        state = game.state
        actor = state.current_player
        session = host.session(actor)
        r = session.candidates()
        ev = _kind(r, L.KIND_EVOLVE) if actor == 0 else None
        if ev is not None:
            stages = session.inputs(r["game"], r["revision"], ev["id"])["stages"]
            card = next(o for o in stages[0]["options"] if o["card_id"] == "PMCG5-019")
            zones = {o["id"]: o["zone"] for o in stages[1]["options"]}
            target = next(p["option"] for p in stages[1]["options_by_choice"][card["id"]] if p["eligible"] and zones[p["option"]] == "active")
            _send(session, r, ev, [card["id"], target])
            if game.submit(UsePokemonPower(0, game.state.players[0].active.pokemon_id, 0), submitter=0).outcome != D.ACCEPTED:
                raise SystemExit("「ばける」が受理されない")
            r = session.candidates()
            answer = _kind(r, L.KIND_ANSWER_DECISION)
            stage = session.inputs(r["game"], r["revision"], answer["id"])["stages"][0]
            charmeleon = next(o for o in stage["options"] if o.get("card_id") == "PMCG1-017")
            _send(session, r, answer, [charmeleon["id"]])
            if _kind(session.candidates(), L.KIND_REMOVE_DISGUISE) is None:
                raise SystemExit("ばけるの解除の候補に届かない")
            return game.sent, game.state
        _send(session, r, _kind(r, L.KIND_END_TURN), [])
    raise SystemExit("番 3 に届かない")


def _write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("書き出し:", OUT / name)


def main() -> int:
    pinned = CONTRACT["engine"]["commit"]
    verify_engine_source(pinned, CONTRACT["engine"]["version"])  # 導入済みのエンジンが固定版（違えば例外で止まる）
    base = {"engine_commit": pinned, "engine_version": __version__}
    for name, (source, deck0, deck1, seed) in STARTS.items():
        _write(name, {"source": source, **base, "decks": [deck0, deck1], "seed": seed})
    commands, state = _disguise_commands()
    _write("disguise_seed10.json", {
        "source": "タケシのロコン・キュウコン・ヒトカゲ・リザード各 4 と炎エネルギー 44 対 CONNECT_DECK（GUI の側のデッキ。seed 10 は GUI の事前に固定した探索）。"
                  "準備は U7 の候補、「ばける」は直接のコマンド（UsePokemonPower。GUI の対象外）、のせるカードは U7 の決定で答えた列",
        **base, "decks": [BROCK, CONNECT], "seed": DISGUISE_SEED, "commands": [command_to_dict(c) for c in commands],
        "points": {"disguise": {"commands": len(commands), "phase": state.phase.value, "decision_kind": None}}})
    # 観測の sha256 を記録したエンジンで入れる（照らす値そのものを作るので、照らさずに作る）
    original = scenarios._verify_views
    scenarios._verify_views = lambda *args: None
    try:
        for scenario_id, spec in scenarios.SCENARIOS.items():
            if spec["file"] not in (*STARTS, "disguise_seed10.json"):
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
