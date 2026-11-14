// 0.183.0（読み取りの要求 log）と 0.182.0（ポケモン交換おじさんの見せる 2 枚の card_id）を、実際の接続層 + 固定版のエンジン（0.183.0・05290415）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/trader_boards.py。エンジンのテストの交換おじさん・パソコン通信の盤面を写したもの。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/trader_server.py）で接続層を起動するときだけ動く:
//   KYUURA_E2E_SERVER_MODULE=tests.trader_server npx playwright test e2e/trader-log.spec.ts -g "<名前>"
// 1. 交換おじさん: もどしたカード・探したカードが、相手と観戦者の「見せたカード」の欄に識別できる名前で出る
// 2. パソコン通信の対照: 探したカードは相手・観戦者（と本人の欄）に出ない
// 選べるものはカード ID（ラジオ・チェックの名前の「名前 ID o1 #n」）で選ぶ。結果は応答と画面の欄で確かめる。
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.trader_server", "交換おじさん・パソコン通信の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.trader_server）でだけ作れる");

const revealed = (page: Page) => viewer(page).getByRole("region", { name: "見せたカード（公開のログ）" });

async function answerWith(page: Page, label: string, ids: RegExp[], outcome: RegExp) {
  await choose(viewer(page), label);
  for (const id of ids) {
    const option = stage(page, 1).getByRole(ids.length > 1 ? "checkbox" : "radio", { name: id });
    await option.check();
  }
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(outcome);
}

function watchLog(page: Page) {
  const seen = { log: 0, withheld: 0, submits: 0 };
  page.on("request", (r) => {
    const body = r.postData() ?? "";
    if (r.method() === "POST" && body.includes('"type":"log"')) seen.log += 1;
    if (r.method() === "POST" && body.includes('"type":"submit"')) seen.submits += 1;
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/") && r.status() === 500) {
      const text = await r.text().catch(() => "");
      if (/GUI_RESPONSE_WITHHELD|GUI_LOG_RESPONSE_INVALID/.test(text)) seen.withheld += 1;
    }
  });
  return seen;
}

test("交換おじさん: もどしたカード・探したカードが相手と観戦者に識別できる名前で出る", async ({ page }) => {
  const seen = watchLog(page);
  await createScenario(page, "交換おじさん 構築盤面（公開のログ");
  await selectSeat(page, "プレイヤー0");
  await expect(revealed(page)).toContainText("見せたカードの出来事はまだありません");
  await answerWith(page, "手札のトレーナーを使う", [/PMCG1-093/], /受理（決定待ち）: 手札のトレーナーを使う/);
  await expect(revealed(page).getByRole("listitem")).toHaveCount(0); // 使った直後には出さない
  await answerWith(page, "決定に答える", [/PMCG1-030/], /受理（決定待ち）: 決定に答える|受理: 決定に答える/);
  await expect(revealed(page).getByRole("listitem")).toHaveCount(1);
  await expect(revealed(page)).toContainText(/プレイヤー0が手札から見せて山札へ戻した: ジュゴン PMCG1-030/);
  await answerWith(page, "決定に答える", [/PMCG1-008/], /受理: 決定に答える/);
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const rows = revealed(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(/プレイヤー0が手札から見せて山札へ戻した: ジュゴン PMCG1-030/);
    await expect(rows.nth(1)).toContainText(/プレイヤー0が山札から見せて手札に加えた: フシギソウ PMCG1-008/);
    await expect(revealed(page)).not.toContainText("接続元の状態から取得した履歴"); // 構築盤面のログは空から（baseline_end は 0:0）
    await expect(revealed(page).getByRole("alert")).toHaveCount(0);
  }
  expect(seen.log).toBeGreaterThan(0);
  expect(seen.withheld).toBe(0);
  expect(seen.submits).toBe(3); // 自動で再送しない
});

test("パソコン通信の対照: 探したカードは相手・観戦者の欄に出ない", async ({ page }) => {
  const seen = watchLog(page);
  await createScenario(page, "パソコン通信 構築盤面（非公開の検索の対照");
  await selectSeat(page, "プレイヤー0");
  await answerWith(page, "手札のトレーナーを使う", [/PMCG1-090/], /受理（決定待ち）: 手札のトレーナーを使う/);
  await answerWith(page, "決定に答える", [/PMCG1-098/, /PMCG1-016/], /受理（決定待ち）: 決定に答える|受理: 決定に答える/);
  await answerWith(page, "決定に答える", [/PMCG1-074/], /受理: 決定に答える/);
  for (const seat of ["プレイヤー0", "プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(revealed(page)).toContainText(/取得したログ（\d+ 件）に、見せたカードの出来事はまだありません/);
    await expect(revealed(page).getByRole("listitem")).toHaveCount(0);
    if (seat !== "プレイヤー0") expect(await viewer(page).textContent()).not.toMatch(/マサキ|PMCG1-074/);
  }
  expect(seen.withheld).toBe(0);
  expect(seen.submits).toBe(3);
});
