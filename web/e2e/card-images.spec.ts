// カード画像の実ブラウザでの確認（実際の接続層 + 固定版のエンジン + 固定コミットの kyuura-card-renderer。模擬の応答・模擬の描画を使わない）。
// 対戦は通常の操作（作成 → 初期配置）で進める。素材画像・カード定義の遅れと失敗は、ブラウザの通信の差し替え（page.route）で作る。
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

// 素材画像の URL（開発サーバーでは同じ URL に ?import を付けた JS のモジュールの要求もあるので、resourceType で分ける）
const IMAGE = /\.(png|jpe?g)(\?.*)?$/;
const viewer = (page: Page) => page.locator(".viewer-area");
const host = (page: Page) => page.locator(".host-area");

async function selectSeat(page: Page, label: string) {
  await page.locator(".seat-switcher").getByRole("radio", { name: label }).check();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
}

async function createFromDecks(page: Page) {
  await page.goto("/");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await expect(page.getByRole("textbox").first()).not.toHaveValue("");
    await page.getByRole("button", { name: /対戦を作成/ }).click();
    const status = viewer(page).getByRole("region", { name: "対戦の状態" });
    await expect(status).toBeVisible();
    if ((await status.getByText("停止", { exact: true }).count()) === 0) return;
    await page.getByRole("button", { name: "新しい対戦…" }).click(); // 準備で停止する seed（仕様どおりの停止）は作り直す
  }
  throw new Error("準備で停止しない対戦を作れなかった");
}

/** Canvas が表示されていて、透明でない画素がある（実際に描かれた）。 */
async function expectPainted(canvas: Locator) {
  await expect(canvas).toBeVisible();
  const painted = await canvas.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");
    if (!ctx || c.width === 0 || c.height === 0) return 0;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 7) if (data[i]! > 0) n += 1;
    return n;
  });
  expect(painted).toBeGreaterThan(50);
}

async function expectBackLoaded(region: Locator) {
  const img = region.locator("img").first();
  await expect(img).toBeVisible();
  expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
}

const drawn = (scope: Locator) => scope.locator("canvas:not([hidden])");

async function placeStarting(page: Page, seat: string, viaImage = false) {
  await selectSeat(page, seat);
  await viewer(page).locator(".candidate-list > li").filter({ hasText: "最初のポケモンを置く" }).getByRole("button", { name: "この操作を選ぶ" }).click();
  const panel = viewer(page).locator(".decision");
  const first = panel.locator("fieldset").first().locator(".options > li").first();
  if (viaImage) await first.locator(".card-image").click(); // 画像を押しても、同じ選択肢の入力を選ぶだけ
  else await first.getByRole("radio").check();
  await expect(first.getByRole("radio")).toBeChecked();
  await panel.getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".decision")).toHaveCount(0);
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
}

test("自分の手札と公開の場は表面、相手の手札とうらのポケモンは裏面", async ({ page }) => {
  await createFromDecks(page);
  await selectSeat(page, "プレイヤー0");
  const hand = page.getByLabel("プレイヤー0の手札", { exact: true });
  const count = await hand.locator("li").count();
  expect(count).toBeGreaterThan(0);
  await expect(drawn(hand)).toHaveCount(count);
  for (const canvas of await drawn(hand).all()) await expectPainted(canvas);
  await expect(hand.locator("canvas").first()).toHaveAttribute("aria-label", /の印刷のカード画像（非公式のカード風の画像）$/);
  // 相手の手札は枚数だけ: 裏面の画像（共有の 1 枚の画像）で、カードの情報を持たない
  const opponentHand = viewer(page).getByRole("img", { name: /^プレイヤー1・手札（裏向き \d+ 枚）$/ });
  await expectBackLoaded(opponentHand);
  await expect(opponentHand.locator("canvas, code")).toHaveCount(0);

  // 初期配置（両者）。最初の番の前は、相手のバトル場のポケモンはうら（観測が face_down）
  await placeStarting(page, "プレイヤー0", true);
  await placeStarting(page, "プレイヤー1");
  await selectSeat(page, "プレイヤー0");
  const opponent = viewer(page).locator(".player-area.opponent");
  const faceDown = opponent.getByRole("img", { name: "裏向きのポケモン" });
  await expectBackLoaded(faceDown);
  await expect(opponent.locator(".active-slot canvas")).toHaveCount(0);
  await expect(opponent.locator(".active-slot code")).toHaveCount(0); // カード ID を出さない
  const mine = viewer(page).locator(".player-area.mine .active-slot");
  await expectPainted(drawn(mine).first());
  await expect(mine.getByText("印刷の画像")).toBeVisible();
  await expect(mine.getByLabel("今の状態（観測の値）")).toContainText("HP");
});

