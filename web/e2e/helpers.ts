// e2e の共通の操作（attacks.spec.ts・u75.spec.ts が使う）。候補は公開の kind の表示名で選び、入力はエンジンが返した選べるものだけから選ぶ。
import { expect, type Locator, type Page } from "@playwright/test";

export const viewer = (page: Page) => page.locator(".viewer-area");
export const host = (page: Page) => page.locator(".host-area");
export const panel = (page: Page) => viewer(page).locator(".decision");
export const stage = (page: Page, n: number) => panel(page).locator("fieldset.stage").nth(n - 1);
export const drawn = (scope: Locator) => scope.locator("canvas:not([hidden])");
export const mine = (page: Page) => viewer(page).locator(".player-area.mine");
export const opponent = (page: Page) => viewer(page).locator(".player-area.opponent");
export const results = (area: Locator) => area.getByRole("region", { name: "診断と結果" }).locator(".callout").first();

export async function selectSeat(page: Page, label: string) {
  await page.locator(".seat-switcher").getByRole("radio", { name: label }).check();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
}

export function candidate(area: Locator, label: string): Locator {
  return area.locator(".candidate-list > li").filter({ has: area.page().locator(".candidate-head", { hasText: label }) });
}

export async function choose(area: Locator, label: string) {
  await candidate(area, label).getByRole("button", { name: "この操作を選ぶ" }).click();
  await expect(area.locator(".decision")).toBeVisible();
  await expect(area.locator(".decision")).not.toHaveAttribute("aria-busy", "true");
}

/** 送信して、受理で入力のパネルが閉じ、取り直しが終わってから、最新の結果の通知を確かめる。 */
export async function submitAndExpect(area: Locator, outcome: RegExp) {
  await area.locator(".decision").getByRole("button", { name: "送信" }).click();
  await expect(area.locator(".decision")).toHaveCount(0);
  await expect(area.locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(area)).toContainText(outcome);
}

export async function expectPainted(canvas: Locator) {
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

/** 検証用の固定例から始める（label は固定例の名前）。 */
export async function createScenario(page: Page, label: string) {
  await page.goto("/");
  await page.getByRole("radio", { name: "検証用の固定例から始める" }).check();
  // 名前の先頭で選ぶ（ほかの固定例の説明に同じカード名があっても混ざらない）
  await page.getByRole("radio", { name: new RegExp(`^${label}`) }).check(); // 固定例の名前は正規表現の記号を含まない
  await page.getByRole("button", { name: /対戦を作成/ }).click();
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toBeVisible();
}

/**
 * new_game（seed 固定）→ 両者の初期配置（最初の選べるもの）→ 補償（最大）→ ホストのジャンケン（プレイヤー0）。decks はプレイヤーごとのデッキの文。
 * scenario は new_game から始める固定例の名前（U7-5。デッキと seed は固定例が持ち、画面には返らない）。
 */
export async function setupToFirstTurn(page: Page, opts: { decks?: [string | null, string | null]; scenario?: string; mulligans: number }) {
  if (opts.scenario) {
    await createScenario(page, opts.scenario);
  } else {
    await page.goto("/");
    const texts = page.locator(".deck-editor textarea");
    await expect(texts.first()).not.toHaveValue("");
    for (const [i, deck] of (opts.decks ?? [null, null]).entries()) {
      if (deck === null) continue;
      if (deck.startsWith("preset:")) await page.locator(".deck-editor").nth(i).locator("select").selectOption(deck.slice("preset:".length));
      else await texts.nth(i).fill(deck);
    }
    await page.getByRole("button", { name: /対戦を作成/ }).click();
  }
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
  expect(mulligans).toBe(opts.mulligans);
  await choose(host(page), "ジャンケンの結果を入力");
  await host(page).locator(".decision").getByRole("radio", { name: "プレイヤー0" }).check();
  await submitAndExpect(host(page), /受理/);
  await selectSeat(page, "プレイヤー0");
  await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toContainText("プレイヤー0の番");
}

/** 送る前の check（GUI の決まり）: 送信は無効 → 入力を検査 → 通ったら送る。 */
export async function checkAndSubmit(page: Page, outcome: RegExp) {
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await submitAndExpect(viewer(page), outcome);
}

/** エネルギーをつける: 1 段目の最初 → バトル場（送る前に check。GUI の決まり）。 */
export async function attachToActive(page: Page) {
  await choose(viewer(page), "エネルギーをつける");
  await stage(page, 1).getByRole("radio").first().check();
  await stage(page, 2).getByRole("radio", { name: /バトル場/ }).check();
  await checkAndSubmit(page, /受理/);
}

export async function endTurn(page: Page, seat: string) {
  await selectSeat(page, seat);
  await choose(viewer(page), "番を終える");
  await submitAndExpect(viewer(page), /受理/);
}
