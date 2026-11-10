// 0.179.0（PT-5t-C1。トレーナーの候補の確かめが相手のうらのカードの本当のカードを使ったら、その結果を使わず、その選べるものを unverified にする補強）を、実際の接続層 + 固定版の
// エンジン（0.179.0・4b6e3fe）+ 実際の renderer で確かめる。盤面は構築盤面（server/tests/pt5t_boards.py の pt5t_sleep_a。エンジンの PT-5t-C1 のテストの盤面の形。new_game からの
// 到達ではない。seed の探索はしていない）。テスト専用の入口（server/tests/pt5t_server.py）で接続層を起動するときだけ動く:
//   KYUURA_E2E_SERVER_MODULE=tests.pt5t_server npx playwright test e2e/pt5t-c1.spec.ts
// 1 件で、同じ候補に混在する選べるもの（未確認と送れる）の表示と、check の前後・選び直しの送信の制御をまとめて確かめる。送ったあとの結果は予告せず、応答の表示に従う。
import { expect, test } from "@playwright/test";
import { candidate, choose, createScenario, opponent, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.pt5t_server", "PT-5t-C1 の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.pt5t_server）でだけ作れる");

const REAL = /コラッタ|PMCG1-060/; // 構築盤面 sleep_a の相手のうらのカードの本当のカード（使う人・観戦者の画面に出ない）

test("ねむれ!ねむれ!（相手のバトル場がうら）: 同じ候補にねむれ!ねむれ!（未確認・理由つき）とマサキ（送れる）。check の前・選び直しのあとは送れず、今の check のあとに送る", async ({ page }) => {
  await createScenario(page, "PT-5t-C1 構築盤面 sleep_a・相手のバトル場はうら");
  await selectSeat(page, "プレイヤー1");
  await expect(candidate(viewer(page), "手札のトレーナーを使う")).toContainText("送れる（後で止まりうる）"); // 候補全体
  await expect(opponent(page).getByLabel(/バトル場: 裏向きのポケモン/)).toBeVisible(); // 公開の位置と裏向きだけ
  await expect(viewer(page)).not.toContainText(REAL);
  await choose(viewer(page), "手札のトレーナーを使う");
  const radios = stage(page, 1).getByRole("radio");
  await expect(radios).toHaveCount(2); // エンジンが返した選べるものだけ
  const sleep = stage(page, 1).getByRole("radio", { name: /PMCG4-054/ });
  const bill = stage(page, 1).getByRole("radio", { name: /PMCG1-074/ });
  const row = (name: RegExp) => stage(page, 1).locator("li").filter({ has: page.getByRole("radio", { name }) });
  await expect(row(/PMCG4-054/)).toContainText("未確認");
  await expect(row(/PMCG4-054/)).toContainText("うらのカードの本当のカードでは確かめていない（使えるか・どうなるかは送信のあとエンジンが決める）");
  await expect(row(/PMCG1-074/)).toContainText("送れる（後で止まりうる）");
  await expect(panel(page)).not.toContainText("ゲーム上の禁止");
  const send = panel(page).getByRole("button", { name: "送信" });
  await sleep.check();
  await expect(send).toBeDisabled(); // check の前は送れない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await expect(send).toBeEnabled();
  await bill.check(); // 選び直す → 答えを捨てる
  await expect(send).toBeDisabled();
  await sleep.check(); // 元の入力に戻しても改めて check が要る
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理|拒否/); // 結果は応答のまま（予告していない）
  await selectSeat(page, "観戦者");
  await expect(viewer(page)).not.toContainText("エンジンの検査を通りました"); // 使う人の検査・診断は観戦者に出ない
  await expect(viewer(page).locator(".candidate-list")).toHaveCount(0);
});
