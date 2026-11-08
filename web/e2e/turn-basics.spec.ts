// U7-3 の番の基本の操作 4 種類を、実際の接続層 + 固定版のエンジン（0.165.0 で作り、0.166.0 で同じ操作の列を確かめる）+ 実際の renderer で確かめる。
// 対戦は通常の new_game から画面の操作だけで進める（構築盤面・検証用の固定例ではない）。接続層はテスト専用の設定で seed を固定して
// 起動している（playwright.config.ts。seed・操作の列はブラウザへ返らない）。ランダムな対戦を作り直して探すことはしない。
// 候補は公開の kind の表示名で選び、入力の段の選択肢はエンジンが返した選べるもの・組だけから選ぶ。
import { expect, test, type Locator, type Page } from "@playwright/test";

const viewer = (page: Page) => page.locator(".viewer-area");
const host = (page: Page) => page.locator(".host-area");
const panel = (page: Page) => viewer(page).locator(".decision");
const stage = (page: Page, n: number) => panel(page).locator("fieldset.stage").nth(n - 1);
const drawn = (scope: Locator) => scope.locator("canvas:not([hidden])");

async function selectSeat(page: Page, label: string) {
  await page.locator(".seat-switcher").getByRole("radio", { name: label }).check();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
}

function candidate(area: Locator, label: string): Locator {
  return area.locator(".candidate-list > li").filter({ has: area.page().locator(".candidate-head", { hasText: label }) });
}

async function choose(area: Locator, label: string) {
  await candidate(area, label).getByRole("button", { name: "この操作を選ぶ" }).click();
  await expect(area.locator(".decision")).toBeVisible();
  await expect(area.locator(".decision")).not.toHaveAttribute("aria-busy", "true");
}

async function submitAndExpect(area: Locator, outcome: RegExp) {
  await area.locator(".decision").getByRole("button", { name: "送信" }).click();
  await expect(area.locator(".decision")).toHaveCount(0); // 受理で選択・候補を捨てる
  await expect(area.locator(".console")).toHaveAttribute("aria-busy", "false"); // 取り直しが終わる
  await expect(area.getByRole("region", { name: "診断と結果" }).locator(".callout").first()).toContainText(outcome);
}

async function expectPainted(canvas: Locator) {
  await expect(canvas).toBeVisible();
  const painted = await canvas.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");
    if (!ctx || !c.width) return 0;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 28) if (d[i]! > 0) n += 1;
    return n;
  });
  expect(painted).toBeGreaterThan(50);
}

/** new_game（seed 固定）→ 両者の初期配置 → 補償（1 回）→ ホストのジャンケン（プレイヤー0）。 */
async function setupToFirstTurn(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("textbox").first()).not.toHaveValue("");
  await page.getByRole("button", { name: /対戦を作成/ }).click();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
  for (const seat of ["プレイヤー0", "プレイヤー1"]) {
    await selectSeat(page, seat);
    await choose(viewer(page), "最初のポケモンを置く");
    await stage(page, 1).getByRole("radio").first().check();
    await submitAndExpect(viewer(page), /受理/);
  }
  let mulligans = 0;
  for (const seat of ["プレイヤー0", "プレイヤー1"]) {
    await selectSeat(page, seat);
    while ((await candidate(viewer(page), "切り直しの補償").count()) > 0) {
      await choose(viewer(page), "切り直しの補償");
      const select = panel(page).locator("select");
      await expect(select.locator("option").nth(1)).toBeAttached();
      const options = await select.locator("option").allTextContents();
      await select.selectOption(options[options.length - 1]!.trim());
      await submitAndExpect(viewer(page), /受理/);
      mulligans += 1;
    }
  }
  expect(mulligans).toBe(1);
  await choose(host(page), "ジャンケンの結果を入力");
  await host(page).locator(".decision").getByRole("radio", { name: "プレイヤー0" }).check();
  await submitAndExpect(host(page), /受理/);
  await selectSeat(page, "プレイヤー0");
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toContainText("プレイヤー0の番");
}

const mine = (page: Page) => viewer(page).locator(".player-area.mine");

