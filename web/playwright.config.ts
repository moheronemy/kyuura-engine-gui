// 実エンジンとの接続確認（模擬の応答を使わない）。Python の接続層と Vite を別のポートで起動し、ブラウザから操作する。
// ブラウザは、手元に入っている Microsoft Edge（channel: msedge）を使う（ブラウザの追加の取得をしない）。
// 別のブラウザを使うときは KYUURA_E2E_CHANNEL=chrome など。
import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const serverPort = process.env.KYUURA_E2E_SERVER_PORT ?? "8766";
const webPort = process.env.KYUURA_E2E_WEB_PORT ?? "5174";
const python = process.platform === "win32" ? join("..", "server", ".venv", "Scripts", "python.exe") : join("..", "server", ".venv", "bin", "python");

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    channel: process.env.KYUURA_E2E_CHANNEL ?? "msedge",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `"${python}" -m kyuura_gui_server --port ${serverPort}`,
      cwd: join("..", "server"),
      url: `http://127.0.0.1:${serverPort}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // KYUURA_E2E_PREVIEW=1 なら本番ビルド（先に npm run build）を vite preview で配る
      command: process.env.KYUURA_E2E_PREVIEW === "1" ? "npx vite preview" : "npx vite",
      env:{ KYUURA_GUI_SERVER_PORT: serverPort, KYUURA_GUI_WEB_PORT: webPort },
      url: `http://127.0.0.1:${webPort}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