test("閲覧者の切り替え: 素材画像とカード定義を遅らせても、前の閲覧者のカードの画像が新しい画面に出ない", async ({ page }) => {
  let delayAssets = false;
  const delayed = async (route: Route) => {
    if (delayAssets && route.request().resourceType() === "image") await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  };
  await page.route(IMAGE, delayed);
  await page.route("**/api/card-definitions", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await createFromDecks(page);
  delayAssets = true;
  await selectSeat(page, "プレイヤー0");
  await expect(page.getByLabel("プレイヤー0の手札", { exact: true })).toBeVisible();
  // 定義・素材の読み込み中に切り替える
  await expect(page.getByLabel("プレイヤー0の手札", { exact: true }).getByText("画像を準備中").first()).toBeVisible();
  await selectSeat(page, "プレイヤー1");
  await expect(page.getByLabel("プレイヤー0の手札", { exact: true })).toHaveCount(0);
  const hand1 = page.getByLabel("プレイヤー1の手札", { exact: true });
  await expect(hand1).toBeVisible();
  const count = await hand1.locator("li").count();
  await expect(drawn(hand1)).toHaveCount(count, { timeout: 20_000 });
  // 遅れて終わった前の閲覧者の描画が戻らない: 表示中の Canvas はすべてプレイヤー1自身の手札のもの
  await page.waitForTimeout(2000);
  const all = drawn(viewer(page));
  await expect(all).toHaveCount(count);
  await expect(hand1.locator("canvas:not([hidden])")).toHaveCount(count);
  // 観戦者へ: 手札の表面はない
  await selectSeat(page, "観戦者");
  await page.waitForTimeout(500);
  await expect(drawn(viewer(page))).toHaveCount(0);
  await expect(page.getByLabel(/の手札$/)).toHaveCount(0);
});

test("読み込みの失敗: カード定義を取得できない・素材画像を読めないときは文字の表示で、操作は続けられる", async ({ page }) => {
  await page.route("**/api/card-definitions", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ gui_server: 1, ok: false, error: { code: "GUI_CARD_DATA_UNAVAILABLE", message: "x" } }) }),
  );
  await createFromDecks(page);
  await selectSeat(page, "プレイヤー0");
  const hand = page.getByLabel("プレイヤー0の手札", { exact: true });
  await expect(hand.getByText("画像なし（カード定義を取得できません）").first()).toBeVisible();
  await expect(hand.locator("canvas")).toHaveCount(0);
  await placeStarting(page, "プレイヤー0", true);
  await expect(viewer(page).getByRole("region", { name: "診断と結果" }).locator(".callout").first()).toContainText(/受理/);

  // 素材画像を読めない（定義はある）: 表面は「描けませんでした」、裏面は文字の「裏」。自動で読み直さない
  await page.unroute("**/api/card-definitions");
  let assetRequests = 0;
  await page.route(IMAGE, (route) => {
    if (route.request().resourceType() !== "image") return route.continue(); // 開発サーバーの素材の import（JS のモジュール）は通す
    assetRequests += 1;
    return route.abort();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /対戦を作成/ })).toBeVisible();
  await createFromDecks(page);
  await selectSeat(page, "プレイヤー0");
  const hand2 = page.getByLabel("プレイヤー0の手札", { exact: true });
  await expect(hand2.getByText("画像を描けませんでした").first()).toBeVisible({ timeout: 20_000 });
  await expect(drawn(hand2)).toHaveCount(0);
  await expect(viewer(page).getByRole("img", { name: /^プレイヤー1・手札/ })).toContainText("裏");
  const settled = assetRequests;
  await page.waitForTimeout(1500);
  expect(assetRequests).toBe(settled); // 失敗のあとに読み直しを繰り返さない
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("最初のポケモンを置く");
});

test("狭い画面: 画像の表示と、選択肢の画像からの選択", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createFromDecks(page);
  await selectSeat(page, "プレイヤー0");
  const hand = page.getByLabel("プレイヤー0の手札", { exact: true });
  await expectPainted(drawn(hand).first());
  const box = await drawn(hand).first().boundingBox();
  expect(box && box.width).toBeLessThanOrEqual(80);
  await placeStarting(page, "プレイヤー0", true);
  await expect(viewer(page).getByRole("region", { name: "診断と結果" }).locator(".callout").first()).toContainText(/受理/);
  await expectPainted(drawn(viewer(page).locator(".player-area.mine .active-slot")).first());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(host(page)).toBeVisible();
});
