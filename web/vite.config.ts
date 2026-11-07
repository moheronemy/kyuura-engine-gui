/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 開発時は Vite（127.0.0.1:5173）から Python のローカル接続層（127.0.0.1:8765）へ /api をプロキシする。
// ブラウザは Python を直接 import しない。接続層のポートは KYUURA_GUI_SERVER_PORT で変えられる。
const serverPort = process.env.KYUURA_GUI_SERVER_PORT ?? "8765";
const webPort = Number(process.env.KYUURA_GUI_WEB_PORT ?? "5173");

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${serverPort}`, changeOrigin: false },
    },
  },
  preview: { host: "127.0.0.1", port: 4173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
