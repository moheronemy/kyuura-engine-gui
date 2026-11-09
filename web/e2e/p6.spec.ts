// 0.174.0（P6。本人のうらのバトル場のポケモンのにげる）を、実際の接続層 + 固定版のエンジン（0.174.0・f7bf450）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/p6_boards.py。エンジンの P6 のテストの盤面を写したもの。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/p6_server.py）で接続層を起動するときだけ動く: KYUURA_E2E_SERVER_MODULE=tests.p6_server npx playwright test e2e/p6.spec.ts
// 入力はエンジンが返した選べるものだけから選ぶ。結果（受理・拒否・続きの決定）は応答と観測で確かめ、画面の予告に頼らない。
import { expect, test, type Page } from "@playwright/test";
import { candidate, choose, createScenario, mine, panel, results, selectSeat, stage, submitAndExpect, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.p6_server", "P6 の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.p6_server）でだけ作れる");

async function openRetreat(page: Page, board: "A" | "B" | "C") {
  await createScenario(page, `P6 構築盤面 ${board}`);
  await selectSeat(page, "プレイヤー0");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン"); // 盤面は裏面
  await choose(viewer(page), "にげる");
  const p = panel(page);
  await expect(p.getByRole("note", { name: "うらのバトル場のポケモンのにげる" })).toBeVisible();
  const units = p.getByRole("status", { name: "エネルギーの個数" });
  await expect(units).toContainText("必要なエネルギーの個数（費用）: 評価していません");
  await expect(units).toContainText("カードごとのエネルギーの個数: 評価していません");
  await expect(p).not.toContainText("total_units）");
  await stage(page, 1).getByRole("radio").first().check();
  await expect(p.getByRole("button", { name: "送信" })).toBeDisabled(); // check の前は送れない
  return { p, units };
}

async function checkShape(page: Page) {
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの形の検査を通りました");
  await expect(panel(page).locator(".check-result")).toContainText("費用が足りるか・受理されるかは保証しません");
}

test("構築盤面 A: エネルギー 0 枚で送る → 受理。おもてにしたカードは観測で公開、バトル場は控え", async ({ page }) => {
  await openRetreat(page, "A");
  await checkShape(page);
  await submitAndExpect(viewer(page), /受理: にげる/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: エビワラー");
  await expect(mine(page).locator(".bench .pokemon").first()).toHaveAttribute("aria-label", "ベンチ1: コラッタ");
  await selectSeat(page, "プレイヤー1"); // 受理のあとの公開（相手の観測）
  await expect(viewer(page).locator(".player-area.opponent .bench .pokemon").first()).toHaveAttribute("aria-label", "ベンチ1: コラッタ");
});

test("構築盤面 B: エネルギー 1 枚 → 拒否は本人の画面だけ。うらのまま・自動で再送しない。相手・観戦者に診断・本当のカードが出ない", async ({ page }) => {
  const { units } = await openRetreat(page, "B");
  await stage(page, 2).getByRole("checkbox").first().check();
  await expect(units).toContainText("選んでいるカード: 1 枚");
  await checkShape(page);
  const submits: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.postData()?.includes('"type":"submit"')) submits.push(r.url());
  });
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("拒否（エンジン）: にげる");
  await expect(results(viewer(page))).toContainText("送ったあなたにだけ表示しています");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン");
  await page.waitForTimeout(500);
  expect(submits).toHaveLength(1); // 自動で再送しない
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const html = await viewer(page).innerHTML();
    expect(html).not.toMatch(/拒否（エンジン）|イワーク|PMCG1-054|評価していません/);
    await expect(viewer(page).getByLabel("バトル場: 裏向きのポケモン")).toHaveCount(1); // プレイヤー0のバトル場はうらのまま（相手のバトル場はエビワラー）
  }
});

test("構築盤面 C: 送る → 受理（決定待ち）→ バトル場に出すポケモンを選ぶ決定へ答える", async ({ page }) => {
  await openRetreat(page, "C");
  await checkShape(page);
  await submitAndExpect(viewer(page), /受理（決定待ち）: にげる/);
  await expect(results(viewer(page))).toContainText("次: あなた（プレイヤー0）の決定への回答");
  await expect(candidate(viewer(page), "バトル場に出すポケモンを選ぶ")).toHaveCount(1);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveCount(0); // 観測: バトル場は空き
  await choose(viewer(page), "バトル場に出すポケモンを選ぶ");
  await stage(page, 1).getByRole("radio").first().check();
  await submitAndExpect(viewer(page), /受理/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: エビワラー");
});
