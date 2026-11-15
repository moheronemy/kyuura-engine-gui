// 0.185.0（スロットゲームの束 reveal_deck_top の card_ids）の表示と、本人だけが見る束の対照を、実際の接続層 + 固定版のエンジン（0.185.0・fa98012）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/reveal_boards.py の reveal_slot_triple・reveal_master_ball。エンジンの v0.185 の回帰テストの盤面と同じ状態。new_game からの到達ではない）。
// テスト専用の入口（server/tests/reveal_server.py）で接続層を起動するときだけ動く（1 件ずつ、別のポートで流す）:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/fossil-slot.spec.ts -g "スロットゲーム"
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/fossil-slot.spec.ts -g "本人だけ"
// 化石の発掘はブラウザでは確かめない（接続層 server/tests/test_fossil_slot.py と画面全体 src/AppFossilSlot.test.tsx）。
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, panel, results, selectSeat, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "0.185.0 の代表の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const revealed = (page: Page) => viewer(page).getByRole("region", { name: "見せたカード（公開のログ）" });

/** 候補を選び、各段の選べるもの（「選ばない」を除く最初。この盤面ではどの段も 1 つ）を選んで check → 送信。 */
async function answerFirst(page: Page, label: string, outcome: RegExp) {
  await choose(viewer(page), label);
  const stages = panel(page).locator("fieldset.stage");
  const n = await stages.count();
  for (let i = 0; i < n; i++) {
    await stages.nth(i).locator("label.option").filter({ hasNotText: "選ばない" }).first().locator("input").check(); // ラベルの文字で絞る（入力の要素は文字を持たない）
  }
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(outcome);
}

function watch(page: Page) {
  const count = { submits: 0, withheld: 0 };
  page.on("request", (r) => {
    if (r.method() === "POST" && (r.postData() ?? "").includes('"type":"submit"')) count.submits += 1;
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/") && r.status() === 500 && /GUI_RESPONSE_WITHHELD|GUI_LOG_RESPONSE_INVALID/.test(await r.text().catch(() => ""))) count.withheld += 1;
  });
  return count;
}

test("スロットゲーム: 同じ ID 3 枚の束を、相手と観戦者の欄でまとめずに 3 枚とも出す", async ({ page }) => {
  const count = watch(page);
  await createScenario(page, "見せる 構築盤面 S スロットゲーム 同じ ID 3 枚");
  await selectSeat(page, "プレイヤー0");
  await expect(revealed(page).getByRole("listitem")).toHaveCount(0); // 使う前
  await answerFirst(page, "手札のトレーナーを使う", /受理/);
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const rows = revealed(page).getByRole("listitem");
    await expect(rows).toHaveCount(4); // 束 1 行と、手札に加えた 3 枚
    await expect(rows.nth(0)).toContainText(/プレイヤー0が山札の上から3枚を見せた: .+ （ログの位置 0:2）/);
    const cells = rows.nth(0).locator("strong.bundle-card");
    await expect(cells).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(cells.nth(i)).toHaveText(/^.+ PMCG1-099$/);
    for (let i = 1; i < 4; i++) await expect(rows.nth(i)).toContainText(/プレイヤー0が山札から見せて手札に加えた: .+ PMCG1-099/);
    await expect(revealed(page)).not.toContainText(/識別の情報なし|カード定義にないカード|接続元の状態/);
    await expect(revealed(page).getByRole("alert")).toHaveCount(0);
  }
  expect(count.withheld).toBe(0);
  expect(count.submits).toBe(1); // 自動で再送しない
});

test("本人だけが見る束（マスターボール）: 見ただけのカードは相手と観戦者の欄に出ず、見せたコラッタだけ", async ({ page }) => {
  const count = watch(page);
  await createScenario(page, "見せる 構築盤面 A マスターボール");
  await selectSeat(page, "プレイヤー0");
  await answerFirst(page, "手札のトレーナーを使う", /受理（決定待ち）/);
  await answerFirst(page, "決定に答える", /受理/);
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const rows = revealed(page).getByRole("listitem");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText(/プレイヤー0が山札から見せて手札に加えた: .+ PMCG1-060 （ログの位置 0:2）/);
    await expect(revealed(page).locator("ol")).not.toContainText(/山札の上から|PMCG1-098/);
    await expect(revealed(page).getByRole("alert")).toHaveCount(0);
  }
  expect(count.withheld).toBe(0);
  expect(count.submits).toBe(2);
});
