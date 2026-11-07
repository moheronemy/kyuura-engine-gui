// ローカル起動: Python の接続層（127.0.0.1:8765）と Vite（127.0.0.1:5173。/api をプロキシ）を一緒に起動する。
// Ctrl+C で両方を止める。ローカル専用で、外部へ公開しない。
import { spawn } from "node:child_process";
import { join } from "node:path";
import { ROOT, requireVenv } from "./venv.mjs";

const port = process.env.KYUURA_GUI_SERVER_PORT ?? "8765";
const python = requireVenv();
const children = [];

function start(name, cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: "inherit", ...opts });
  child.on("exit", (code) => {
    console.log(`[${name}] 終了（${code}）`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

function stopAll(code) {
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exit(code);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

start("server", python, ["-m", "kyuura_gui_server", "--port", port], { cwd: join(ROOT, "server") });
start("web", "npm run dev", [], {
  cwd: join(ROOT, "web"),
  shell: true, // Windows の npm は .cmd（引数は固定の文字列だけ）
  env: { ...process.env, KYUURA_GUI_SERVER_PORT: port },
});
console.log("ブラウザで http://127.0.0.1:5173/ を開いてください（ローカル専用）。");
