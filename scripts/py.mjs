// server/.venv の Python で引数のコマンドを実行する（npm run test:server などから使う）。
import { spawnSync } from "node:child_process";
import { ROOT, requireVenv } from "./venv.mjs";

const result = spawnSync(requireVenv(), process.argv.slice(2), { cwd: ROOT, stdio: "inherit", env: { ...process.env, PYTHONPATH: "server" } });
process.exit(result.status ?? 1);
