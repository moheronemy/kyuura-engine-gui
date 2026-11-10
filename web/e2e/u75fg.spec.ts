// U7-5f・g（v0.172）を、実際の接続層 + 固定版のエンジン（0.172.0・e26df79）+ 実際の renderer で確かめる。
// 固定例（server/kyuura_gui_server/scenarios.py。tools/build_u7_5fg_scenarios.py）:
// - カツラ・うらのカードの特殊能力（固定例・new_game）: 固定のデッキと seed で new_game を始め、準備から先は画面の操作だけ
// - フラッシュ（固定例・再生）: U7 の候補だけで送った合法な列を、後攻が自分の山札の並べ替えに答える決定の直前まで再生した盤面
// 同じ固定例・同じ選び方の接続層のテスト: server/tests/test_u7_5fg.py。対象と回数は固定（探して作り直すことはしない）。
import { expect, test, type Page } from "@playwright/test";
import { candidate, choose, createScenario, endTurn, mine, opponent, panel, results, selectSeat, setupToFirstTurn, stage, submitAndExpect, viewer } from "./helpers";

const coverage = (page: Page) => viewer(page).locator("details.coverage");

async function openCoverage(page: Page) {
  const details = coverage(page);
  if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
}

test("カツラ: 前は 2 段 → 3 段目は今の組だけ。1 段目を変えると 3 段目と遅れた check を捨てる → 2 枚で受理 → 観測で 2 枚", async ({ page }) => {
  await setupToFirstTurn(page, { scenario: "カツラ", mulligans: 1 });
  await choose(viewer(page), "エネルギーをつける");
  await expect(panel(page).locator("fieldset.stage")).toHaveCount(2); // カツラの前は今までの 2 段
  await panel(page).getByRole("button", { name: "やめる" }).click();
  await choose(viewer(page), "手札のトレーナーを使う");
  await stage(page, 1).getByRole("radio", { name: /PMCG6-093/ }).first().check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await submitAndExpect(viewer(page), /^受理/);

  // 1 つめの check の応答だけを遅らせる（その間に 1 段目を変える）
  let delayed = false;
  await page.route(/\/api\/seat\/[^/]+$/, async (route) => {
    const body = route.request().postDataJSON() as { type?: string } | null;
    if (body?.type === "check" && !delayed) {
      delayed = true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    await route.continue();
  });
  await choose(viewer(page), "エネルギーをつける");
  await expect(panel(page).locator("fieldset.stage")).toHaveCount(3);
  await expect(panel(page)).toContainText("カツラの効果で、3 段目に 2 枚目のエネルギーカードを選べます");
  await expect(stage(page, 3)).toContainText("段 1・2 を選ぶと");
  const firsts = stage(page, 1).getByRole("radio");
  await firsts.nth(0).check();
  await stage(page, 2).getByRole("radio", { name: /バトル場/ }).check();
  const third = stage(page, 3).getByRole("radio", { name: /PMCG1-098/ });
  const count = await third.count();
  expect(count).toBeGreaterThan(0);
  await third.first().check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click(); // 遅れる
  await firsts.nth(1).check(); // 1 段目を変える → 2・3 段目と検査の結果を捨てる
  await expect(stage(page, 3)).toContainText("段 1・2 を選ぶと");
  await page.waitForTimeout(2000); // 遅れた check の応答が届くまで待つ
  await expect(panel(page).locator(".check-result")).toHaveCount(0);
  await stage(page, 2).getByRole("radio", { name: /バトル場/ }).check();
  await expect(stage(page, 3).getByRole("radio", { name: "選ばない" })).toBeChecked();
  await stage(page, 3).getByRole("radio", { name: /PMCG1-098/ }).first().check();
  // 送る前の check（GUI の決まり）: 元の入力に戻しても、変える前の遅れた答えでは送れない
  const send = panel(page).getByRole("button", { name: "送信" });
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await expect(send).toBeEnabled();
  await stage(page, 3).getByRole("radio", { name: "選ばない" }).check(); // 2 枚目を外す → 送れない
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click(); // 2 枚目を省く入力も check が要る
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await expect(send).toBeEnabled();
  await stage(page, 3).getByRole("radio", { name: /PMCG1-098/ }).first().check(); // 2 枚目を選び直す → 送れない
  await expect(send).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  const sent = (await panel(page).locator("code", { hasText: /^\[/ }).last().textContent()) ?? "";
  expect(JSON.parse(sent)).toHaveLength(3); // [1 段目, 2 段目, 3 段目]（段の順）
  await submitAndExpect(viewer(page), /^受理: エネルギーをつける/);
  await expect(mine(page).locator(".active-slot")).toContainText("エネルギー（2）");
  await expect(candidate(viewer(page), "エネルギーをつける")).toHaveCount(0); // 2 枚のあと（GUI は数えない）
  await selectSeat(page, "プレイヤー1");
  await expect(opponent(page).locator(".active-slot")).toContainText("エネルギー（2）");
});

test("フラッシュ（再生した固定例）: 決定の回答者と番でない主体の R-4・番のプレイヤーの表示だけの候補（位置だけ・送れない）", async ({ page }) => {
  await createScenario(page, "フラッシュ");
  await selectSeat(page, "プレイヤー1");
  await openCoverage(page);
  await expect(coverage(page).getByLabel("当てはまる残り")).toContainText("R-4（API の対象範囲外・公開の状態から）");
  await choose(viewer(page), "決定に答える");
  const boxes = stage(page, 1).getByRole("checkbox");
  await expect(boxes).toHaveCount(5);
  for (let i = 0; i < 5; i++) await boxes.nth(i).check();
  await submitAndExpect(viewer(page), /^受理: 決定に答える/);
  await endTurn(page, "プレイヤー1");

  await selectSeat(page, "プレイヤー0");
  const faceUp = candidate(viewer(page), "表向きの山札のカードを確かめる");
  await expect(faceUp).toContainText("表示だけ（送れません）");
  await expect(faceUp.getByRole("button", { name: "この操作を選ぶ" })).toHaveCount(0);
  let sentForFaceUp = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/seat\//.test(r.url())) {
      const body = r.postDataJSON() as { type?: string } | null;
      if (body?.type === "check" || body?.type === "submit") sentForFaceUp += 1;
    }
  });
  await faceUp.getByRole("button", { name: "位置を表示する（表示だけ）" }).click();
  const positions = viewer(page).getByLabel("おもての山札の位置");
  await expect(positions.getByRole("listitem")).toHaveCount(4);
  await expect(positions.getByRole("listitem").first()).toContainText("相手（プレイヤー1）の山札・上から 2 枚目");
  await expect(positions.getByRole("listitem").first()).toContainText("owner: 1・position: 1（0 がいちばん上）");
  await expect(positions).not.toContainText("PMCG");
  await expect(viewer(page).locator(".display-only img, .display-only canvas")).toHaveCount(0);
  await expect(viewer(page).locator(".display-only").getByRole("button", { name: /送信|入力を検査/ })).toHaveCount(0);
  await openCoverage(page);
  await expect(coverage(page).getByLabel("表示だけの種類")).toContainText("表向きの山札のカードを確かめる");
  await expect(coverage(page).getByLabel("示していない経路")).toContainText("R-2");
  await expect(viewer(page).getByLabel("未対応の操作")).toHaveCount(0);
  await viewer(page).locator(".display-only").getByRole("button", { name: "閉じる" }).click();
  expect(sentForFaceUp).toBe(0); // check・submit を呼ばない

  await selectSeat(page, "プレイヤー1"); // 番でない主体: 候補はないが「操作がない」と言わない
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).toContainText("候補がなくても「操作がない」とは言えません");
  await openCoverage(page);
  await expect(coverage(page).getByLabel("当てはまる残り")).toContainText("R-4");
});

