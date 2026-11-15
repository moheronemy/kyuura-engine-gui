// 候補の一覧（components/Panels.tsx の CandidatesPanel）で、not_implemented かつ reasons に no_eligible_card の候補だけを中立の表示にする（0.186.0 の追従の続き）。
// 一覧は選べるものを持たないので、規約による除外かそれ以外かを決めない。共通の処理可能性の表示（PROCESSABILITY_TEXT・ProcessabilityBadge）は変えない。
// 出典: 「実応答」は test/tr3.ts・test/f1.ts（固定版のエンジンの接続層の応答そのまま）。「人工」は実応答の候補を写して reasons だけを変えたもの（出典を分けた）。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LegalActions } from "../api/types";
import * as V from "../api/validate";
import * as F1 from "../test/f1";
import * as T from "../test/tr3";
import { CandidatesPanel } from "./Panels";

const clone = <X,>(v: X): X => JSON.parse(JSON.stringify(v)) as X;
const legalOf = (raw: unknown): LegalActions => V.candidatesResponse(clone(raw)).response;
const renderList = (legal: LegalActions) => render(<CandidatesPanel legal={legal} selectedId={null} disabled={false} onSelect={() => undefined} />);
const item = (kind: string) =>
  within(screen.getByRole("region", { name: "操作候補" }))
    .getAllByRole("listitem")
    .find((li) => li.querySelector(".candidate-head code")?.textContent === kind)!;
/** 文字・色の class・title・説明に「未実装」の案内が残らない。 */
function expectNoNotImplementedHint(li: HTMLElement) {
  expect(li.textContent).not.toMatch(/未実装|エンジンが未対応です/);
  expect(li.querySelector(".proc-not_implemented")).toBeNull();
  for (const el of Array.from(li.querySelectorAll("[title]"))) expect(el.getAttribute("title")).not.toMatch(/未実装|未対応/);
}

describe("候補の一覧の not_implemented・no_eligible_card", () => {
  it("1. 実応答（TR3 の全除外の候補）: 「実行できる選択肢なし」と「入力画面で理由を確認できます」。規約とは断定しない", () => {
    for (const raw of [T.TR3_GUST.candidates, T.TR3_ALL_EXCLUDED.candidates]) {
      const { unmount } = renderList(legalOf(raw));
      const li = item("play_trainer");
      expect(li.querySelector(".badges")!.textContent).toMatch(/実行できる選択肢なし/);
      expect(li.textContent).toMatch(/入力画面で理由を確認できます/);
      expect(li.textContent).not.toMatch(/規約により使用不可/);
      expectNoNotImplementedHint(li);
      expect(within(li).getByRole("button", { name: "この操作を選ぶ" })).toBeEnabled(); // 従来どおり開ける
      unmount();
    }
  });

  it("2. 人工: 同じ組み合わせで規約以外の理由も並ぶ候補も、同じ中立の表示（規約とも未実装とも断定しない）", () => {
    const legal = legalOf(T.TR3_GUST.candidates);
    const c = legal.candidates.find((x) => x.kind === "play_trainer")!;
    c.reasons = ["no_eligible_card", "use_condition_not_evaluated"];
    renderList(legal);
    const li = item("play_trainer");
    expect(li.querySelector(".badges")!.textContent).toMatch(/実行できる選択肢なし/);
    expect(li.textContent).not.toMatch(/規約/);
    expectNoNotImplementedHint(li);
  });

  it("3. 実応答: no_eligible_card のないほかの not_implemented（F-1 のワザ）は従来どおり「未実装」", () => {
    renderList(legalOf(F1.F1_ENERGY_CANDIDATES));
    const li = item("use_attack");
    expect(li.querySelector(".badges .proc-not_implemented")).not.toBeNull();
    expect(li.querySelector(".badges")!.textContent).toMatch(/未実装/);
    expect(li.textContent).not.toMatch(/実行できる選択肢なし|入力画面で理由を確認できます/);
  });

  it("4. 実応答: unresolved_ruling（CURRENT の同じ盤面）は従来どおり「未裁定」", () => {
    renderList(legalOf(T.CUR_GUST.candidates));
    const li = item("play_trainer");
    expect(li.querySelector(".badges .proc-unresolved_ruling")).not.toBeNull();
    expect(li.querySelector(".badges")!.textContent).toMatch(/未裁定/);
    expect(li.textContent).not.toMatch(/実行できる選択肢なし/);
  });

  it("送れる区分の候補（TR3 の混在）は変わらない", () => {
    renderList(legalOf(T.TR3_MIXED.candidates));
    const li = item("play_trainer");
    expect(li.querySelector(".badges .proc-may_stop_later")).not.toBeNull();
    expect(li.textContent).not.toMatch(/実行できる選択肢なし/);
  });
});
