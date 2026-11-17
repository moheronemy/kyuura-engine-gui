// 0.192.0（R-2 のアンノーンの自己持ち主）: 2 段目の with_power の選べるものに、バトル場（zone: active・face_down: true・card_id なし）の持ち主が来たときの、
// 実行時の検証（validate.ts）と表示名（addonLabel）。
// 出典: 「実応答」は test/r2UnownSelf.ts（導入した 0.192.0 の接続層の HTTP の口の応答そのまま）。「人工」はテストの名前に書き、実応答を写して 1 か所だけ変えたもの。
import { describe, expect, it } from "vitest";
import * as V from "../api/validate";
import type { InputOption, Observation } from "../api/types";
import { addonLabel } from "./DecisionPanel";
import * as T from "../test/r2UnownSelf";

type Body = { response: { stages: { options?: Record<string, unknown>[] }[] } };
const names = () => undefined;
const powers = (body: unknown) => ((body as Body).response.stages[1]!.options ?? []) as unknown as InputOption[];
const obsOf = (seat: "0" | "1" | "spectator") => V.observation((T.R2US_X_AX.views[seat] as { observation: unknown }).observation) as Observation;

describe("R-2 のアンノーンの自己持ち主: 選べるものの検証と表示名", () => {
  it("実応答: card_id のない自己持ち主（zone active・face_down）を受け付け、エンジンの並び（自己 → ベンチ）のまま返す", () => {
    const body = V.inputsResponse(T.R2US_X_AX.inputs);
    const [self, a, x] = powers(body);
    expect(self).toMatchObject({ addon: "with_power", zone: "active", face_down: true, power: "XXXXX[?????]" });
    expect("card_id" in self!).toBe(false);
    expect([a!.zone, x!.zone]).toEqual(["bench", "bench"]);
  });

  it("実応答: 表示名は公開の場（裏向き・バトル場）と力の名前だけ。本人の観測の real（本当のカード）を読まない", () => {
    const [self, a, x] = powers(T.R2US_X_AX.inputs);
    const own = obsOf("0");
    expect(JSON.stringify(own)).toContain("アンノーンX"); // 本人の観測には real がある（使わないことの確かめの前提）
    const kind = "自分の場のポケモンの、ワザといっしょに使う特殊能力";
    expect(addonLabel(self!, own, names)).toBe(`［XXXXX[?????]］ — ${kind}（裏向きのポケモン（プレイヤー0・バトル場））`);
    expect(addonLabel(a!, own, names)).toBe(`［ANGER[アンガー]］ — ${kind}（アンノーンA（プレイヤー0・ベンチ1））`);
    expect(addonLabel(x!, own, names)).toBe(`［XXXXX[?????]］ — ${kind}（アンノーンX（プレイヤー0・ベンチ2））`);
    expect(addonLabel(self!, null, names)).toBe(`［XXXXX[?????]］ — ${kind}（ポケモン番号 ${self!.pokemon as number}）`); // 観測がないときは今までの表示のまま
  });

  it("人工: face_down のない選べるものは、うらの場のポケモンと番号が同じでも裏向きの場所に読みかえない", () => {
    const [self] = powers(T.R2US_X_AX.inputs);
    const { face_down: _drop, ...plain } = self!;
    expect(addonLabel(plain as InputOption, obsOf("0"), names)).toMatch(/（ポケモン番号 \d+）$/);
  });

  it("人工: 自己持ち主に card_id があれば、知らない形として止める（うらのポケモンにカード ID は来ない）", () => {
    const body = structuredClone(T.R2US_X_AX.inputs) as unknown as Body;
    body.response.stages[1]!.options![0]!.card_id = "neo4-065";
    expect(() => V.inputsResponse(body)).toThrow();
  });
});
