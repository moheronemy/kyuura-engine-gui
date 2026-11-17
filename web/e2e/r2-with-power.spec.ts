// 0.190.0（R-2 の［めいれい］: 本人のうらのバトル場のワザの宣言に、自分の場のおもてのポケモンの［めいれい］を示す）を、実際の接続層 + 固定版のエンジン（0.190.0・daf2718）
// + 実際の renderer で確かめる（2 件だけ）。盤面は構築盤面（server/tests/r2wp_boards.py。エンジンの v0.190 の回帰テストの盤面と同じ状態・乱数。new_game からの到達ではない）。
// テスト専用の入口（server/tests/reveal_server.py。R-2［めいれい］の盤面も加える）で接続層を起動するときだけ動く（1 件ずつ、別のポートで流す）:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx --no-install playwright test e2e/r2-with-power.spec.ts -g "WP1"
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx --no-install playwright test e2e/r2-with-power.spec.ts -g "WP2"
// 力なしの入力と対照（力が無効・名前が違う）は接続層（server/tests/test_r2_with_power.py）と画面テスト（src/AppR2WithPower.test.tsx）で確かめる。
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, mine, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "0.190.0 の R-2［めいれい］の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const coins = (page: Page) => viewer(page).getByRole("region", { name: "コインの結果（公開のログ）" });
const K1 = /［めいれい］ — 自分の場のポケモンの、ワザといっしょに使う特殊能力（サカキのニドキング（プレイヤー0・ベンチ1））/;
const K2 = /［めいれい］ — 自分の場のポケモンの、ワザといっしょに使う特殊能力（サカキのニドキング（プレイヤー0・ベンチ3））/;
/** 相手（プレイヤー1）のバトル場のエビワラーのダメージ（観測の値）。 */
const opponentDamage = (page: Page) =>
  viewer(page).getByRole("article", { name: /バトル場: エビワラー/ }).getByLabel("今の状態（観測の値）").locator("div", { has: page.locator("dt", { hasText: /^ダメージ$/ }) }).locator("dd");

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

test("WP1 受理: うらのサカキのニドラン♂のにどげりで［めいれい］を選び、check・送信・受理の結果（コイン おもて 2 枚・ダメージ 30）を示す", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "R-2［めいれい］構築盤面 W1（");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /にどげり/ }).check();
  await expect(stage(page, 2).getByRole("radio", { name: "選ばない" })).toBeChecked(); // 任意（自動で選ばない）
  await expect(stage(page, 2)).toContainText("力を使えることは保証しない");
  await stage(page, 2).getByRole("radio", { name: K1 }).check();
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("特殊能力を使えるか・受理・完走の保証ではありません");
  await expect(panel(page).locator(".check-result")).toContainText("その効果がはたらいたとは限りません");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: サカキのニドラン♂"); // 公開（観測のとおり）
  await expect(coins(page).locator("li")).toHaveCount(2);
  await expect(coins(page).locator("li").nth(0)).toContainText("プレイヤー0のコイン（ワザ）: おもて");
  await expect(coins(page).locator("li").nth(1)).toContainText("プレイヤー0のコイン（ワザ）: おもて");
  await expect(opponentDamage(page)).toHaveText("30");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(coins(page).locator("li")).toHaveCount(2);
    await expect(opponentDamage(page)).toHaveText("30");
    expect(await viewer(page).innerHTML()).not.toMatch(/形の検査を通りました/);
  }
  expect(sent.checks).toEqual([["o1", "o3"]]);
  expect(sent.submits).toEqual([["o1", "o3"]]); // 自動で再送しない
});

test("WP2 持ち主 2 匹: 同じ力を 2 つ選ぶと check が拒否して送れない。1 つへ直して検査し直すと受理する", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "R-2［めいれい］構築盤面 W2（");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /にどげり/ }).check();
  const k1 = stage(page, 2).getByRole("checkbox", { name: K1 });
  const k2 = stage(page, 2).getByRole("checkbox", { name: K2 });
  await k1.check();
  await k2.check();
  const send = panel(page).getByRole("button", { name: "送信" });
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("通りません CANDIDATE_INPUT_INVALID");
  await expect(send).toBeDisabled();
  await k2.uncheck();
  await expect(panel(page)).toContainText("前の検査の結果は使いません");
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの形の検査を通りました");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(coins(page).locator("li")).toHaveCount(2);
  await expect(opponentDamage(page)).toHaveText("30");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    expect(await viewer(page).innerHTML()).not.toMatch(/CANDIDATE_INPUT_INVALID|通りません/);
    await expect(opponentDamage(page)).toHaveText("30");
  }
  expect(sent.checks).toEqual([["o1", "o3", "o4"], ["o1", "o3"]]);
  expect(sent.submits).toEqual([["o1", "o3"]]); // 拒否された入力は送らない
});
