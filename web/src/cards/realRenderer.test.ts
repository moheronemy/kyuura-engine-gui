// 実際の kyuura-card-renderer（固定コミット）の fromEngineCard で、接続層の表の記録を変換する（Canvas への描画はしない。
// 描画の確認はブラウザ（e2e/card-images.spec.ts）。部品の非同期の扱いは模擬の描画で CardImages.test.tsx が確かめる）。
import * as rendererPackage from "kyuura-card-renderer";
import { describe, expect, it } from "vitest";
import { ENERGY_RECORD, TRAINER_RECORD, cardDefinitions, pokemonRecord } from "../test/fixtures";
import { cardDefinitionsResponse } from "./definitions";
import { realRenderer } from "./renderer";

const defs = cardDefinitionsResponse(
  cardDefinitions([
    pokemonRecord("PMCG1-058", "エビワラー"),
    pokemonRecord("BABY-1", "ピィ", { stage: "baby", hp: 30, types: ["colorless"] }),
    pokemonRecord("DARK-1", "わるいポケモン", { types: ["darkness"] }),
    { ...pokemonRecord("NEO-1", "neo のポケモン"), jp_set: "neo1" },
    pokemonRecord("POWER-1", "パワーのポケモン", { powers: [{ kind: "pokemon_power", name: { ja: "ちから", en: null }, text: { ja: "説明", en: null } }] }),
    TRAINER_RECORD,
    ENERGY_RECORD,
    { ...ENERGY_RECORD, id: "SP-1", name: { ja: "特殊エネルギー", en: null }, energy: { kind: "special", provides: ["colorless", "colorless"], text: { ja: "説明", en: null } } },
  ]),
);

function item(id: string) {
  const record = defs.get(id);
  if (!record) throw new Error(id);
  return realRenderer.toItem(record);
}

describe("実際の renderer の公開 API", () => {
  it("パッケージの入口から使う関数を export している", () => {
    expect(typeof rendererPackage.fromEngineCard).toBe("function");
    expect(typeof rendererPackage.renderToCanvas).toBe("function");
    expect(typeof rendererPackage.cancelRenderToCanvas).toBe("function");
    expect(rendererPackage.CARD_WIDTH).toBe(400);
    expect(rendererPackage.CARD_HEIGHT).toBe(560);
  });
});

describe("公開カード定義 → 描ける内容（fromEngineCard）", () => {
  it("ポケモン: 名前・HP・タイプ・ワザ・LV・レアリティ（印刷の値）", () => {
    const result = item("PMCG1-058");
    expect(result.kind).toBe("card");
    if (result.kind !== "card") return;
    expect(result.card).toMatchObject({ name: "エビワラー", hp: "70", type: "fighting", stage: "basic", level: "33", rarity: "●", series: "base", weakness: "psychic", retreat: 2 });
    expect(result.card.moves[0]).toMatchObject({ name: "ジャブ", damage: "20", cost: ["fighting"] });
    expect(result.card.art.src).toBeFalsy(); // イラストはない（イラスト枠は白）
  });

  it("ベイビィはたねの枠、悪・鋼を使うカードと neo の弾は neo の枠、ポケモンパワーはワザ欄", () => {
    const baby = item("BABY-1");
    expect(baby.kind === "card" && baby.card.stage).toBe("basic");
    const dark = item("DARK-1");
    expect(dark.kind === "card" && dark.card.series).toBe("neo");
    const neo = item("NEO-1");
    expect(neo.kind === "card" && neo.card.series).toBe("neo");
    const power = item("POWER-1");
    expect(power.kind === "card" && power.card.moves[0]?.name).toBe("ポケモンパワー：ちから");
  });

  it("トレーナー", () => {
    const result = item("PMCG1-091");
    expect(result.kind).toBe("card");
    if (result.kind !== "card") return;
    expect(result.card).toMatchObject({ name: "ポケモン交換おじさん", stage: "trainer", trainerText: "説明" });
  });

  it("エネルギー（仮の表示）", () => {
    const basic = item("PMCG1-102");
    expect(basic).toEqual({ kind: "energy", card: { name: "基本闘エネルギー", provides: ["fighting"], special: false, text: "" } });
    const special = item("SP-1");
    expect(special.kind === "energy" && special.card.special).toBe(true);
  });
});
