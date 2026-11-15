// 0.184.0（見せる 17 の呼ぶ箇所の card_id）の代表 1 経路（B 特殊能力［おくりもの］）を、実際の接続層 + 固定版のエンジン（0.184.0・a9add68）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/reveal_boards.py の reveal_gift。エンジンの v0.184 の回帰テスト test_b_gift_both_players の盤面と同じ状態。new_game からの到達ではない）。
// テスト専用の入口（server/tests/reveal_server.py）で接続層を起動するときだけ動く:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx playwright test e2e/reveal-identify.spec.ts
// 使った人（プレイヤー 0）と相手（プレイヤー 1）がそれぞれ山札のどうぐを見せて手札に加える。相手・観戦者の「見せたカード」の欄に、操作した主体を分けて名前で出ることを確かめる。
// 製品のコードは 0.183.0 から変えていない（見せたカードの欄は出来事の種類と card_id だけで表示する）。
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, panel, results, selectSeat, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "0.184.0 の代表の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const revealed = (page: Page) => viewer(page).getByRole("region", { name: "見せたカード（公開のログ）" });

/** 候補を選び、各段の選べるもの（「選ばない」を除く最初。この盤面ではどの段も 1 つ）を選んで check → 送信。 */
async function answerFirst(page: Page, label: string, outcome: RegExp) {
  await choose(viewer(page), label);
  const stages = panel(page).locator("fieldset.stage");
  const n = await stages.count();
  for (let i = 0; i < n; i++) {
    await stages.nth(i).getByRole("radio").filter({ hasNotText: "選ばない" }).first().check();
  }
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(outcome);
}

test("おくりもの: 使った人と相手が見せたどうぐが、相手と観戦者の欄に操作した主体を分けて名前で出る", async ({ page }) => {
  let submits = 0;
  let withheld = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && (r.postData() ?? "").includes('"type":"submit"')) submits += 1;
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/") && r.status() === 500 && /GUI_RESPONSE_WITHHELD|GUI_LOG_RESPONSE_INVALID/.test(await r.text().catch(() => ""))) withheld += 1;
  });
  await createScenario(page, "見せる 構築盤面 B おくりもの");
  await selectSeat(page, "プレイヤー0");
  await answerFirst(page, "進化させる", /受理/);
  await answerFirst(page, "決定に答える", /受理/);
  await answerFirst(page, "決定に答える", /受理/);
  await expect(revealed(page).getByRole("listitem")).toHaveCount(0); // 山札から選ぶ前
  await answerFirst(page, "決定に答える", /受理/);
  await expect(revealed(page).getByRole("listitem")).toHaveCount(1);
  await selectSeat(page, "プレイヤー1");
  await expect(revealed(page).getByRole("listitem")).toHaveCount(1);
  await expect(revealed(page)).toContainText(/プレイヤー0が山札から見せて手札に加えた: .+ neo1-073/);
  await answerFirst(page, "決定に答える", /受理/);
  await answerFirst(page, "決定に答える", /受理/);
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const rows = revealed(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(/プレイヤー0が山札から見せて手札に加えた: .+ neo1-073 （ログの位置 0:2）/);
    await expect(rows.nth(1)).toContainText(/プレイヤー1が山札から見せて手札に加えた: .+ neo1-073 （ログの位置 0:4）/);
    await expect(revealed(page)).not.toContainText(/@power0|識別の情報なし|カード定義にないカード|接続元の状態/);
    await expect(revealed(page).getByRole("alert")).toHaveCount(0);
  }
  expect(withheld).toBe(0);
  expect(submits).toBe(6); // 自動で再送しない
});
