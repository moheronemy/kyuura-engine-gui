// 実エンジンとの接続確認（模擬の応答を使わない）。Python の接続層と Vite を別のポートで起動し、ブラウザから操作する。
// ブラウザは、手元に入っている Microsoft Edge（channel: msedge）を使う（ブラウザの追加の取得をしない）。
// 別のブラウザを使うときは KYUURA_E2E_CHANNEL=chrome など。
import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const serverPort = process.env.KYUURA_E2E_SERVER_PORT ?? "8766";
// テスト専用: 接続層の new_game の seed を固定する（server/tests/conftest.py の FIXED_SEED と同じ）。seed はブラウザへ返らない。
// プリセットの 1・2 番目のデッキと e2e の選び方で: 補償 1 回 → 番 1 にベンチ・エネルギー → 番 3 に進化・にげる（エンジン 0.165.0・b4e62d9 で確かめ、
// 0.166.0・9506d63 でも同じ）。U7-4: 番 1 にジャブ → 番 3 にジャブできぜつ → サイド → 終局、ファイヤーのデッキ 対 プリセットの 1 番目で
// 番 3 にドライアップ → 対象の決定 → 受理のあと停止（0.166.0・9506d63 で確かめた。attacks.spec.ts・server/tests/test_attacks.py）
// 0.170.0・0885d66 でも同じ（プリセットの番 1 に play_trainer の候補が加わる）。U7-5 の e2e（u75.spec.ts）は検証用の固定例から始め、固定例が自分の
// デッキと seed を持つ（server/kyuura_gui_server/scenarios.py。この seed は使わない）
// 0.171.0・74c8e1f でも同じ。U7-5e の e2e（u75e.spec.ts）も固定例から始める
export const E2E_FIXED_SEED = "21";
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
      command: `"${python}" -m kyuura_gui_server --port ${serverPort} --test-fixed-seed ${E2E_FIXED_SEED}`,
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
