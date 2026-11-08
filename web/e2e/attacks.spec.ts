// U7-4 のワザの宣言を、実際の接続層 + 固定版のエンジン（0.166.0）+ 実際の renderer で確かめる。
// 対戦は通常の new_game から画面の操作だけで進める（構築盤面・検証用の固定例ではない）。接続層はテスト専用の設定で seed を固定して
// 起動している（playwright.config.ts。seed・操作の列はブラウザへ返らない）。ランダムな対戦を作り直して探すことはしない。
// 同じ seed・同じ選び方の接続層のテスト: server/tests/test_attacks.py。
import { expect, test } from "@playwright/test";
import {
  attachToActive,
  candidate,
  choose,
  drawn,
  endTurn,
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

const MOLTRES_DECK = "ES2-005 4\nPMCG1-098 56"; // ファイヤー（ドライアップ）4 枚・炎エネルギー 56 枚

test("プリセットのデッキ: エネルギー → ジャブ（check → 送信）→ ダメージと番の移り → 次の番のジャブできぜつ → サイドの決定 → 終局", async ({ page }) => {
  await setupToFirstTurn(page, { mulligans: 1 });
  const area = viewer(page);
  // coverage: ワザは評価した種類（エネルギーがないので今は候補に出ない）。未対応の操作に入らない。番は partial のまま
  await expect(area.getByLabel("評価して候補に出さなかった種類")).toContainText("ワザを使う");
  await expect(area.getByLabel("未対応の操作")).not.toContainText("ワザを使う");
  await expect(area.getByLabel("未対応の操作")).toContainText("表向きの山札のカードを確かめる"); // U7-5 でトレーナーは評価する種類になった
  await attachToActive(page);

  // ワザの選択: エンジンが返した名前・必要なエネルギー・印刷のダメージの表示（予測ではない）・出どころ
  await choose(area, "ワザを使う");
  const jab = stage(page, 1).locator(".options > li").filter({ hasText: "［ジャブ］" });
  await expect(jab).toContainText("必要なエネルギー: 闘 1 個");
  await expect(jab).toContainText("ダメージの表示（印刷）: 20");
  await expect(jab).toContainText("与えるダメージではありません");
  await expect(jab).toContainText("出どころ: 今の姿のカードのワザ");
  await expect(jab).toContainText("送れる（後で止まりうる）");
  await expect(stage(page, 2)).toContainText("宣言といっしょに選べるものはありません");
  await expect(panel(page)).toContainText("受理のあとにエンジンが決定として聞きます");
  // 画像を押すと、その選択肢を選ぶだけ（送らない）
  await jab.locator(".card-image").click();
  await expect(jab.getByRole("radio")).toBeChecked();
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // 今の入力の check が要る
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  const opponentActive = opponent(page).locator(".active-slot .pokemon");
  const damageBefore = await opponentActive.getByLabel("今の状態（観測の値）").textContent();
  expect(damageBefore).toContain("ダメージ0");
  await submitAndExpect(area, /^受理: ワザを使う/);
  await expect(results(area)).toContainText("次: プレイヤー1の番の操作");
  // 観測から: 相手のバトル場のダメージと、番の移り（GUI で先回りして計算しない）
  await expect(opponentActive.getByLabel("今の状態（観測の値）")).toContainText("ダメージ20");
  await expect(area.getByRole("region", { name: "対戦の状態" })).toContainText("プレイヤー1の番");
  await expect(candidate(area, "ワザを使う")).toHaveCount(0);

  // 相手の番（相手から見ても同じ公開のダメージ）。番を終える
  await selectSeat(page, "プレイヤー1");
  await expect(mine(page).locator(".active-slot .pokemon").getByLabel("今の状態（観測の値）")).toContainText("ダメージ20");
  await endTurn(page, "プレイヤー1");

  // 次の番: ジャブできぜつ → 受理（決定待ち: 本人のサイドを取る決定）→ 相手は待つ → 答えると終局
  await selectSeat(page, "プレイヤー0");
  await attachToActive(page);
  const knocked = await drawn(opponent(page).locator(".active-slot")).first().elementHandle();
  await choose(area, "ワザを使う");
  await stage(page, 1).getByRole("radio", { name: /［ジャブ］/ }).check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await submitAndExpect(area, /^受理（決定待ち）: ワザを使う/);
  await expect(results(area)).toContainText("次: あなた（プレイヤー0）の決定への回答");
  expect(await knocked!.evaluate((c) => (c as HTMLCanvasElement).isConnected)).toBe(false); // きぜつで場から移ったカードの古い Canvas は使い回さない
  await expect(candidate(area, "サイドを取る")).toHaveCount(1);
  await selectSeat(page, "プレイヤー1");
  await expect(viewer(page)).toContainText("ほかのプレイヤーの操作待ち");
  await expect(viewer(page).getByRole("button", { name: "この操作を選ぶ" })).toHaveCount(0);
  await selectSeat(page, "プレイヤー0");
  await choose(area, "サイドを取る");
  await stage(page, 1).getByRole("radio").first().check();
  await submitAndExpect(area, /^受理（対戦が終わりました）: サイドを取る/);
  await expect(area.getByRole("region", { name: "対戦の状態" })).toContainText("終局");
  await expect(area.getByRole("button", { name: "この操作を選ぶ" })).toHaveCount(0);
});

test("ファイヤーのデッキ: ドライアップの宣言 → 受理（対象は宣言のあとの決定。本人の回答待ち）→ 答えると受理のあと停止", async ({ page }) => {
  await setupToFirstTurn(page, { decks: [MOLTRES_DECK, "preset:hitmonchan-dewgong"], mulligans: 1 });
  const area = viewer(page);
  await attachToActive(page);
  await expect(candidate(area, "ワザを使う")).toHaveCount(0); // 炎 1 個では宣言できない（エンジンの確かめ）
  await endTurn(page, "プレイヤー0");
  await endTurn(page, "プレイヤー1");
  await selectSeat(page, "プレイヤー0");
  await attachToActive(page);

  await choose(area, "ワザを使う");
  const options = stage(page, 1).locator(".options > li");
  await expect(options).toHaveCount(1); // ほのおのつばさ（炎 3・無色 1）はエンジンが出さない
  const dry = options.first();
  await expect(dry).toContainText("［ドライアップ］");
  await expect(dry).toContainText("炎 2 個");
  await expect(dry).toContainText("ダメージの表示（印刷）: なし");
  await expect(dry).toContainText("コインを投げ続け");
  await expectPainted(drawn(dry).first());
  await dry.getByRole("radio").check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await submitAndExpect(area, /^受理（決定待ち）: ワザを使う/);
  await expect(results(area)).toContainText("次: あなた（プレイヤー0）の決定への回答");

  // 相手は待つ（候補なし）。本人が既存の決定の入力で対象を選ぶ
  await selectSeat(page, "プレイヤー1");
  await expect(viewer(page)).toContainText("ほかのプレイヤーの操作待ち");
  await selectSeat(page, "プレイヤー0");
  await choose(area, "決定に答える");
  await expect(panel(page)).toContainText("select_pokemon");
  await stage(page, 1).getByRole("radio").first().check();
  await submitAndExpect(area, /^受理（そのあと停止）: 決定に答える/);
  await expect(results(area)).toContainText("宣言の拒否ではありません");
  await expect(results(area)).toContainText("区分: 未裁定（ゲーム上の禁止ではありません）");
  await expect(area.getByRole("region", { name: "対戦の状態" })).toContainText("停止");
  await expect(area.getByRole("button", { name: "この操作を選ぶ" })).toHaveCount(0);
  // 相手・観戦者も観測から停止を表示する
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(viewer(page).getByRole("region", { name: "対戦の状態" })).toContainText("停止");
  }
});

test("狭い画面: ワザの入力を画像からの選択で送る（横にあふれない）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupToFirstTurn(page, { mulligans: 1 });
  await attachToActive(page);
  await choose(viewer(page), "ワザを使う");
  const jab = stage(page, 1).locator(".options > li").first();
  await jab.locator(".card-image").click();
  await expect(jab.getByRole("radio")).toBeChecked();
  await expect(jab).toContainText("ダメージの表示（印刷）: 20");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("エンジンの検査を通りました");
  await submitAndExpect(viewer(page), /^受理: ワザを使う/);
  await expect(opponent(page).locator(".active-slot .pokemon").getByLabel("今の状態（観測の値）")).toContainText("ダメージ20");
});