test("通常の new_game（seed 固定）から: ベンチに出す → エネルギー → 番を終える → 進化 → エネルギー → にげる", async ({ page }) => {
  await setupToFirstTurn(page);
  const area = viewer(page);
  // coverage: 評価した種類・候補に出した種類・未対応を分ける（番は partial）
  await expect(area.getByLabel("評価して候補に出さなかった種類")).toContainText("進化させる");
  await expect(area.getByLabel("未対応の操作")).toContainText("表向きの山札のカードを確かめる"); // U7-4 でワザ（attacks.spec.ts）、U7-5 でトレーナー・スタジアム（u75.spec.ts）は評価する種類になった
  await expect(area.getByLabel("未対応の操作")).not.toContainText("にげる");
  await expect(area.getByLabel("未対応の操作")).not.toContainText("ワザを使う");

  // 1. ベンチに出す（画像を押すと、その選択肢の radio を選ぶだけ）
  await expect(mine(page).locator(".bench-slot")).toContainText("ベンチ（0）");
  await choose(area, "たねポケモンをベンチに出す");
  await expect(stage(page, 1)).toContainText("ベンチ: 0/5");
  const first = stage(page, 1).locator(".options > li").first();
  await first.locator(".card-image").click();
  await expect(first.getByRole("radio")).toBeChecked();
  await submitAndExpect(area, /受理/);
  await expect(mine(page).locator(".bench-slot")).toContainText("ベンチ（1）");
  await expectPainted(drawn(mine(page).locator(".bench .pokemon").first()).first());

  // 2. エネルギーをつける（2 段。1 段目を変えると 2 段目を捨てる。check は今の入力への答えだけ）
  await choose(area, "エネルギーをつける");
  await expect(stage(page, 2)).toContainText("段 1 を選ぶと");
  await stage(page, 1).getByRole("radio").nth(0).check();
  await stage(page, 2).getByRole("radio").first().check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await stage(page, 1).getByRole("radio").nth(1).check();
  await expect(stage(page, 2).getByRole("radio").first()).not.toBeChecked();
  await expect(panel(page).locator(".check-result")).toHaveCount(0);
  await expect(panel(page).getByText("前の検査の結果は使いません")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  await stage(page, 2).getByRole("radio", { name: /バトル場/ }).check();
  await submitAndExpect(area, /受理/);
  await expect(mine(page).locator(".active-slot")).toContainText("エネルギー（1）");
  // 同じ番の 2 回目は候補に出ない（エンジンの確かめ。GUI は推測しない）
  await expect(candidate(area, "エネルギーをつける")).toHaveCount(0);

  // 番を終える（両者）
  await choose(area, "番を終える");
  await submitAndExpect(area, /受理/);
  await selectSeat(page, "プレイヤー1");
  await choose(viewer(page), "番を終える");
  await submitAndExpect(viewer(page), /受理/);
  await selectSeat(page, "プレイヤー0");

  // 3. 進化（2 段）。受理のあと、場の画像が新しいカードになり、今の HP は観測の値
  const benchCard = mine(page).locator(".bench .pokemon").first();
  const beforeName = await benchCard.getAttribute("aria-label");
  const oldCanvas = await drawn(benchCard).first().elementHandle();
  await choose(area, "進化させる");
  await stage(page, 1).getByRole("radio").first().check();
  await stage(page, 2).getByRole("radio").first().check();
  await submitAndExpect(area, /受理/);
  await expect(benchCard).not.toHaveAttribute("aria-label", beforeName ?? "");
  const afterName = (await benchCard.getAttribute("aria-label"))!.replace(/^ベンチ1: /, "");
  expect(await oldCanvas!.evaluate((c) => (c as HTMLCanvasElement).isConnected)).toBe(false); // 古い Canvas を使い回さない
  const evolved = drawn(benchCard).first();
  await expectPainted(evolved);
  await expect(evolved).toHaveAttribute("aria-label", new RegExp(`^${afterName}の印刷のカード画像`));
  await expect(benchCard.getByLabel("今の状態（観測の値）")).toContainText("HP");

  // 閲覧者の切り替え: 相手から見ても公開の場の進化後のカードの画像、相手の手札は自分の表面
  await selectSeat(page, "プレイヤー1");
  const opponentBench = viewer(page).locator(".player-area.opponent .bench .pokemon").first();
  await expect(opponentBench).toHaveAttribute("aria-label", `ベンチ1: ${afterName}`);
  await expectPainted(drawn(opponentBench).first());
  await expect(viewer(page).getByRole("img", { name: /^プレイヤー0・手札（裏向き \d+ 枚）$/ })).toBeVisible();
  await expect(viewer(page).locator(".player-area.opponent .hand canvas")).toHaveCount(0);
  await selectSeat(page, "プレイヤー0");

  // 4. エネルギーをもう 1 枚（バトル場）→ にげる（個数・check・選んだ順）
  await choose(area, "エネルギーをつける");
  await stage(page, 1).getByRole("radio").first().check();
  await stage(page, 2).getByRole("radio", { name: /バトル場/ }).check();
  await submitAndExpect(area, /受理/);
  const activeBefore = await mine(page).locator(".active-slot .pokemon").getAttribute("aria-label");

  await choose(area, "にげる");
  await stage(page, 1).getByRole("radio").first().check();
  const units = panel(page).getByRole("status", { name: "エネルギーの個数" });
  await expect(units).toContainText("必要なエネルギーの個数（total_units）: 2 個");
  await stage(page, 2).getByRole("checkbox").nth(0).check();
  await expect(units).toContainText("選んでいる合計: 1 個（1 枚）");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  // 足りない入力の check: 拒否を送り手の画面だけに安全に示す（送れない）
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("CANDIDATE_INPUT_INVALID");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  await stage(page, 2).getByRole("checkbox").nth(1).check();
  await expect(units).toContainText("選んでいる合計: 2 個（2 枚）");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // 個数だけで合法と決めない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await submitAndExpect(area, /受理/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", `バトル場: ${afterName}`);
  await expect(mine(page).locator(".bench .pokemon").first()).toHaveAttribute("aria-label", (activeBefore ?? "").replace("バトル場", "ベンチ1"));
  await expectPainted(drawn(mine(page).locator(".active-slot")).first());
  await expect(mine(page).locator(".active-slot")).toContainText("エネルギー（0）");
});

test("狭い画面: エネルギーをつける 2 段の入力を、画像からの選択で送る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupToFirstTurn(page);
  await choose(viewer(page), "エネルギーをつける");
  const firstEnergy = stage(page, 1).locator(".options > li").first();
  await firstEnergy.locator(".card-image").click();
  await expect(firstEnergy.getByRole("radio")).toBeChecked();
  const target = stage(page, 2).locator(".options > li").first();
  await target.locator(".card-image").click();
  await expect(target.getByRole("radio")).toBeChecked();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await submitAndExpect(viewer(page), /受理/);
  await expect(mine(page).locator(".active-slot")).toContainText("エネルギー（1）");
});
