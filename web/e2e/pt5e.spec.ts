// 0.176.0（PT-5e。山札から引いて試すトレーナー 6 枚の使うための条件を候補の作成で呼ぶ）を、実際の接続層 + 固定版のエンジン（0.176.0・6f62700）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/pt5e_boards.py。エンジンの PT-5e のテストの table の形。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/pt5e_server.py）で接続層を起動するときだけ動く: KYUURA_E2E_SERVER_MODULE=tests.pt5e_server npx playwright test e2e/pt5e.spec.ts
// 1 件で、条件を通るカード（may_stop_later）・ゲーム上使えないカード（選べるものに出ない）・未対応のカード（理由つき・送れない）をまとめて確かめる。
import { expect, test } from "@playwright/test";
import { choose, createScenario, panel, results, selectSeat, stage, submitAndExpect, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.pt5e_server", "PT-5e の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.pt5e_server）でだけ作れる");

test("構築盤面 1: その2は may_stop_later で選べ、性格判定は出ず、その1は未対応で送れない → その2を check のあとに送る → 受理（決定待ち）", async ({ page }) => {
  await createScenario(page, "PT-5e 構築盤面 1");
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "手札のトレーナーを使う");
  const radios = stage(page, 1).getByRole("radio");
  await expect(radios).toHaveCount(2); // 手札の 3 枚のトレーナーのうち、ゲーム上使えない性格判定は出ない
  await expect(stage(page, 1)).not.toContainText("neo4-105");
  const quiz2 = stage(page, 1).getByRole("radio", { name: /GD5-017/ });
  const quiz1 = stage(page, 1).getByRole("radio", { name: /GD5-016/ });
  await expect(quiz2).toBeEnabled();
  await expect(stage(page, 1).locator("li").filter({ has: quiz2 })).toContainText("送れる（後で止まりうる）");
  await expect(quiz1).toBeDisabled();
  await expect(stage(page, 1).locator("li").filter({ has: quiz1 })).toContainText("エンジンが未対応です（ゲーム上の禁止ではありません）");
  await quiz2.check();
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // check の前は送れない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await submitAndExpect(viewer(page), /^受理（決定待ち）: 手札のトレーナーを使う/);
  await expect(results(viewer(page))).toContainText("次: あなた（プレイヤー0）の決定への回答"); // 受理のあとの決定（完走ではない）
});
