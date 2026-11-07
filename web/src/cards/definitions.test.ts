// 公開カード定義の応答の検証（接続層の拡張の口。模擬の応答）。
import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS, ENERGY_RECORD, TRAINER_RECORD, cardDefinitions, pokemonRecord } from "../test/fixtures";
import { CardDefinitionsError, cardDefinitionsResponse, isCardId, loadCardDefinitions } from "./definitions";

describe("公開カード定義の取得とスキーマ", () => {
  it("封筒・schema・出典を確かめて、記録を組み立て直す", async () => {
    const defs = await loadCardDefinitions({ request: async (method, path) => (method === "GET" && path === "/api/card-definitions" ? CARD_DEFINITIONS : null) });
    expect(defs.size).toBe(7);
    expect(defs.source).toEqual({ format: "kyuura-engine card extract 1", engine_version: "0.166.0", sha256_method: "kyuura-gui canonical-json 1", sha256: "0".repeat(64) });
    const record = defs.get("PMCG1-058");
    expect(record?.pokemon?.hp).toBe(70);
    expect(record?.jp_print).toEqual({ level: 33, rarity: "●(C)" });
    expect(defs.get("PMCG1-091")?.trainer).toEqual({ text: { ja: "説明", en: null } });
    expect(defs.get("PMCG1-102")?.energy).toEqual({ kind: "basic", provides: ["fighting"], text: { ja: null, en: null } });
  });

  it("描画に使わない項目を持ち込まない", () => {
    const defs = cardDefinitionsResponse(cardDefinitions([{ ...TRAINER_RECORD, notes: ["x"], source_ids: { a: 1 } }]));
    expect(Object.keys(defs.get("PMCG1-091") ?? {}).sort()).toEqual(["category", "energy", "id", "jp_print", "jp_set", "name", "pokemon", "trainer"]);
  });

  it.each([
    ["封筒", { ...CARD_DEFINITIONS, gui_server: 2 }],
    ["種類", { ...CARD_DEFINITIONS, kind: "cards" }],
    ["schema", { ...CARD_DEFINITIONS, schema: "other" }],
    ["schema の版（1: バイト列の sha256 の版）", { ...CARD_DEFINITIONS, schema_version: 1 }],
    ["schema の版（知らない版）", { ...CARD_DEFINITIONS, schema_version: 3 }],
    ["sha256 の方式がない", { ...CARD_DEFINITIONS, source: { ...CARD_DEFINITIONS.source, sha256_method: undefined } }],
    ["sha256 の方式が違う", { ...CARD_DEFINITIONS, source: { ...CARD_DEFINITIONS.source, sha256_method: "bytes" } }],
    ["出典の形式", { ...CARD_DEFINITIONS, source: { ...CARD_DEFINITIONS.source, format: "x" } }],
    ["cards", { ...CARD_DEFINITIONS, cards: {} }],
    ["誤りの封筒", { gui_server: 1, ok: false, error: { code: "GUI_CARD_DATA_UNAVAILABLE", message: "x" } }],
    ["null", null],
  ])("全体の形が違えば失敗にする（%s）", (_, value) => {
    expect(() => cardDefinitionsResponse(value)).toThrow(CardDefinitionsError);
  });

  it("形の違う記録・重なった ID は使わない（未知のカードとして扱う）", () => {
    const defs = cardDefinitionsResponse(
      cardDefinitions([
        pokemonRecord("OK-1", "よい"),
        pokemonRecord("BAD-HP", "わるい", { hp: "70" }),
        { ...ENERGY_RECORD, id: "../etc" },
        { ...TRAINER_RECORD, category: "stadium" },
        { ...TRAINER_RECORD, id: "DUP-1" },
        { ...TRAINER_RECORD, id: "DUP-1" },
        "not a record",
      ]),
    );
    expect(defs.get("OK-1")).toBeDefined();
    for (const id of ["BAD-HP", "../etc", "DUP-1"]) expect(defs.get(id)).toBeUndefined();
    expect(defs.size).toBe(1);
    expect(defs.omitted).toBe(6);
  });

  it("カード ID の形", () => {
    expect(isCardId("PMCG1-058")).toBe(true);
    expect(isCardId("NIP1X-001")).toBe(true);
    for (const bad of ["", "-1", "a/b", "a b", "x".repeat(33), "<img>"]) expect(isCardId(bad)).toBe(false);
  });
});
