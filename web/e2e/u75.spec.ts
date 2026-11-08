// U7-5a〜d の 5 種類を、実際の接続層 + 固定版のエンジン（0.170.0・0885d66）+ 実際の renderer で確かめる。
// 固定例（server/kyuura_gui_server/scenarios.py）:
// - 「（固定例・new_game）」の 5 つは、固定のデッキと seed で new_game を始めるだけで、準備から先は画面の操作だけで進める（通常の合法な操作の列）
// - 「（固定例・再生）」の「ばける」は、GUI の対象外の特殊能力を含む列を接続層が再生した盤面（再生のあとの解除は画面から送る）
// 同じ固定例・同じ選び方の接続層のテスト: server/tests/test_u7_5.py。対象と回数は固定（探して作り直すことはしない）。
import { expect, test } from "@playwright/test";
import {
  attachToActive,
  candidate,
  choose,
  createScenario,
  drawn,
  expectPainted,
  mine,
  opponent,
  panel,
  results,
  selectSeat,
  setupToFirstTurn,
  stage,
  submitAndExpect,
  viewer,
} from "./helpers";

async function checkThenSubmit(page: import("@playwright/test").Page, outcome: RegExp) {
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // 今の入力の check が要る
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await submitAndExpect(viewer(page), outcome);
}

async function playTrainer(page: import("@playwright/test").Page, cardId: string, outcome: RegExp = /^受理: 手札のトレーナーを使う/) {
  await choose(viewer(page), "手札のトレーナーを使う");
  await expect(panel(page)).toContainText("ここで選ぶのは手札のトレーナーカード 1 枚だけです");
  await stage(page, 1).getByRole("radio", { name: new RegExp(cardId) }).first().check();
  await checkThenSubmit(page, outcome);
}

test("ラッキースタジアム: 手札から出す（トレーナー）→ 場のスタジアムを使う（入力なし・choices []）→ 同じ番には出ない（狭い画面）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setupToFirstTurn(page, { scenario: "ラッキースタジアム", mulligans: 0 });
  const area = viewer(page);
  await expect(area.getByLabel("未対応の操作")).toHaveCount(0); // v0.172（U7-5f）: 番の MAIN の not_covered_kinds は空（check_face_up_deck は表示だけの種類）
  await expect(area.getByLabel("評価した種類")).toContainText("手札のトレーナーを使う");
  await playTrainer(page, "PRN-015");
  await expect(area.getByText(/^スタジアム: .+（プレイヤー0）$/)).toBeVisible(); // 盤面の場のスタジアム（観測の値。持ち主）
  await expect(candidate(area, "場のスタジアムを使う")).toContainText("持ち主: プレイヤー0");
  await choose(area, "場のスタジアムを使う");
  const info = panel(page).getByLabel("場のスタジアム");
  await expect(info).toContainText("持ち主（出したプレイヤー）: あなた（プレイヤー0）");
  await expect(info).toContainText("使うのは: 番のプレイヤー（あなた・プレイヤー0）");
  await expect(panel(page)).toContainText("この効果に選ぶものはありません（choices: [] で送ります）");
  await expect(panel(page).locator("fieldset.stage")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // 狭い画面で横にはみ出さない
  await checkThenSubmit(page, /^受理: 場のスタジアムを使う/);
  await expect(candidate(area, "場のスタジアムを使う")).toHaveCount(0); // 2 回目はエンジンが候補に出さない（GUI は数えない）
});

test("ヤマブキシティジム: エネルギーをつける → 手札から出す → 使う（エネルギーとついているポケモンを選ぶ）→ 観測で手札にもどる", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "ヤマブキシティジム", mulligans: 0 });
  await attachToActive(page);
  await playTrainer(page, "PMCG6-090");
  await choose(viewer(page), "場のスタジアムを使う");
  await expect(panel(page).getByLabel("場のスタジアム")).toContainText("ヤマブキシティジム");
  const energy = stage(page, 1).getByRole("radio", { name: /PMCG1-101（ついている: .*（バトル場））/ });
  await energy.check();
  const handBefore = await mine(page).getByLabel("領域の枚数").textContent();
  await checkThenSubmit(page, /^受理: 場のスタジアムを使う/);
  await expect(mine(page).getByLabel("領域の枚数")).not.toHaveText(handBefore ?? "");
  await expect(mine(page).locator(".active-slot")).not.toContainText("PMCG1-101");
});

