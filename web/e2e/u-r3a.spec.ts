// 0.175.0（U-R3a。本人のうらのカードの、宣言の段が 2〜3 段の特殊能力）を、実際の接続層 + 固定版のエンジン（0.175.0・81e9e99）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/r3a_boards.py。エンジンの U-R3a のテストの盤面を写したもの。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/r3a_server.py）で接続層を起動するときだけ動く: KYUURA_E2E_SERVER_MODULE=tests.r3a_server npx playwright test e2e/u-r3a.spec.ts
// 入力はエンジンが返した選べるものだけから選ぶ。結果（受理・拒否・トラッシュ）は応答と観測で確かめ、画面の予告に頼らない。
import { expect, test, type Page } from "@playwright/test";
import { candidate, createScenario, drawn, expectPainted, mine, panel, results, selectSeat, stage, submitAndExpect, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.r3a_server", "U-R3a の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.r3a_server）でだけ作れる");

const facePower = (page: Page) => candidate(viewer(page), "特殊能力を使う").filter({ hasText: "裏向きのポケモン" });

async function openPower(page: Page, board: "1" | "2", name: string) {
  await createScenario(page, `U-R3a 構築盤面 ${board}`);
  await selectSeat(page, "プレイヤー0");
  await expect(mine(page).getByLabel("ベンチ2: 裏向きのポケモン")).toHaveCount(1); // 盤面は裏面
  await expect(facePower(page)).toContainText(`［${name}］`);
  await facePower(page).getByRole("button", { name: "この操作を選ぶ" }).click();
  await expect(panel(page)).toContainText("組は構造だけで、受け付けるかは確かめていない"); // エンジンの 1 段目の note
  await expect(stage(page, 2).getByRole("radio")).toHaveCount(0); // 1 段目を選ぶまで選べない
}

async function checkShape(page: Page) {
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // check の前は送れない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの形の検査を通りました");
  await expect(panel(page).locator(".check-result")).toContainText("特殊能力を使えるか・受理されるか・処理が完了するかは保証しません。送信のあとエンジンが判定します");
  await expect(panel(page).locator(".check-result")).not.toContainText("おもて"); // おもてになることを予告しない（docs/engine-contract.md 21 章）
}

test("構築盤面 1: コラッタ → 炎エネルギーで送る → 受理。おもてにしたヒトカゲに炎エネルギーが移り、観測のカードで画像を描く", async ({ page }) => {
  await openPower(page, "1", "ほのおをもらう");
  await stage(page, 1).getByRole("radio", { name: /コラッタ/ }).check();
  await expect(stage(page, 2).getByRole("radio")).toHaveCount(2); // コラッタについている 2 枚だけ（別の経路の闘エネルギーは出ない）
  await expect(stage(page, 2)).not.toContainText("PMCG1-102");
  await stage(page, 2).getByRole("radio", { name: /PMCG1-098/ }).check();
  await checkShape(page);
  await submitAndExpect(viewer(page), /^受理: 特殊能力を使う/);
  const user = mine(page).getByLabel(/^ベンチ2: .*ヒトカゲ/);
  await expect(user).toHaveCount(1);
  await expect(mine(page).getByLabel("ベンチ2: 裏向きのポケモン")).toHaveCount(0);
  await expect(user).toContainText(/エネルギー（1）: .*炎エネルギー/); // 炎エネルギーがヒトカゲへ（観測）
  await expect(mine(page).getByLabel(/^ベンチ1: コラッタ/)).toContainText(/エネルギー（1）: .*水エネルギー/);
  for (const canvas of await drawn(user).all()) await expectPainted(canvas); // 古い Canvas でなく、観測のカードの画像
  await expect(drawn(user).first()).toHaveAttribute("aria-label", /ヒトカゲ/);
  await selectSeat(page, "観戦者"); // 受理のあとの公開
  await expect(viewer(page).getByLabel(/^ベンチ2: .*ヒトカゲ/)).toHaveCount(1);
});

test("構築盤面 1: エビワラー → 闘エネルギーで送る → 拒否は本人の画面だけ（WRONG_ENERGY_TYPE）。うらのまま・自動で再送しない。相手・観戦者に出ない", async ({ page }) => {
  await openPower(page, "1", "ほのおをもらう");
  await stage(page, 1).getByRole("radio", { name: /エビワラー/ }).check();
  await stage(page, 2).getByRole("radio").first().check();
  await checkShape(page);
  const submits: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.postData()?.includes('"type":"submit"')) submits.push(r.url());
  });
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("拒否（エンジン）: 特殊能力を使う");
  await expect(results(viewer(page))).toContainText("送ったあなたにだけ表示しています");
  await expect(results(viewer(page))).toContainText("WRONG_ENERGY_TYPE");
  await expect(mine(page).getByLabel("ベンチ2: 裏向きのポケモン")).toHaveCount(1);
  await page.waitForTimeout(500);
  expect(submits).toHaveLength(1); // 自動で再送しない
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const html = await viewer(page).innerHTML();
    expect(html).not.toMatch(/拒否（エンジン）|WRONG_ENERGY_TYPE|ほのおをもらう|ヒトカゲ|PMCG4-012/);
    await expect(viewer(page).getByLabel("ベンチ2: 裏向きのポケモン")).toHaveCount(1);
  }
});

test("構築盤面 2: 3 段（エビワラー → 闘エネルギー → エビワラー）を送る → 受理。うらのポケモンはいなくなり、トラッシュにフシギバナ。エネルギーは動かない", async ({ page }) => {
  await openPower(page, "2", "エナジートランス");
  await stage(page, 1).getByRole("radio", { name: /エビワラー/ }).check();
  await expect(stage(page, 3).getByRole("radio")).toHaveCount(0);
  await stage(page, 2).getByRole("radio").first().check();
  await expect(stage(page, 3).getByRole("radio")).toHaveCount(3); // (エビワラー, 闘エネルギー 1 枚目) の組の 3 匹
  await stage(page, 3).getByRole("radio", { name: /エビワラー/ }).check();
  await checkShape(page);
  await submitAndExpect(viewer(page), /^受理: 特殊能力を使う/);
  await expect(mine(page).getByLabel(/裏向きのポケモン/)).toHaveCount(0);
  await expect(mine(page).getByLabel(/^ベンチ2/)).toHaveCount(0);
  await expect(mine(page).locator("details").filter({ hasText: "トラッシュ" })).toContainText("フシギバナ"); // 観測のトラッシュのカード
  await expect(mine(page).locator(".active-slot .pokemon")).toContainText(/エネルギー（2）/); // 闘エネルギーは動かない（特殊能力はおこらない）
  await selectSeat(page, "観戦者"); // 公開: 観戦者の観測のトラッシュ
  await expect(viewer(page).locator('.player-area[aria-label^="プレイヤー0"] details').filter({ hasText: "トラッシュ" })).toContainText("フシギバナ");
});
