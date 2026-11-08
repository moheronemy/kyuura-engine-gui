// 描画用の公開カード定義（GUI 接続層の拡張の口 GET /api/card-definitions。エンジンの client_api の入口ではない）。
// - 応答は項目ごとに確かめて、renderer の EngineCardRecord の形に組み立て直す（as で型を決めつけない）
// - 表は対戦に依存しない全体の表。表を持っていることは、非公開のカードが何かを知ってよいことを意味しない。
//   どのカードの表面を描くかは、閲覧者の観測にカード ID があるかどうかで画面が決める（この表で権限を判定しない）
// - 印刷の値の表で、今の HP・ダメージなどの対戦中の状態ではない
import type { EngineAttack, EngineCardRecord, EnginePower, EngineText } from "kyuura-card-renderer";
import type { Transport } from "../api/transport";
import spec from "../../../contract/kyuura-gui-card-definitions-v2.json";

export const CARD_DEFINITIONS_SCHEMA = spec.schema;
export const CARD_DEFINITIONS_SCHEMA_VERSION = spec.schema_version;
export const RENDERER_COMMIT = spec.renderer.commit;
const CARD_ID = new RegExp(spec.card_id_pattern);
const CATEGORIES = new Set<string>(spec.categories);

/** 応答（全体）の形が違う。画面はカード画像を出さずに文字で表示する。 */
export class CardDefinitionsError extends Error {
  constructor(where: string) {
    super(`カード定義の応答の形が違う（${where}）`);
    this.name = "CardDefinitionsError";
  }
}

/** 1 件の記録の形が違う（その記録だけを使わない）。 */
class InvalidRecord extends Error {}

type Obj = Record<string, unknown>;

export function isCardId(value: unknown): value is string {
  return typeof value === "string" && CARD_ID.test(value);
}

function obj(v: unknown): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new InvalidRecord();
  return v as Obj;
}
function str(v: unknown): string {
  if (typeof v !== "string") throw new InvalidRecord();
  return v;
}
function strOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : str(v);
}
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isInteger(v)) throw new InvalidRecord();
  return v;
}
function list(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new InvalidRecord();
  return v;
}
function strings(v: unknown): string[] {
  return list(v).map(str);
}
function text(v: unknown): EngineText {
  const o = obj(v);
  return { ja: strOrNull(o.ja), en: strOrNull(o.en) };
}
function textOrNull(v: unknown): EngineText | null {
  return v === null || v === undefined ? null : text(v);
}

function attack(v: unknown): EngineAttack {
  const o = obj(v);
  const damage = o.damage === null || o.damage === undefined ? null : { display: strOrNull(obj(o.damage).display) };
  return { name: text(o.name), cost: strings(o.cost), damage, text: textOrNull(o.text) };
}

function power(v: unknown): EnginePower {
  const o = obj(v);
  return { kind: str(o.kind), name: text(o.name), text: textOrNull(o.text) };
}

function pokemon(v: unknown): NonNullable<EngineCardRecord["pokemon"]> {
  const p = obj(v);
  return {
    stage: strOrNull(p.stage),
    evolves_from: textOrNull(p.evolves_from),
    hp: intOrNull(p.hp),
    types: strings(p.types),
    weaknesses: list(p.weaknesses).map((w) => ({ type: str(obj(w).type) })),
    resistances: list(p.resistances).map((r) => ({ type: str(obj(r).type), value: intOrNull(obj(r).value) })),
    retreat_cost: intOrNull(p.retreat_cost),
    rules_text: textOrNull(p.rules_text),
    powers: list(p.powers).map(power),
    attacks: list(p.attacks).map(attack),
  };
}

/** 1 件の記録を確かめて、renderer の形に組み立てる（形が違えば InvalidRecord）。 */
export function cardRecord(v: unknown): EngineCardRecord {
  const o = obj(v);
  if (!isCardId(o.id)) throw new InvalidRecord();
  const category = str(o.category);
  if (!CATEGORIES.has(category)) throw new InvalidRecord();
  const printed = o.jp_print === null || o.jp_print === undefined ? null : obj(o.jp_print);
  return {
    id: o.id,
    jp_set: str(o.jp_set),
    category,
    name: text(o.name),
    pokemon: category === "pokemon" ? pokemon(o.pokemon) : null,
    trainer: category === "trainer" ? { text: textOrNull(obj(o.trainer).text) } : null,
    energy: category === "energy" ? { kind: str(obj(o.energy).kind), provides: strings(obj(o.energy).provides), text: textOrNull(obj(o.energy).text) } : null,
    jp_print: printed ? { level: intOrNull(printed.level), rarity: strOrNull(printed.rarity) } : null,
  };
}

export interface CardDefinitions {
  /** 出典の識別（エンジンの版・同梱データの sha256 とその方式。方式の違う sha256 は比べない）。 */
  source: { format: string; engine_version: string; sha256_method: string; sha256: string };
  /** 形の合わない記録・同じ ID が重なった記録の数（その ID は未知のカードとして扱う）。 */
  omitted: number;
  get(cardId: string): EngineCardRecord | undefined;
  readonly size: number;
}

/** 応答の全体を確かめる。封筒・schema が違えば CardDefinitionsError（記録の 1 件の誤りは、その記録だけを外す）。 */
export function cardDefinitionsResponse(value: unknown): CardDefinitions {
  const fail = (where: string): never => {
    throw new CardDefinitionsError(where);
  };
  if (typeof value !== "object" || value === null) fail("封筒");
  const o = value as Obj;
  if (o.gui_server !== 1 || o.ok !== true || o.kind !== "card_definitions") fail("封筒");
  if (o.schema !== CARD_DEFINITIONS_SCHEMA || o.schema_version !== CARD_DEFINITIONS_SCHEMA_VERSION) fail("schema");
  const source = o.source;
  if (typeof source !== "object" || source === null) fail("source");
  const s = source as Obj;
  if (s.format !== spec.source.format || typeof s.engine_version !== "string" || typeof s.sha256 !== "string") fail("source");
  // sha256 の方式（schema_version 2）。知らない方式の値は、同じ意味として扱わない
  if (s.sha256_method !== spec.source.sha256_method) fail("source.sha256_method");
  if (!Array.isArray(o.cards)) fail("cards");
  const byId = new Map<string, EngineCardRecord>();
  const duplicated = new Set<string>();
  let omitted = typeof o.omitted === "number" && Number.isInteger(o.omitted) && o.omitted >= 0 ? o.omitted : 0;
  for (const raw of o.cards as unknown[]) {
    let record: EngineCardRecord;
    try {
      record = cardRecord(raw);
    } catch (error) {
      if (!(error instanceof InvalidRecord)) throw error;
      omitted += 1;
      continue;
    }
    // 同じ ID の記録が重なったら、どれを描くか決められないので、その ID はすべて使わない
    if (duplicated.has(record.id)) {
      omitted += 1;
      continue;
    }
    if (byId.has(record.id)) {
      duplicated.add(record.id);
      byId.delete(record.id);
      omitted += 2;
      continue;
    }
    byId.set(record.id, record);
  }
  return {
    source: { format: s.format as string, engine_version: s.engine_version as string, sha256_method: s.sha256_method as string, sha256: s.sha256 as string },
    omitted,
    get: (cardId) => (isCardId(cardId) ? byId.get(cardId) : undefined),
    size: byId.size,
  };
}

export async function loadCardDefinitions(transport: Transport): Promise<CardDefinitions> {
  return cardDefinitionsResponse(await transport.request("GET", "/api/card-definitions"));
}