test("マチスの秘策: 使う → 受理（本人の決定）→ うらにする → 相手にカード情報なし → おもてにする → 観測で新しい画像", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "マチスの秘策", mulligans: 0 });
  await playTrainer(page, "PMCG5-093", /^受理（決定待ち）: 手札のトレーナーを使う/);
  await expect(results(viewer(page))).toContainText("次: あなた（プレイヤー0）の決定への回答");
  await choose(viewer(page), "決定に答える");
  await expect(panel(page)).toContainText("マチスの秘策: うらにしてベンチに出すカード");
  await stage(page, 1).getByRole("radio", { name: /PMCG1-014/ }).check();
  await submitAndExpect(viewer(page), /^受理: 決定に答える/);
  const ownSlot = mine(page).getByLabel("ベンチ1: 裏向きのポケモン");
  await expect(ownSlot).toContainText("あなたにだけ見えるカード:");
  await expect(drawn(ownSlot)).toHaveCount(0); // 場ではうらのまま（表の画像を描かない）
  // 相手・観戦者: うらのカードの中身は DOM にも描画にもない
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    const p0 = viewer(page).locator('.player-area[aria-label^="プレイヤー0"]');
    await expect(p0.getByLabel("ベンチ1: 裏向きのポケモン")).toBeVisible();
    expect(await p0.innerHTML()).not.toMatch(/PMCG1-014|ヒトカゲ/);
  }
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "うらのカードをおもてにする");
  await expect(panel(page)).toContainText("ここでは予告しません");
  const option = stage(page, 1).locator(".options > li").filter({ hasText: "裏向きのポケモン（ベンチ1）" });
  expect(await option.innerHTML()).not.toMatch(/PMCG1-014|ヒトカゲ/);
  await option.getByRole("radio").check();
  await checkThenSubmit(page, /^受理: うらのカードをおもてにする/);
  await selectSeat(page, "プレイヤー1");
  const revealed = opponent(page).getByLabel("ベンチ1: ヒトカゲ");
  await expect(revealed).toBeVisible();
  await expectPainted(drawn(revealed).first());
});

test("ピッピ人形: 手札から出す（トレーナー）→ 場からすてる（観測でベンチが空く）", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "ピッピ人形", mulligans: 0 });
  await playTrainer(page, "PMCG1-091");
  await expect(mine(page).locator(".bench-slot")).toContainText("PMCG1-091");
  await choose(viewer(page), "化石・人形を場からすてる");
  await expect(panel(page)).toContainText("ついているカードもいっしょにトラッシュします");
  await stage(page, 1).getByRole("radio", { name: /PMCG1-091/ }).check();
  await checkThenSubmit(page, /^受理: 化石・人形を場からすてる/);
  await expect(mine(page).locator(".bench-slot")).toContainText("なし");
});

test("錯乱ジム: 使った側の宣言のあと相手が答える → 使えない「使う」は相手にだけ拒否 → 辞退で番にもどる", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "錯乱ジム", mulligans: 1 });
  await playTrainer(page, "PMCG5-087");
  await playTrainer(page, "PMCG1-093", /^受理（決定待ち）: 手札のトレーナーを使う/);
  await expect(results(viewer(page))).toContainText("次: プレイヤー1の決定への回答（相手が答えます。答えるまで待ちます）");
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("ほかのプレイヤーの操作待ち");
  await selectSeat(page, "プレイヤー1");
  await choose(viewer(page), "決定に答える");
  await expect(panel(page)).toContainText("錯乱ジム: 相手が使ったトレーナーを、かわりに使うか");
  await stage(page, 1).getByRole("radio", { name: /値 1/ }).check();
  await submitAndExpect(viewer(page), /^拒否（エンジン）: 決定に答える/);
  await expect(results(viewer(page))).toContainText("NO_POKEMON_CARD_IN_HAND");
  await expect(results(viewer(page))).toContainText("この結果は送ったあなたにだけ表示しています");
  for (const seat of ["プレイヤー0", "観戦者"]) {
    await selectSeat(page, seat);
    expect(await viewer(page).innerHTML()).not.toMatch(/NO_POKEMON_CARD_IN_HAND|拒否（エンジン）/);
  }
  await selectSeat(page, "プレイヤー1");
  await choose(viewer(page), "決定に答える");
  await stage(page, 1).getByRole("radio", { name: "選ばない" }).check();
  await submitAndExpect(viewer(page), /^受理: 決定に答える/);
  await expect(results(viewer(page))).toContainText("次: プレイヤー0の番の操作");
  await selectSeat(page, "プレイヤー0");
  await expect(candidate(viewer(page), "番を終える")).toHaveCount(1);
});

test("「ばける」の解除（再生した固定例）: 場のポケモンを選ぶ → のせたカードは観測でトラッシュ", async ({ page }) => {
  await createScenario(page, "「ばける」の解除");
  await selectSeat(page, "プレイヤー0");
  const zones = mine(page).getByLabel("領域の枚数");
  const before = Number((await zones.locator("li", { hasText: "トラッシュ" }).textContent())?.match(/\d+/)?.[0]);
  await choose(viewer(page), "「ばける」でのせたカードを外す");
  await stage(page, 1).getByRole("radio", { name: /PMCG5-019/ }).check();
  await checkThenSubmit(page, /^受理: 「ばける」でのせたカードを外す/);
  await expect(zones.locator("li", { hasText: "トラッシュ" })).toHaveText(`トラッシュ ${before + 1}`);
  await mine(page).getByText(/^トラッシュ（/).click();
  await expect(mine(page).locator("details").filter({ hasText: "トラッシュ（" })).toContainText("PMCG1-017");
});
