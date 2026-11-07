// server/.venv の Python の場所（Windows と macOS・Linux で違う）。
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const VENV = join(ROOT, "server", ".venv");
export const VENV_PYTHON = process.platform === "win32" ? join(VENV, "Scripts", "python.exe") : join(VENV, "bin", "python");

export function requireVenv() {
  if (!existsSync(VENV_PYTHON)) {
    console.error("server/.venv がありません。先に npm run setup を実行してください。");
    process.exit(1);
  }
  return VENV_PYTHON;
}
