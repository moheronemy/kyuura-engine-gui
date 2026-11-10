// 0.178.0（UP-5t-C1。特殊能力の候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず unverified にする補強）を、実際の接続層 + 固定版のエンジン
// （0.178.0・8f5329d）+ 実際の renderer で確かめる。盤面は構築盤面（server/tests/up5t_boards.py。エンジンの UP-5t-C1 のテストの盤面の形。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/up5t_server.py）で接続層を起動するときだけ動く: KYUURA_E2E_SERVER_MODULE=tests.up5t_server npx playwright test e2e/up5t-c1.spec.ts
// 1 件で、うらの unverified とおもての対照の表示、check の前後の送信の制御をまとめて確かめる。送ったあとの結果は予告せず、応答の表示に従う。
import { expect, test } from "@playwright/test";
import { candidate, choose, createScenario, opponent, panel, results, selectSeat, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.up5t_server", "UP-5t-C1 の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.up5t_server）でだけ作れる");

const REAL = /コラッタ|PMCG1-060/; // 構築盤面 A の相手のうらのカードの本当のカード（使う人・観戦者の画面に出ない）

test("［くさいかふん］: 相手のバトル場がうらなら未確認（理由つき）・おもてなら送れる（後で止まりうる）。入力なしでも check の前は送れず、check のあとに送る", async ({ page }) => {
  await createScenario(page, "UP-5t-C1 構築盤面 ［くさいかふん］・相手のバトル場はおもて");
  await selectSeat(page, "プレイヤー1");
  await expect(candidate(viewer(page), "特殊能力を使う")).toContainText("送れる（後で止まりうる）"); // おもての対照
  await expect(candidate(viewer(page), "特殊能力を使う")).not.toContainText("未確認");

  await createScenario(page, "UP-5t-C1 構築盤面 ［くさいかふん］・相手のバトル場はうら A");
  await selectSeat(page, "プレイヤー1");
  const power = candidate(viewer(page), "特殊能力を使う");
  await expect(power).toContainText("未確認");
  await expect(power).toContainText("うらのカードの本当のカードでは確かめていない（使えるか・どうなるかは送信のあとエンジンが決める）");
  await expect(opponent(page).getByLabel(/バトル場: 裏向きのポケモン/)).toBeVisible(); // 公開の位置と裏向きだけ
  await expect(viewer(page)).not.toContainText(REAL);
  await selectSeat(page, "観戦者"); // 送る前: 観戦者にも本当のカード・使う人の候補は出ない（受理のあとの正当な公開は観測に従うので、送ったあとは比べない）
  await expect(viewer(page)).not.toContainText(REAL);
  await expect(viewer(page).locator(".candidate-list")).toHaveCount(0);
  await selectSeat(page, "プレイヤー1");
  await choose(viewer(page), "特殊能力を使う");
  await expect(panel(page)).toContainText("この操作に入力はありません。");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // check の前は送れない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeEnabled();
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理|拒否/); // 結果は応答のまま（予告していない）
  await selectSeat(page, "観戦者");
  await expect(viewer(page)).not.toContainText("エンジンの検査を通りました"); // 使う人の検査・診断は観戦者に出ない
});
