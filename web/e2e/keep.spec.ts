// 0.181.0（E12 の修正。答えで指定しておもてにした相手のうらのカードが［KEEP］を持つとき、エネルギー・リムーブは内部の例外でなく既存の KP1
// UNRESOLVED_KEEP_PROTECTED_TARGET の通常の拒否になる）を、実際の接続層 + 固定版のエンジン（0.181.0・a2b29e9）+ 実際の renderer で確かめる。
// 盤面は構築盤面（server/tests/keep_boards.py の keep_er_c。相手のベンチはうら（本当のカードはアンノーンK）・闘エネルギー 1 枚。new_game からの到達ではない。seed の探索はしていない）。
// テスト専用の入口（server/tests/keep_server.py）で接続層を起動するときだけ動く:
//   KYUURA_E2E_SERVER_MODULE=tests.keep_server npx playwright test e2e/keep.spec.ts
// 1 件で、check valid → KP1 の拒否（本人だけ・通常の拒否・自動で再送しない）→ 選び直し → 再 check → 受理と、相手のうらの本当のカードを本人・観戦者の画面に補わないことを確かめる。
// 選べるもの（ラジオの名前は「… o2 #25」）の o2 は相手のうらのベンチのエネルギー、o1 は相手のバトル場のエネルギー（同じ盤面の実応答で確かめた。web/src/test/keep.ts）。結果は応答と観測で確かめる。
// 付属先の表示（「— 相手のベンチ1：裏向きのポケモン」「— 相手のバトル場：エビワラー」。公開の参照だけ）で選び、送る値が o2・o1 のままであることも確かめる。
import { expect, test } from "@playwright/test";
import { candidate, choose, createScenario, opponent, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.keep_server", "KEEP の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.keep_server）でだけ作れる");

const SECRET = /アンノーンK|neo3-030/; // 相手のうらの本当のカード（本人・観戦者の画面に出ない）

test("エネルギー・リムーブ: 相手のうらのエネルギーは check valid でも KP1 の拒否（本人だけ・再送なし）→ 同じ決定でバトル場のエネルギーを選び直し → 再 check → 受理", async ({ page }) => {
  const submits: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.postData()?.includes('"type":"submit"')) submits.push(r.postData() ?? "");
  });
  await createScenario(page, "KEEP 構築盤面 er_c");
  await selectSeat(page, "プレイヤー0");
  await expect(opponent(page).getByLabel("ベンチ1: 裏向きのポケモン")).toBeVisible();
  expect(await viewer(page).textContent()).not.toMatch(SECRET);
  // 手札のトレーナー（エネルギー・リムーブ）を使う
  await choose(viewer(page), "手札のトレーナーを使う");
  await stage(page, 1).getByRole("radio", { name: /PMCG1-070/ }).check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("受理（決定待ち）: 手札のトレーナーを使う");
  // 決定: 相手のうらのベンチのエネルギーを選ぶ → check valid → 送信は KP1 の拒否
  await choose(viewer(page), "決定に答える");
  const send = panel(page).getByRole("button", { name: "送信" });
  const faceDown = stage(page, 1).getByRole("radio", { name: /— 相手のベンチ1：裏向きのポケモン/ }); // 付属先の表示で選ぶ（同名のエネルギー 2 枚）
  await expect(stage(page, 1).getByRole("radio", { name: /— 相手のバトル場：エビワラー/ })).toHaveCount(1);
  await faceDown.check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました（受理・完走の保証ではありません");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("拒否（エンジン）: 決定に答える");
  await expect(results(viewer(page))).toContainText("送ったあなたにだけ表示しています");
  await expect(results(viewer(page))).toContainText("区分: 未裁定（ゲーム上の禁止ではありません）");
  await expect(results(viewer(page))).toContainText("診断: UNRESOLVED_KEEP_PROTECTED_TARGET");
  await expect(results(viewer(page))).not.toContainText(/処理できない結果|内部エラー|INTERNAL_ERROR|通信できませんでした/);
  await expect(opponent(page).getByLabel("ベンチ1: 裏向きのポケモン")).toBeVisible(); // 状態は変わらない（うらのまま）
  expect(await viewer(page).textContent()).not.toMatch(SECRET);
  await page.waitForTimeout(500);
  expect(submits).toHaveLength(2); // トレーナー 1 回と答え 1 回。自動で再送しない
  expect(JSON.parse(submits[1]!).choices).toEqual(["o2"]); // 送る値は選べるものの id のまま（表示で入力を変えない）
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const html = await viewer(page).innerHTML();
    expect(html).not.toMatch(/拒否（エンジン）|UNRESOLVED_KEEP_PROTECTED_TARGET|検査を通りました/);
    await expect(candidate(viewer(page), "決定に答える")).toHaveCount(0);
    if (seat === "観戦者") expect(await viewer(page).textContent()).not.toMatch(SECRET);
  }
  // 同じ決定に答え直す（取り直した候補で選び直し、その入力を check してから送る）
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "決定に答える");
  await expect(panel(page).locator(".check-result")).toHaveCount(0); // 前の check の答えを置かない
  await stage(page, 1).getByRole("radio", { name: /— 相手のバトル場：エビワラー/ }).check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/^受理: 決定に答える/);
  expect(submits).toHaveLength(3);
  expect(JSON.parse(submits[2]!).choices).toEqual(["o1"]);
  await expect(opponent(page).getByLabel("ベンチ1: 裏向きのポケモン")).toBeVisible(); // 選ばなかったうらはうらのまま
  expect(await viewer(page).textContent()).not.toMatch(SECRET);
});
