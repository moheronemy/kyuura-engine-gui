// 0.180.0（F-1。本人のうらのバトル場のポケモンのワザの候補だけに、実装に合う保証の文が付く）を、実際の接続層 + 固定版のエンジン（0.180.0・27ba35d）+ 実際の renderer で確かめる。
// 盤面は構築盤面（P6 の p6_face_down_retreat_b を再利用。本人のバトル場はうら・闘エネルギー 1 枚。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/f1_server.py）で接続層を起動するときだけ動く:
//   KYUURA_E2E_SERVER_MODULE=tests.f1_server npx playwright test e2e/f1.spec.ts
// 1 件で、うらのワザの候補の表示（未確認・エンジンの保証文は説明の中）、check の前後の送信の制御、check が valid でも受理の保証ではないこと（拒否は本人だけ・自動で再送しない）、
// 相手・観戦者の画面に本当のカードを補わないことを確かめる。結果（拒否・受理・おもてにしたか）は応答と観測で確かめ、画面の予告に頼らない。
import { expect, test } from "@playwright/test";
import { candidate, choose, createScenario, mine, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.f1_server", "F-1 の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.f1_server）でだけ作れる");

const SECRET = /イワーク|PMCG1-054|いわおとし|かたくなる/; // 本人だけが知る本当のカードとワザ（相手・観戦者の画面に出ない）

test("うらのバトル場のワザ: 未確認・形の check のあとに送る。かたくなるはエンジンが拒否（本人だけ・うらのまま・再送なし）、いわおとしは受理。相手・観戦者に本当のカードが出ない", async ({ page }) => {
  await createScenario(page, "P6 構築盤面 B");
  await selectSeat(page, "プレイヤー0");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン");
  const attack = candidate(viewer(page), "ワザを使う");
  await expect(attack).toContainText("未確認");
  await expect(attack.locator("details")).toContainText("check が valid でも、エンジンの確かめを通したことを意味しない"); // エンジンの保証文（表示だけ）
  await choose(viewer(page), "ワザを使う");
  const rows = stage(page, 1).locator("li").filter({ has: page.getByRole("radio") });
  await expect(rows).toHaveCount(2); // エンジンが返したワザだけ
  await expect(rows.first()).toContainText("必要なエネルギーが足りるか・ワザを使えるかは、エンジンが送信のあとに決めます");
  await expect(panel(page)).not.toContainText(/おもてにしてから|おもてになります|受理されます|エネルギーが足ります/);
  const send = panel(page).getByRole("button", { name: "送信" });
  await stage(page, 1).getByRole("radio", { name: /かたくなる/ }).check();
  await expect(send).toBeDisabled(); // check の前は送れない
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの形の検査を通りました（ワザの番号が 1 つで、ほかを選ばないことだけ。必要なエネルギーが足りるか・ワザを使えるか・受理・完走の保証ではありません");
  await expect(send).toBeEnabled();
  const submits: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.postData()?.includes('"type":"submit"')) submits.push(r.url());
  });
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("拒否（エンジン）: ワザを使う");
  await expect(results(viewer(page))).toContainText("送ったあなたにだけ表示しています");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン"); // 状態は変わらない
  await page.waitForTimeout(500);
  expect(submits).toHaveLength(1); // 自動で再送しない
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const html = await viewer(page).innerHTML();
    expect(html).not.toMatch(/拒否（エンジン）|INSUFFICIENT_ENERGY|形の検査を通りました|あなたにだけ見える/);
    expect(await viewer(page).textContent()).not.toMatch(SECRET);
    await expect(candidate(viewer(page), "ワザを使う")).toHaveCount(0);
    await expect(viewer(page).getByLabel("バトル場: 裏向きのポケモン")).toHaveCount(1);
  }
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /いわおとし/ }).check();
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/); // 結果は応答のとおり（送る前に予告していない）
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: イワーク"); // 受理のあとは観測のとおり（公開）
});
