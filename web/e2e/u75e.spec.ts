// U7-5e の特殊能力（use_power）を、実際の接続層 + 固定版のエンジン（0.171.0・74c8e1f）+ 実際の renderer で確かめる。
// 固定例（server/kyuura_gui_server/scenarios.py。tools/build_u7_5e_scenarios.py）:
// - ロケット団のヒトカゲ・ダークユンゲラー（固定例・new_game）: 固定のデッキと seed で new_game を始め、準備から先は画面の操作だけ
// - エナジートランス（固定例・再生）: U7 の候補だけで送った合法な列（準備・ベンチ・進化・エネルギー）を接続層が再生した盤面
// 同じ固定例・同じ選び方の接続層のテスト: server/tests/test_u7_5e.py。対象と回数は固定（探して作り直すことはしない）。
import { expect, test, type Page } from "@playwright/test";
import { attachToActive, candidate, choose, createScenario, endTurn, mine, opponent, panel, results, selectSeat, setupToFirstTurn, stage, submitAndExpect, viewer } from "./helpers";

async function checkThenSubmit(page: Page, outcome: RegExp) {
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled(); // 今の入力・今の取っ手の check が要る
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await submitAndExpect(viewer(page), outcome);
}

async function playBasic(page: Page, cardId: string) {
  await choose(viewer(page), "たねポケモンをベンチに出す");
  await stage(page, 1).getByRole("radio", { name: new RegExp(cardId) }).first().check();
  await submitAndExpect(viewer(page), /受理/);
}

const powerCandidate = (page: Page, name: string) => candidate(viewer(page), "特殊能力を使う").filter({ hasText: `［${name}］` });

test("ロケット団のヒトカゲ: 2 段（元 → エネルギー）。元を変えると後の段を捨てる → 受理 → 観測で移る → 同じ番には出ない", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "ロケット団のヒトカゲ", mulligans: 0 });
  await expect(viewer(page).getByLabel("未対応の操作")).toHaveCount(0); // v0.172（U7-5f）: 番の MAIN の not_covered_kinds は空（check_face_up_deck は表示だけの種類）
  await expect(viewer(page).getByLabel("評価した種類")).toContainText("特殊能力を使う");
  await playBasic(page, "PMCG4-012");
  await playBasic(page, "PMCG1-060");
  await attachToActive(page);
  await endTurn(page, "プレイヤー0");
  await endTurn(page, "プレイヤー1");
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "エネルギーをつける");
  await stage(page, 1).getByRole("radio").first().check();
  await stage(page, 2).getByRole("radio", { name: /PMCG1-060/ }).check();
  await submitAndExpect(viewer(page), /受理/);

  await expect(powerCandidate(page, "ほのおをもらう")).toHaveCount(1);
  await powerCandidate(page, "ほのおをもらう").getByRole("button", { name: "この操作を選ぶ" }).click();
  await expect(panel(page).getByLabel("特殊能力")).toContainText("特殊能力: ［ほのおをもらう］");
  await expect(stage(page, 2).getByRole("radio")).toHaveCount(0); // 元を選ぶまで後の段は選べない
  await stage(page, 1).getByRole("radio", { name: /PMCG1-060/ }).check();
  await stage(page, 2).getByRole("radio").first().check();
  await stage(page, 1).getByRole("radio", { name: /PMCG1-016/ }).check(); // 元を変える → 後の段の選択を捨てる
  await expect(stage(page, 2).getByRole("radio")).toHaveCount(1);
  await expect(stage(page, 2).getByRole("radio").first()).not.toBeChecked();
  await stage(page, 2).getByRole("radio").first().check();
  await checkThenSubmit(page, /^受理: 特殊能力を使う/);
  // 観測から: ポニータ（バトル場）のエネルギーはなくなり、ベンチのロケット団のヒトカゲへ移った（コラッタには残る）
  await expect(mine(page).locator(".active-slot")).toContainText("エネルギー（0）");
  await expect(mine(page).locator(".bench-slot").getByLabel(/ベンチ1: /)).toContainText("エネルギー（1）");
  await expect(powerCandidate(page, "ほのおをもらう")).toHaveCount(0); // 自分の番ごとに 1 回（エンジンが出さない）
  // 相手の画面: 入力・候補はない。エネルギーの移動は観測で見える
  await selectSeat(page, "プレイヤー1");
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("ほかのプレイヤーの操作待ち");
  await expect(opponent(page).locator(".active-slot")).toContainText("エネルギー（0）");
});