async function secretPlan(page: Page, cardId: string) {
  await setupToFirstTurn(page, { scenario: "うらのカードの特殊能力", mulligans: 0 });
  await choose(viewer(page), "手札のトレーナーを使う");
  await stage(page, 1).getByRole("radio", { name: /PMCG5-093/ }).first().check();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await submitAndExpect(viewer(page), /^受理/);
  await choose(viewer(page), "決定に答える");
  await stage(page, 1).getByRole("radio", { name: new RegExp(cardId) }).first().check(); // うらにするカード（0〜1 枚）
  await submitAndExpect(viewer(page), /^受理: 決定に答える/);
}

const faceDownPower = (page: Page) => candidate(viewer(page), "特殊能力を使う").filter({ hasText: "裏向きのポケモン" });

test("うらのマンキー: 本人の画面だけに［スパイ］（盤面はうらのまま）→ 相手・観戦者に出ない → check → 受理（おもてにしてから決定）", async ({ page }) => {
  await secretPlan(page, "PMCG2-028");
  await expect(faceDownPower(page)).toHaveCount(1);
  await expect(faceDownPower(page)).toContainText("［スパイ］");
  await expect(faceDownPower(page)).toContainText("あなただけが知るカード PMCG2-028");
  await expect(mine(page).locator(".bench-slot").getByLabel(/ベンチ1: 裏向きのポケモン/)).toBeVisible(); // 盤面は裏面のまま
  for (const seat of ["プレイヤー1", "観戦者"]) {
    await selectSeat(page, seat);
    await expect(viewer(page).locator(".console")).not.toContainText("スパイ");
    await expect(viewer(page).locator('.player-area[aria-label^="プレイヤー0"] .bench-slot')).toContainText("この閲覧者には、どのカードか見えません");
  }
  await selectSeat(page, "プレイヤー0");
  await faceDownPower(page).getByRole("button", { name: "この操作を選ぶ" }).click();
  const info = panel(page).getByLabel("特殊能力");
  await expect(info).toContainText("自分の裏向きのポケモン（ベンチ1。盤面ではうらのまま）");
  await expect(info).toContainText("「未確認」は使える・受理されるという意味ではありません");
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  await panel(page).getByRole("button", { name: "入力を検査" }).click();
  await expect(panel(page).locator(".check-result")).toContainText("受理・完走の保証ではありません");
  await submitAndExpect(viewer(page), /^受理（決定待ち）: 特殊能力を使う/);
  await expect(results(viewer(page))).toContainText("次: あなた（プレイヤー0）の決定への回答");
  await selectSeat(page, "プレイヤー1"); // 受理のあと、おもてにしたカードは観測で全員に公開
  await expect(viewer(page).locator('.player-area[aria-label^="プレイヤー0"] .bench-slot')).toContainText("マンキー");
});

// 0.175.0（U-R3a）から 2 段の型も組が完成すれば入力を返す。この固定例の番 1 は自分の場にカードがついたポケモンがなく組が完成しないので、今までどおり入力を返さない
// （2〜3 段の入力は e2e/u-r3a.spec.ts の構築盤面）
test("うらのロケット団のヒトカゲ: 組が完成しない場面では入力を返さず送れない（R-3 は本人の画面だけ）", async ({ page }) => {
  await secretPlan(page, "PMCG4-012");
  await expect(faceDownPower(page)).toContainText("［ほのおをもらう］");
  await openCoverage(page);
  await expect(coverage(page).getByLabel("当てはまる残り")).toContainText("R-3（入力を返していない・あなたの候補");
  await faceDownPower(page).getByRole("button", { name: "この操作を選ぶ" }).click();
  await expect(panel(page).getByRole("status").filter({ hasText: "入力非公開" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "入力を検査" })).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "送信" })).toBeDisabled();
  await selectSeat(page, "プレイヤー1");
  await expect(viewer(page).getByRole("region", { name: "操作候補" })).not.toContainText("ほのおをもらう");
  await openCoverage(page);
  await expect(coverage(page).getByLabel("当てはまる残り")).not.toContainText("R-3");
});
