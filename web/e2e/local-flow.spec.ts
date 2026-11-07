// 実エンジンとの接続確認（Python の接続層 + 固定版の kyuura-engine。模擬の応答を使わない）。
// UI の単体テスト（src/**/*.test.tsx の模擬の応答）とは別。
import { expect, test, type Locator, type Page } from "@playwright/test";

const viewer = (page: Page) => page.locator(".viewer-area");
const host = (page: Page) => page.locator(".host-area");

async function selectSeat(page: Page, label: string) {
  await page.locator(".seat-switcher").getByRole("radio", { name: label }).check();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
}

function candidate(area: Locator, label: string): Locator {
  return area.locator(".candidate-list > li").filter({ hasText: label });
}

async function submitAndExpect(area: Locator, outcome: RegExp) {
  await area.locator(".decision").getByRole("button", { name: "送信" }).click();
  // 前の送信の通知が先頭に残っていることがあるので、受理で入力のパネルが閉じ、候補を取り直し終えるまで待つ
  await expect(area.locator(".decision")).toHaveCount(0);
  await expect(area.locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(area.getByRole("region", { name: "診断と結果" }).locator(".callout").first()).toContainText(outcome);
}

async function createFromDecks(page: Page) {
  // 接続層は seed を固定して起動している（playwright.config.ts。テスト専用）。作り直しを繰り返さず、1 回の作成で準備に入ることを確かめる
  await page.goto("/");
  await expect(page.getByRole("textbox").first()).not.toHaveValue("");
  await page.getByRole("button", { name: /対戦を作成/ }).click();
  const status = viewer(page).getByRole("region", { name: "対戦の状態" });
  await expect(status).toBeVisible();
  await expect(status.getByText("停止", { exact: true })).toHaveCount(0);
}

async function createScenario(page: Page, label: string) {
  await page.goto("/");
  await page.getByRole("radio", { name: "検証用の固定例から始める" }).check();
  await page.getByRole("radio", { name: new RegExp(label) }).check();
  await page.getByRole("button", { name: /対戦を作成/ }).click();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
}

test("準備を終えて番を終えるまで（両プレイヤーの初期配置・補償・ホストのジャンケン）", async ({ page }) => {
  await createFromDecks(page);
  for (const seat of ["プレイヤー0", "プレイヤー1"]) {
    await selectSeat(page, seat);
    await candidate(viewer(page), "最初のポケモンを置く").getByRole("button", { name: "この操作を選ぶ" }).click();
    const panel = viewer(page).locator(".decision");
    await panel.locator("fieldset").first().getByRole("radio").first().check();
    await submitAndExpect(viewer(page), /受理/);
  }
  // 切り直しの補償（相手が切り直したときだけ出る）。固定の seed では 1 回通る（到達を確かめる）
  let mulligans = 0;
  for (const seat of ["プレイヤー0", "プレイヤー1"]) {
    await selectSeat(page, seat);
    await expect(viewer(page).getByRole("region", { name: "操作候補" })).toBeVisible();
    const mulligan = candidate(viewer(page), "切り直しの補償");
    while ((await mulligan.count()) > 0) {
      await mulligan.getByRole("button", { name: "この操作を選ぶ" }).click();
      const select = viewer(page).locator(".decision select");
      await expect(select.locator("option").nth(1)).toBeAttached(); // 入力（値の範囲）が届くまで待つ
      const options = await select.locator("option").allTextContents();
      await select.selectOption(options[options.length - 1]!.trim());
      await submitAndExpect(viewer(page), /受理/);
      await expect(viewer(page).getByRole("region", { name: "操作候補" })).toBeVisible();
      mulligans += 1;
    }
  }
  expect(mulligans).toBe(1);
  // ホストの別枠: ジャンケンの結果（プレイヤー0の勝ち）
  await candidate(host(page), "ジャンケンの結果を入力").getByRole("button", { name: "この操作を選ぶ" }).click();
  await host(page).locator(".decision").getByRole("radio", { name: "プレイヤー0" }).check();
  await submitAndExpect(host(page), /受理/);
  // プレイヤー0の番: 番を終える
  await selectSeat(page, "プレイヤー0");
  const status = viewer(page).getByRole("region", { name: "対戦の状態" });
  await expect(status).toContainText("プレイヤー0の番");
  await expect(viewer(page).getByLabel("未対応の操作")).toContainText("ワザを使う");
  await expect(viewer(page).getByText("partial", { exact: true })).toBeVisible();
  await candidate(viewer(page), "番を終える").getByRole("button", { name: "この操作を選ぶ" }).click();
  await submitAndExpect(viewer(page), /受理/);
  await expect(status).toContainText("プレイヤー1の番");
  await expect(viewer(page).getByRole("region", { name: "対戦ログ" })).toContainText("#");
});

test("閲覧者を切り替えると前の閲覧者の手札が画面に残らない", async ({ page }) => {
  await createFromDecks(page);
  await selectSeat(page, "プレイヤー0");
  await expect(page.getByLabel("プレイヤー0の手札")).toBeVisible();
  await selectSeat(page, "プレイヤー1");
  await expect(page.getByLabel("プレイヤー1の手札")).toBeVisible();
  await expect(page.getByLabel("プレイヤー0の手札")).toHaveCount(0);
  await selectSeat(page, "観戦者");
  await expect(page.getByLabel(/の手札$/)).toHaveCount(0);
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toHaveCount(0);
});

test("決定への回答（固定例: サイドを取る → 相手がバトル場に出すポケモンを選ぶ）", async ({ page }) => {
  await createScenario(page, "決定待ち");
  await selectSeat(page, "プレイヤー1");
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("ほかのプレイヤーの操作待ち");
  await selectSeat(page, "プレイヤー0");
  await candidate(viewer(page), "サイドを取る").getByRole("button", { name: "この操作を選ぶ" }).click();
  await viewer(page).locator(".decision").getByRole("radio", { name: /位置 1/ }).check();
  await submitAndExpect(viewer(page), /受理/);
  await selectSeat(page, "プレイヤー1");
  await candidate(viewer(page), "バトル場に出すポケモンを選ぶ").getByRole("button", { name: "この操作を選ぶ" }).click();
  await viewer(page).locator(".decision").getByRole("radio").first().check();
  await submitAndExpect(viewer(page), /受理/);
});

test("停止の表示（固定例: 準備で停止）", async ({ page }) => {
  await createScenario(page, "準備で停止");
  const status = viewer(page).getByRole("region", { name: "対戦の状態" });
  await expect(status.getByRole("alert")).toContainText("未裁定");
  await expect(status.getByRole("alert")).toContainText("ゲーム上の禁止ではありません");
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("終局・停止のため");
});

test("サドン・デスの開始（固定例: ホストが延長戦を始める）", async ({ page }) => {
  await createScenario(page, "サドン・デス待ち");
  const status = viewer(page).getByRole("region", { name: "対戦の状態" });
  await expect(status).toContainText("サドン・デス待ち");
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("ホストの操作");
  await candidate(host(page), "サドン・デスを始める").getByRole("button", { name: "この操作を選ぶ" }).click();
  await submitAndExpect(host(page), /受理/);
  await expect(status).toContainText("延長戦 1");
});