test("ダークユンゲラー: 入力なし（choices []）→ 受理（本人の決定）→ 手札のカードを選ぶ → 観測 → 同じ番には出ない", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "ダークユンゲラー", mulligans: 0 });
  await attachToActive(page);
  await endTurn(page, "プレイヤー0");
  await endTurn(page, "プレイヤー1");
  await selectSeat(page, "プレイヤー0");
  await choose(viewer(page), "進化させる");
  await stage(page, 1).getByRole("radio", { name: /PMCG4-034/ }).first().check();
  await stage(page, 2).getByRole("radio", { name: /バトル場/ }).check();
  await submitAndExpect(viewer(page), /受理/);
  const zones = mine(page).getByLabel("領域の枚数");
  const trashBefore = Number((await zones.locator("li", { hasText: "トラッシュ" }).textContent())?.match(/\d+/)?.[0]);
  await powerCandidate(page, "ぶっしつこうかん").getByRole("button", { name: "この操作を選ぶ" }).click();
  await expect(panel(page)).toContainText("この特殊能力に宣言といっしょに選ぶものはありません（choices: [] で送ります）");
  await expect(panel(page).locator("fieldset.stage")).toHaveCount(0);
  await checkThenSubmit(page, /^受理（決定待ち）: 特殊能力を使う/);
  await expect(results(viewer(page))).toContainText("次: あなた（プレイヤー0）の決定への回答");
  await choose(viewer(page), "決定に答える");
  await expect(panel(page)).toContainText("discard_from_hand");
  await stage(page, 1).getByRole("radio").first().check();
  await submitAndExpect(viewer(page), /^受理: 決定に答える/);
  await expect(zones.locator("li", { hasText: "トラッシュ" })).toHaveText(`トラッシュ ${trashBefore + 1}`);
  await expect(powerCandidate(page, "ぶっしつこうかん")).toHaveCount(0); // 自分の番ごとに 1 回
});

test("エナジートランス（再生した固定例）: 3 段。2 段目を変えると 3 段目を捨てる → 受理 → 両方の画面の観測で移る", async ({ page }) => {
  await createScenario(page, "エナジートランス");
  await selectSeat(page, "プレイヤー0");
  const before = await mine(page).locator(".active-slot").textContent();
  const count = Number(before?.match(/エネルギー（(\d+)）/)?.[1]);
  await powerCandidate(page, "エナジートランス").getByRole("button", { name: "この操作を選ぶ" }).click();
  const info = panel(page).getByLabel("特殊能力");
  await expect(info.locator(".attack-text")).toContainText("エネルギー"); // 公開カード定義の印刷の説明
  await expect(info).not.toContainText("説明なし");
  await stage(page, 1).getByRole("radio", { name: /PMCG1-011/ }).check();
  await expect(stage(page, 3).getByRole("radio")).toHaveCount(0);
  await stage(page, 2).getByRole("radio").nth(0).check();
  await stage(page, 3).getByRole("radio").first().check();
  await stage(page, 2).getByRole("radio").nth(1).check(); // 2 段目を変える → 3 段目を捨てる
  await expect(stage(page, 3).getByRole("radio").first()).not.toBeChecked();
  await stage(page, 3).getByRole("radio").first().check();
  await checkThenSubmit(page, /^受理: 特殊能力を使う/);
  await expect(mine(page).locator(".active-slot")).toContainText(`エネルギー（${count - 1}）`);
  await expect(mine(page).locator(".bench-slot")).toContainText("エネルギー（1）");
  await expect(powerCandidate(page, "エナジートランス")).toHaveCount(1); // 回数の制限はない（エンジンが続けて出す）
  await selectSeat(page, "観戦者");
  await expect(viewer(page).locator('.player-area[aria-label^="プレイヤー0"] .active-slot')).toContainText(`エネルギー（${count - 1}）`);
});
