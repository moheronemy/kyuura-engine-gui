// 0.189.0（R-2: 本人のうらのバトル場のワザの宣言のクチバシティジムのコイン。0.188.0 の提示・0.189.0 の先読みの修正）を、実際の接続層 + 固定版のエンジン（0.189.0・021510c）
// + 実際の renderer で確かめる（2 件だけ）。盤面は構築盤面（server/tests/r2_boards.py。エンジンの v0.189 の回帰テストの盤面と同じ状態・乱数。new_game からの到達ではない）。
// テスト専用の入口（server/tests/reveal_server.py。R-2 の盤面も加える）で接続層を起動するときだけ動く（1 件ずつ、別のポートで流す）:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/r2-coin.spec.ts -g "受理"
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/r2-coin.spec.ts -g "VM1"
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, mine, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "0.189.0 の R-2 の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const coins = (page: Page) => viewer(page).getByRole("region", { name: "コインの結果（公開のログ）" });
const COIN = /場のスタジアムのコインを投げる（クチバシティジム）/;

function watch(page: Page) {
  const sent = { checks: [] as unknown[], submits: [] as unknown[] };
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
  return sent;
}

test("受理: うらのマチスのコイルのたいあたりでコインを選び、公開・コインの結果（おもて）を示す", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "R-2 構築盤面 A（");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /たいあたり/ }).check();
  await expect(stage(page, 2).getByRole("radio", { name: "選ばない" })).toBeChecked(); // 任意（自動で選ばない）
  await expect(stage(page, 2)).toContainText("選んでも、コインを投げることは保証しない");
  await stage(page, 2).getByRole("radio", { name: COIN }).check();
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("コインを投げられるか・受理・完走の保証ではありません");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: マチスのコイル"); // 公開（観測のとおり）
  await expect(coins(page).locator("li")).toHaveCount(1);
  await expect(coins(page).locator("li")).toContainText("プレイヤー0のコイン（場のスタジアム: クチバシティジム PMCG5-076）: おもて");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(coins(page).locator("li")).toHaveCount(1);
    await expect(coins(page).locator("li")).toContainText(": おもて");
    expect(await viewer(page).innerHTML()).not.toMatch(/形の検査を通りました/);
  }
  expect(sent.checks).toEqual([["o2", "o3"]]);
  expect(sent.submits).toEqual([["o2", "o3"]]); // 自動で再送しない
});

test("VM1: かまいたち + コインの拒否は本人だけに示し、コインなしへ直して送ると受理する", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "R-2 構築盤面 B（");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /かまいたち/ }).check();
  await stage(page, 2).getByRole("radio", { name: COIN }).check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("拒否（エンジン）: ワザを使う");
  await expect(results(viewer(page))).toContainText("UNRESOLVED_VERMILION_GYM_ATTACK_ORDER");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン"); // 状態は変わらない
  await expect(coins(page).locator("li")).toHaveCount(0);
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const html = await viewer(page).innerHTML();
    expect(html).not.toMatch(/拒否（エンジン）|UNRESOLVED_VERMILION_GYM_ATTACK_ORDER|マチスのオニスズメ|かまいたち/);
    await expect(coins(page).locator("li")).toHaveCount(0);
    await expect(viewer(page).getByLabel("バトル場: 裏向きのポケモン")).toHaveCount(1);
  }
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /かまいたち/ }).check();
  await expect(stage(page, 2).getByRole("radio", { name: "選ばない" })).toBeChecked();
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled(); // 拒否の前の check は使わない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: マチスのオニスズメ");
  await expect(coins(page).locator("li")).toHaveCount(1);
  await expect(coins(page).locator("li")).toContainText("プレイヤー0のコイン（ワザ）: うら");
  expect(sent.submits).toEqual([["o2", "o3"], ["o2"]]);
});
