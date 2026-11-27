// 0.186.0（開発用の規約集合 CS-KYUURA-PLAY-TR3@1）の規約による使用不可の表示と送信の制御を、実際の接続層 + 固定版のエンジン（0.186.0・a1b7659）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/tr3_boards.py の tr3_gust・cur_mixed・tr3_mixed。エンジンの v0.186 の回帰テストの盤面と同じ状態・同じ規約集合。new_game からの到達ではない）。
// テスト専用の入口（server/tests/reveal_server.py。TR3 の盤面も加える）で接続層を起動するときだけ動く（1 件ずつ、別のポートで流す）:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/tr3.spec.ts -g "使用不可"
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/tr3.spec.ts -g "CURRENT"
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, panel, results, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "0.186.0 の TR3 の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const statusSet = (page: Page) => viewer(page).getByRole("region", { name: "対戦の状態" });
const row = (page: Page, name: string) => panel(page).locator("ul.options > li").filter({ has: page.locator("label.option", { hasText: name }) });

function watch(page: Page) {
  const sent = { checks: [] as unknown[], submits: [] as unknown[], withheld: 0 };
  page.on("request", (r) => {
    if (r.method() !== "POST") return;
    const body = (() => {
      try {
        return JSON.parse(r.postData() ?? "{}") as { type?: string; choices?: unknown };
      } catch {
        return {};
      }
    })();
    if (body.type === "check") sent.checks.push(body.choices);
    if (body.type === "submit") sent.submits.push(body.choices);
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/") && r.status() === 500 && /GUI_RESPONSE_WITHHELD|GUI_.*INVALID/.test(await r.text().catch(() => ""))) sent.withheld += 1;
  });
  return sent;
}

test("TR3・突風（相手のベンチが空）: 規約により使用不可と規約 ID を示し、選べず、送信しない", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "TR3 構築盤面 突風 対象なし（");
  await expect(statusSet(page)).toContainText("CS-KYUURA-PLAY-TR3@1");
  await expect(statusSet(page)).toContainText("対象がない突風・ポケモンいれかえ・きずぐすりを使用不可とするプレイ用規約");
  await choose(viewer(page), "手札のトレーナーを使う");
  const gust = row(page, "突風");
  await expect(gust).toContainText("規約により使用不可");
  await expect(gust).toContainText("規約 PC-GUST-WITHOUT-OPPONENT-BENCH@1");
  await expect(gust.locator("input")).toBeDisabled();
  await expect(panel(page).locator(".badges")).toContainText("規約により使用不可");
  await expect(panel(page).locator(".badges")).not.toContainText("エンジンが未対応です");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  expect(sent.checks.every((c) => Array.isArray(c) && c.length === 0)).toBe(true); // 除外の選べるものは入力に入らない
  expect(sent.submits).toEqual([]);
  expect(sent.withheld).toBe(0);
});

test("CURRENT の未裁定との違いと、TR3 でも使える別のカード（ポケモンいれかえ）を送れる", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "TR3 構築盤面 混在 突風・きずぐすり・ポケモンいれかえ CURRENT（");
  await expect(statusSet(page)).toContainText("CS-KYUURA-CURRENT@1");
  await choose(viewer(page), "手札のトレーナーを使う");
  for (const name of ["突風", "きずぐすり"]) {
    await expect(row(page, name)).toContainText("未裁定");
    await expect(row(page, name)).not.toContainText("規約");
    await expect(row(page, name).locator("input")).toBeDisabled();
  }
  await createScenario(page, "TR3 構築盤面 混在 突風・きずぐすり・ポケモンいれかえ（");
  await expect(statusSet(page)).toContainText("CS-KYUURA-PLAY-TR3@1");
  await choose(viewer(page), "手札のトレーナーを使う");
  await expect(row(page, "突風")).toContainText("規約 PC-GUST-WITHOUT-OPPONENT-BENCH@1");
  await expect(row(page, "きずぐすり")).toContainText("規約 PC-POTION-WITHOUT-DAMAGE@1");
  for (const name of ["突風", "きずぐすり"]) {
    await expect(row(page, name)).toContainText("規約により使用不可");
    await expect(row(page, name).locator('[class*="proc-"]')).toHaveCount(0); // 処理可能性のバッジ（未裁定など）を出さない
    await expect(row(page, name).locator("input")).toBeDisabled();
  }
  const sw = row(page, "ポケモンいれかえ");
  await expect(sw.locator("input")).toBeEnabled();
  await expect(sw.locator("input")).not.toBeChecked(); // 代わりのカードを自動で選ばない
  await sw.locator("input").check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理/);
  expect(sent.submits).toHaveLength(1); // 自動で再送しない
  expect(sent.withheld).toBe(0);
});
