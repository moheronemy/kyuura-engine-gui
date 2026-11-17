// 0.191.0（R-2 のアンノーンの［XXXXX］・［ANGER］: 本人のうらのバトル場のアンノーンのワザの宣言に、自分の場の別のおもての持ち主の力を示す）を、実際の接続層 + 固定版のエンジン
// （0.191.0・084157d）+ 実際の renderer で確かめる（2 件だけ）。盤面は構築盤面（server/tests/r2u_boards.py。エンジンの v0.191 の回帰テストの盤面と同じ状態・乱数。
// new_game からの到達ではない）。テスト専用の入口（server/tests/reveal_server.py。R-2 アンノーンの盤面も加える）で接続層を起動するときだけ動く（1 件ずつ、別のポートで流す）:
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx --no-install playwright test e2e/r2-unown.spec.ts -g "UN1"
//   KYUURA_E2E_SERVER_MODULE=tests.reveal_server npx --no-install playwright test e2e/r2-unown.spec.ts -g "UN2"
// 力なし・片方・対照（自己持ち主・力が無効）とワザごとに違う組（人工）は、接続層（server/tests/test_r2_unown.py）と画面テスト（src/AppR2Unown.test.tsx）で確かめる。
import { expect, test, type Page } from "@playwright/test";
import { choose, createScenario, mine, panel, results, selectSeat, stage, viewer } from "./helpers";

test.skip(process.env.KYUURA_E2E_SERVER_MODULE !== "tests.reveal_server", "0.191.0 の R-2 アンノーンの構築盤面はテスト専用の入口（KYUURA_E2E_SERVER_MODULE=tests.reveal_server）でだけ作れる");

const coins = (page: Page) => viewer(page).getByRole("region", { name: "コインの結果（公開のログ）" });
const KIND = "自分の場のポケモンの、ワザといっしょに使う特殊能力";
const ANGER_1 = new RegExp(`［ANGER\\[アンガー\\]］ — ${KIND}（アンノーンA（プレイヤー0・ベンチ1））`);
const X_2 = new RegExp(`［XXXXX\\[\\?\\?\\?\\?\\?\\]］ — ${KIND}（アンノーンX（プレイヤー0・ベンチ2））`);
const X_1 = new RegExp(`［XXXXX\\[\\?\\?\\?\\?\\?\\]］ — ${KIND}（アンノーンX（プレイヤー0・ベンチ1））`);
const ANGER_2 = new RegExp(`［ANGER\\[アンガー\\]］ — ${KIND}（アンノーンA（プレイヤー0・ベンチ2））`);
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

test("UN1 受理: うらのアンノーンのめざめるパワーで［XXXXX］・［ANGER］を選び、check・送信・受理の結果（コイン 3 枚・ダメージ 50）を示す", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "R-2 アンノーン構築盤面 U1（");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /めざめるパワー/ }).check();
  const x = stage(page, 2).getByRole("checkbox", { name: X_2 });
  const anger = stage(page, 2).getByRole("checkbox", { name: ANGER_1 });
  await expect(x).not.toBeChecked(); // 任意（自動で選ばない）
  await expect(anger).not.toBeChecked();
  await expect(stage(page, 2)).toContainText("ダメージが増えることは保証しない");
  await x.check();
  await anger.check();
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("特殊能力を使えるか・受理・完走の保証ではありません");
  await expect(panel(page).locator(".check-result")).toContainText("その効果がはたらいたとは限りません");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: アンノーン[N]"); // 公開（観測のとおり）
  await expect(coins(page).locator("li")).toHaveCount(3);
  await expect(opponentDamage(page, "イワーク")).toHaveText("50");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(coins(page).locator("li")).toHaveCount(3);
    await expect(opponentDamage(page, "イワーク")).toHaveText("50");
    expect(await viewer(page).innerHTML()).not.toMatch(/形の検査を通りました/);
  }
  expect(sent.checks).toEqual([["o1", "o3", "o2"]]); // 選んだ順のまま
  expect(sent.submits).toEqual([["o1", "o3", "o2"]]); // 自動で再送しない
});

test("UN2 XP1: ［XXXXX］つきの送信の拒否は本人だけに示し、［ANGER］へ直して検査し直すと受理する", async ({ page }) => {
  const sent = watch(page);
  await createScenario(page, "R-2 アンノーン構築盤面 U2（");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /めざめるパワー/ }).check();
  await stage(page, 2).getByRole("checkbox", { name: X_1 }).check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの形の検査を通りました");
  await panel(page).getByRole("button", { name: "送信" }).click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText("拒否（エンジン）: ワザを使う");
  await expect(results(viewer(page))).toContainText("UNRESOLVED_GROUP_POWER_COIN_ORDER");
  await expect(mine(page).locator(".active-slot .pokemon")).toHaveAttribute("aria-label", "バトル場: 裏向きのポケモン"); // 状態は変わらない
  await expect(opponentDamage(page, "ピチュー")).toHaveText("0");
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    expect(await viewer(page).innerHTML()).not.toMatch(/UNRESOLVED_GROUP_POWER_COIN_ORDER|拒否（エンジン）|アンノーン\[N\]|PF2-001/);
    await expect(coins(page)).toContainText("コインの出来事はまだありません");
  }
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /めざめるパワー/ }).check();
  await expect(stage(page, 2).getByRole("checkbox", { name: X_1 })).not.toBeChecked(); // 前の選択を自動で戻さない
  await stage(page, 2).getByRole("checkbox", { name: ANGER_2 }).check();
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの形の検査を通りました");
  await send.click();
  await expect(viewer(page).locator(".console")).toHaveAttribute("aria-busy", "false");
  await expect(results(viewer(page))).toContainText(/受理.*: ワザを使う/);
  await expect(coins(page).locator("li")).toHaveCount(1); // ベイビィのコイン（エンジンの公開のログのまま）
  expect(sent.checks).toEqual([["o1", "o2"], ["o1", "o3"]]);
  expect(sent.submits).toEqual([["o1", "o2"], ["o1", "o3"]]); // 自動の再送なし
});
