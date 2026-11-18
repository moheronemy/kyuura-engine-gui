// 0.193.0（C-TF1: 変身で写した、ワザといっしょに宣言する特殊能力をおもての 2 段目に示さない）と 0.194.0（C-TF2 に関係する既存の操作: おもてのメタモンのきつねび →
// 交代の決定 → 回答 → 結果）を、実際の接続層 + 固定版のエンジン（0.194.0・f747dc9）+ 実際の renderer で確かめる（2 件だけ）。盤面は構築盤面（server/tests/tf_boards.py。
// エンジンの回帰テストの盤面と同じ状態・乱数。new_game からの到達ではない）。テスト専用の入口（server/tests/reveal_server.py。C-TF の盤面も加える）で接続層を起動するときだけ
// 動く（1 件ずつ、別のポートで流す）:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx --no-install playwright test e2e/transform-tf.spec.ts -g "TF1"
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx --no-install playwright test e2e/transform-tf.spec.ts -g "TF2"
// 欠番の id（人工の入力）・直接のコマンドの UNSUPPORTED_TRANSFORM_COPIED_POWER・本来の持ち主の対照・うらのメタモンの保留は、接続層（server/tests/test_transform_tf.py）と
// 画面テスト（src/AppTransform.test.tsx）で確かめる。うらから公開した使い手の姿の固定（C-TF2 の修正そのもの）は、エンジンのテストの結果を引用する（ここでは確かめない）。
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "C-TF の構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const KIND = "自分の場のポケモンの、ワザといっしょに使う特殊能力";
const BENCH_A = new RegExp(`［ANGER\\[アンガー\\]］ — ${KIND}（アンノーンA（プレイヤー0・ベンチ1））`);
/** 相手（プレイヤー1）のバトル場のポケモンのダメージ（観測の値）。 */
const opponentDamage = (page: Page, name: string) =>
  viewer(page).getByRole("article", { name: new RegExp(`バトル場: ${name}`) }).getByLabel("今の状態（観測の値）").locator("div", { has: page.locator("dt", { hasText: /^ダメージ$/ }) }).locator("dd");

function watch(page: Page) {
  const sent = { checks: [] as unknown[], submits: [] as unknown[] };
  page.on("request", (r) => {
    if (r.method() !== "POST") return;
    const body = (() => {
      try {
        return JSON.parse(r.postData() ?? "{}") as { type?: string; choices?: unknown };
      } catch {
        return {};
      }
    })();
    if (body.type === "check") sent.checks.push(body.choices);
    if (body.type === "submit") sent.submits.push(body.choices);
  });
  return sent;
}

test("TF1 C-TF1: おもてのメタモンが写した［XXXXX］は 2 段目に出ず、ベンチのアンノーンAの［ANGER］を選んで check・送信・受理（ダメージ 20）", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "変身 C-TF1 構築盤面 T1（");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio").first().check();
  const radios = stage(page, 2).getByRole("radio");
  await expect(radios).toHaveCount(2); // 「選ばない」と、エンジンが示した 1 つ（既存の出し方）
  await expect(radios.nth(0)).toHaveAccessibleName("選ばない");
  await expect(radios.nth(0)).toBeChecked(); // 任意（自動で選ばない）
  const power = stage(page, 2).getByRole("radio", { name: BENCH_A });
  await expect(power).not.toBeChecked();
  expect(await stage(page, 2).innerText()).not.toMatch(/XXXXX/); // 写した力を GUI で補わない
  await power.check();
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(opponentDamage(page, "アンノーンX")).toHaveText("20");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(opponentDamage(page, "アンノーンX")).toHaveText("20");
  }
  expect(sent.checks).toEqual([["o1", "o3"]]); // エンジンの id のまま（欠番を詰めない）
  expect(sent.submits).toEqual([["o1", "o3"]]); // 自動で再送しない
});

test("TF2 きつねび: おもてのメタモンのワザ → 交代の決定 → フシギダネを選んで回答 → 結果（フシギダネにダメージ 20）を 3 閲覧者に示す", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "変身 C-TF2 構築盤面 V1（");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio").first().check();
  await expect(stage(page, 2)).toContainText("宣言といっしょに選べるものはありません");
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(opponentDamage(page, "ロコン")).toHaveText("0"); // 入れ替えてからダメージ（まだ与えていない）
  await choose(viewer(page), "決定に答える");
  await expect(stage(page, 1)).toContainText("forced_switch");
  await expect(stage(page, 1).getByRole("radio", { name: "選ばない" })).toBeChecked(); // 自動で選ばない
  await stage(page, 1).getByRole("radio", { name: /フシギダネ（プレイヤー1・ベンチ1）/ }).check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: 決定に答える/);
  await expect(opponentDamage(page, "フシギダネ")).toHaveText("20");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(opponentDamage(page, "フシギダネ")).toHaveText("20");
  }
  expect(sent.submits).toHaveLength(2); // 自動で再送しない
  expect(sent.submits[0]).toEqual(["o1"]);
});
