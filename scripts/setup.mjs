// 依存の導入: server/.venv を作って requirements-dev.txt（固定コミットの kyuura-engine を含む）を入れ、web の npm の依存を入れる。
// グローバルの環境には入れない。Python 3.11 以上・Node 20 以上・git が要る。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, VENV, VENV_PYTHON } from "./venv.mjs";

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  // Windows の npm は .cmd なのでシェルで起動する（引数は固定の文字列だけ）
  const r = cmd === "npm" ? spawnSync([cmd, ...args].join(" "), { cwd: ROOT, stdio: "inherit", shell: true, ...opts }) : spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function findPython() {
  const candidates = process.env.PYTHON ? [[process.env.PYTHON]] : process.platform === "win32" ? [["py", "-3"], ["python"]] : [["python3"], ["python"]];
  for (const [cmd, ...pre] of candidates) {
    const r = spawnSync(cmd, [...pre, "-c", "import sys; assert sys.version_info >= (3, 11); print(sys.version)"], { encoding: "utf-8" });
    if (r.status === 0) return [cmd, pre];
  }
  console.error("Python 3.11 以上が見つかりません（環境変数 PYTHON で指定できます）。");
  process.exit(1);
}

if (!existsSync(VENV_PYTHON)) {
  const [cmd, pre] = findPython();
  run(cmd, [...pre, "-m", "venv", VENV]);
}
run(VENV_PYTHON, ["-m", "pip", "install", "--upgrade", "pip"]);
run(VENV_PYTHON, ["-m", "pip", "install", "-r", join("server", "requirements-dev.txt")], { cwd: ROOT });
run("npm", ["install", "--no-fund", "--no-audit"], { cwd: join(ROOT, "web") });
console.log("\n導入しました。npm run dev で起動します。");
