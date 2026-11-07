"""検証用の固定例の JSON を作る（開発者の道具。実行時には使わない）。

エンジンのテストの既存の固定例（tests/helpers.py の PIKACHU_DECK・PIKACHU_DECK_B、tests/sudden_death_games.py の
swap_policy_command。seed 9）を、固定コミットのエンジンの作業ツリーから読み、受理された操作の列を書き出す。
エンジンのテストのモジュールは pip の導入物に入らないので、作業ツリー（既定は venv の src/kyuura-engine。
requirements.txt の -e で入る固定コミットの clone）を --engine で渡す。

    server/.venv/Scripts/python server/tools/build_scenarios.py            # Windows
    server/.venv/bin/python server/tools/build_scenarios.py                # macOS・Linux

エンジンの固定コミットを変えたら、作り直して差分を確かめる（README「エンジンの更新」）。
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent
OUT = SERVER / "kyuura_gui_server" / "scenarios"
DEFAULT_ENGINE = SERVER / ".venv" / "src" / "kyuura-engine"
PINNED = "d0c5cfa9483aacae0cce2fd8d28166b1d8465500"
SEED = 9
HALT_SEED = 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", type=Path, default=DEFAULT_ENGINE, help="固定コミットのエンジンの作業ツリー")
    args = parser.parse_args(argv)
    head = subprocess.run(["git", "-C", str(args.engine), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    if head != PINNED:
        print(f"エンジンの作業ツリーが固定コミットではない: {head}", file=sys.stderr)
        return 1
    sys.path.insert(0, str(args.engine))
    from kyuura_engine import __version__, apply_command, command_to_dict, new_game
    from tests.helpers import LIGHTNING, PIKACHU, PIKACHU_DECK, PIKACHU_DECK_B
    from tests.sudden_death_games import play_segment, swap_policy_command

    decks = [list(PIKACHU_DECK), list(PIKACHU_DECK_B)]
    final, commands = play_segment(new_game(*decks, SEED), janken_winner=SEED % 2, policy=swap_policy_command)
    state = new_game(*decks, SEED)
    decision_point = None
    for index, command in enumerate(commands):
        state = apply_command(state, command)
        if decision_point is None and state.decision is not None and state.decision.kind == "take_prize":
            decision_point = {"commands": index + 1, "phase": state.phase.value, "decision_kind": state.decision.kind}
    if final.phase.value != "sudden_death" or decision_point is None:
        print("固定例が想定の盤面に届かない", file=sys.stderr)
        return 1
    pikachu = {
        "source": "kyuura-engine tests/helpers.py PIKACHU_DECK・PIKACHU_DECK_B、tests/sudden_death_games.py swap_policy_command（seed 9）",
        "engine_commit": PINNED, "engine_version": __version__,
        "decks": decks, "seed": SEED, "commands": [command_to_dict(c) for c in commands],
        "points": {"decision": decision_point,
                   "sudden_death": {"commands": len(commands), "phase": final.phase.value, "decision_kind": None}},
    }
    halt_deck = [PIKACHU] + [LIGHTNING] * 59
    halt = {"source": "kyuura-engine tests/test_replay_record_v0_153.py HALT_DECK（seed 1）", "engine_commit": PINNED, "engine_version": __version__,
            "decks": [halt_deck, halt_deck], "seed": HALT_SEED}
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (("pikachu_seed9.json", pikachu), ("halt_seed1.json", halt)):
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("書き出し:", OUT / name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
