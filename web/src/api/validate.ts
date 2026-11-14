// 実行時の検証。ブラウザが受け取った JSON を、契約の識別・形式の版・表示と操作に使う項目の形で確かめてから型に入れる。
// 合わなければ ProtocolError（画面は「不明な応答」を表示し、操作を止める）。全応答を any で通さない。
import {
  ADDON_OPTION_KEYS,
  ATTACK_KINDS,
  ATTACK_OPTION_KEYS,
  ATTACK_ROUTES,
  ATTACH_ENERGY_ROLE_SHAPES,
  BOARD_KINDS,
  BOARD_OPTION_KEYS,
  CONTRACT,
  COVERAGE_KEYS,
  DECLARATION_ADDONS,
  DISPLAY_ONLY_KINDS,
  DISPLAY_ONLY_STAGES,
  ENERGY2_OPTION_KEYS,
  ENERGY_TYPES,
  EXECUTABLE_PROCESSABILITY,
  FACE_UP_OPTION_KEYS,
  FORMAT,
  GUI_SERVER_FORMAT,
  HOLDER_KEYS,
  INPUT_DISCLOSURE,
  INPUT_KINDS,
  LEGAL_ACTIONS_FORMAT,
  LOG,
  NEXT_KINDS,
  OUTCOMES,
  PAIR_KEYS,
  PATH_STAGE_KINDS,
  POWER_CANDIDATE_POKEMON_KEYS,
  POWER_KEYS,
  POWER_KINDS,
  POWER_OPTION_KEYS,
  POWER_ROLE_MEANINGS,
  POWER_STAGE_SHAPES,
  PROCESSABILITY,
  RESIDUAL_CLASS_KEYS,
  RESIDUAL_CLASSES,
  RESIDUAL_PRESENT_KEYS,
  RESIDUAL_SCOPES,
  RESIDUAL_STATUSES,
  RETREAT_COST_EVALUATION,
  RETREAT_DISCARD_OPTION_KEYS,
  RETREAT_STAGE_ROLES,
  STADIUM_ENERGY_OPTION_KEYS,
  STADIUM_KEYS,
  STADIUM_KINDS,
  STAGE_KEYS,
  STAGE_ROLES,
  STAGE_ROLES_OR_EMPTY,
  STAGE_ROLES_SHARED,
  STATUS_VALUES,
  TRAINER_KINDS,
  TRAINER_OPTION_KEYS,
  ZONES,
} from "./contract";
import type {
  Candidate,
  CandidatesResponse,
  CatalogCard,
  CheckResponse,
  ClientErrorResponse,
  Coverage,
  CreateMatchResult,
  InputOption,
  InputStage,
  InputsResponse,
  LegalActions,
  LogItem,
  LogPosition,
  LogResponse,
  MatchInfo,
  Observation,
  OptionStage,
  PlayerObservation,
  PresetDeck,
  Refusal,
  ScenarioInfo,
  StatusInfo,
  SubmitResponse,
  UpdateItem,
  UpdatesResponse,
  ViewResponse,
} from "./types";

export class ProtocolError extends Error {
  constructor(public readonly where: string) {
    super(`応答の形が契約と合わない（${where}）`);
    this.name = "ProtocolError";
  }
}

type Obj = Record<string, unknown>;

function fail(where: string): never {
  throw new ProtocolError(where);
}

function obj(value: unknown, where: string): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(where);
  return value as Obj;
}

function arr(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) fail(where);
  return value;
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string") fail(where);
  return value;
}

function int(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(where);
  return value;
}

function bool(value: unknown, where: string): boolean {
  if (typeof value !== "boolean") fail(where);
  return value;
}

function oneOf(value: unknown, allowed: readonly string[], where: string): string {
  const s = str(value, where);
  if (!allowed.includes(s)) fail(`${where}: 知らない値`);
  return s;
}

function strList(value: unknown, where: string): string[] {
  return arr(value, where).map((v, i) => str(v, `${where}[${i}]`));
}

function playerOrNull(value: unknown, where: string): 0 | 1 | null {
  if (value === null) return null;
  if (value === 0 || value === 1) return value;
  fail(where);
}

/** client_api の封筒（契約の識別・形式の版・種類）。 */
function envelope(value: unknown, type: string): Obj {
  const o = obj(value, "応答");
  if (o.contract !== CONTRACT) fail("contract");
  if (o.format !== FORMAT) fail("format");
  if (o.type !== type) fail(`type（期待 ${type}）`);
  bool(o.ok, "ok");
  return o;
}

/** ok が偽の client_api の応答なら、その誤りを返す（そうでなければ null）。 */
export function clientError(value: unknown, type: string): ClientErrorResponse | null {
  const o = envelope(value, type);
  if (o.ok !== false || !("error" in o)) return null;
  const e = obj(o.error, "error");
  str(e.code, "error.code");
  str(e.message, "error.message");
  return o as unknown as ClientErrorResponse;
}

function refusal(value: unknown, where: string): Refusal {
  const o = obj(value, where);
  return { code: str(o.code, `${where}.code`), message: str(o.message, `${where}.message`) };
}

function status(value: unknown): StatusInfo {
  const o = obj(value, "status");
  str(o.status, "status.status");
  bool(o.continuable, "status.continuable");
  arr(o.waiting, "status.waiting").forEach((w, i) => {
    const wo = obj(w, `status.waiting[${i}]`);
    str(wo.kind, `status.waiting[${i}].kind`);
    if (!(wo.by === 0 || wo.by === 1 || wo.by === "players" || wo.by === "host")) fail(`status.waiting[${i}].by`);
  });
  if (o.halt != null) {
    const h = obj(o.halt, "status.halt");
    if (h.message != null) str(h.message, "status.halt.message");
  }
  return o as unknown as StatusInfo;
}

function playerObservation(value: unknown, i: number, viewer: 0 | 1 | null): PlayerObservation {
  const w = `observation.players[${i}]`;
  const o = obj(value, w);
  if (o.player !== i) fail(`${w}.player`);
  const hand = obj(o.hand, `${w}.hand`);
  int(hand.count, `${w}.hand.count`);
  if (hand.cards !== null) arr(hand.cards, `${w}.hand.cards`).forEach((c, j) => cardRef(c, `${w}.hand.cards[${j}]`));
  int(obj(o.deck, `${w}.deck`).count, `${w}.deck.count`);
  const prizes = obj(o.prizes, `${w}.prizes`);
  int(prizes.count, `${w}.prizes.count`);
  arr(prizes.face_up, `${w}.prizes.face_up`);
  arr(o.discard, `${w}.discard`).forEach((c, j) => cardRef(c, `${w}.discard[${j}]`));
  arr(o.set_aside, `${w}.set_aside`);
  if (o.active !== null) fieldSlot(o.active, `${w}.active`, viewer === i);
  arr(o.bench, `${w}.bench`).forEach((b, j) => fieldSlot(b, `${w}.bench[${j}]`, viewer === i));
  return o as unknown as PlayerObservation;
}

function cardRef(value: unknown, where: string): void {
  const o = obj(value, where);
  int(o.card, `${where}.card`);
  str(o.card_id, `${where}.card_id`);
}

function fieldSlot(value: unknown, where: string, own: boolean): void {
  const o = obj(value, where);
  if (o.face_down === true) {
    // 情報境界: うらのカードの本当のカード（real）は、持ち主の観測にだけある。ほかの閲覧者の観測・項目の外にカード ID が来たら止める
    if ("card_id" in o || "name_ja" in o) fail(`${where}: うらのカードにカード ID・名前がある`);
    if ("real" in o) {
      if (!own) fail(`${where}.real: 持ち主でない閲覧者にうらのカードの中身がある`);
      const real = obj(o.real, `${where}.real`);
      int(real.card, `${where}.real.card`);
      str(real.card_id, `${where}.real.card_id`);
      if ("name_ja" in real) str(real.name_ja, `${where}.real.name_ja`);
    }
    return;
  }
  int(o.pokemon_id, `${where}.pokemon_id`);
  str(o.card_id, `${where}.card_id`);
  str(o.name_ja, `${where}.name_ja`);
  int(o.hp, `${where}.hp`);
  int(o.damage, `${where}.damage`);
  arr(o.energy, `${where}.energy`);
  strList(o.special_conditions, `${where}.special_conditions`);
}

export function observation(value: unknown): Observation {
  const o = obj(value, "observation");
  const viewer = playerOrNull(o.viewer, "observation.viewer");
  int(o.turn, "observation.turn");
  playerOrNull(o.current_player, "observation.current_player");
  str(o.phase, "observation.phase");
  const players = arr(o.players, "observation.players");
  if (players.length !== 2) fail("observation.players");
  players.forEach((p, i) => playerObservation(p, i, viewer));
  if (o.decision != null) {
    const d = obj(o.decision, "observation.decision");
    str(d.kind, "observation.decision.kind");
  }
  if (o.result != null) str(obj(o.result, "observation.result").outcome, "observation.result.outcome");
  return o as unknown as Observation;
}

export function viewResponse(value: unknown): ViewResponse {
  const o = envelope(value, "view");
  if (o.ok !== true) fail("view.ok");
  if (!(o.viewer === 0 || o.viewer === 1 || o.viewer === "spectator" || o.viewer === "host")) fail("view.viewer");
  status(o.status);
  observation(o.observation);
  return o as unknown as ViewResponse;
}

function coverage(value: unknown): Coverage {
  const o = obj(value, "coverage");
  // v0.172（U7-5g-3）: coverage の項目は契約の表のとおり（知らない項目は、知らない残り・保証の軸かもしれないので止める）
  for (const key of Object.keys(o)) if (!COVERAGE_KEYS.has(key)) fail(`coverage.${key}: 知らない coverage の項目`);
  for (const key of ["implemented_kinds", "scope_kinds", "offered_kinds", "not_covered_kinds", "display_only_kinds", "withheld_input_candidates", "partial_residual"]) {
    strList(o[key], `coverage.${key}`);
  }
  str(o.completeness, "coverage.completeness");
  str(o.completeness_scope, "coverage.completeness_scope");
  str(o.completeness_basis, "coverage.completeness_basis");
  // 表示だけの種類: 契約の表の種類で、この応答の範囲（scope_kinds）にある
  for (const k of o.display_only_kinds as string[]) {
    if (!DISPLAY_ONLY_KINDS.has(k)) fail(`coverage.display_only_kinds: ${k} は表示だけの種類として知らない`);
    if (!(o.scope_kinds as string[]).includes(k)) fail(`coverage.display_only_kinds: ${k} が scope_kinds にない`);
  }
  const residual = obj(o.residual, "coverage.residual");
  for (const key of Object.keys(residual)) if (key !== "classes" && key !== "present") fail(`coverage.residual.${key}: 知らない項目`);
  // 残りの分類は API 全体で決まった値（契約の表と同じ。note はエンジンの説明文）。知らない分類・区分は止める
  const classes = arr(residual.classes, "coverage.residual.classes").map((c, i) => {
    const w = `coverage.residual.classes[${i}]`;
    const co = obj(c, w);
    for (const key of Object.keys(co)) if (!RESIDUAL_CLASS_KEYS.has(key)) fail(`${w}.${key}: 知らない残りの項目`);
    str(co.note, `${w}.note`);
    oneOf(co.status, RESIDUAL_STATUSES, `${w}.status`);
    const known = RESIDUAL_CLASSES[i];
    if (!known || (["id", "kind", "field", "situation", "status", "reason", "subject"] as const).some((k) => co[k] !== known[k])) fail(`${w}: 契約の表の残りの分類と違う`);
    return co.id as string;
  });
  if (classes.length !== RESIDUAL_CLASSES.length) fail("coverage.residual.classes: 契約の表の残りの分類と数が違う");
  const seen = new Set<string>();
  arr(residual.present, "coverage.residual.present").forEach((p, i) => {
    const w = `coverage.residual.present[${i}]`;
    const po = obj(p, w);
    for (const key of Object.keys(po)) if (!RESIDUAL_PRESENT_KEYS.has(key)) fail(`${w}.${key}: 知らない項目`);
    if (!classes.includes(str(po.id, `${w}.id`))) fail(`${w}.id: 分類にない残り`);
    const scope = oneOf(po.scope, RESIDUAL_SCOPES, `${w}.scope`);
    // actor の残りは本人の候補から決まる（候補の id を持つ）。public の残りは公開の状態から（候補を指さない）
    if (scope === "actor") str(po.candidate, `${w}.candidate`);
    else if ("candidate" in po) fail(`${w}.candidate: public の残りが候補を指す`);
    const key = `${String(po.id)}/${String(po.candidate ?? "")}`;
    if (seen.has(key)) fail(`${w}: 残りが重なる`);
    seen.add(key);
  });
  for (const id of o.partial_residual as string[]) {
    const known = RESIDUAL_CLASSES.find((c) => c.id === id);
    if (!known || known.status !== "not_offered") fail(`coverage.partial_residual: ${id} は示さない経路の分類ではない`);
  }
  arr(o.unverified_paths, "coverage.unverified_paths").forEach((p, i) => {
    const w = `coverage.unverified_paths[${i}]`;
    const po = obj(p, w);
    for (const key of Object.keys(po)) if (key !== "reason" && key !== "candidates") fail(`${w}.${key}: 知らない項目`);
    str(po.reason, `${w}.reason`);
    strList(po.candidates, `${w}.candidates`);
  });
  // complete は、対応しない種類も示さない経路もないときだけ（エンジンの決め方。ほかなら「全部そろった」と表示しない）
  if (o.completeness === "complete" && ((o.not_covered_kinds as string[]).length > 0 || (o.partial_residual as string[]).length > 0)) {
    fail("coverage.completeness: 未対応の種類・示さない経路があるのに complete");
  }
  return o as unknown as Coverage;
}

/** v0.172: coverage と候補の突き合わせ（残り・未確認の経路・入力非公開が指す候補が応答にある、表示だけの種類の候補が display_only_kinds にある）。 */
function coverageMatchesCandidates(cov: Coverage, candidates: Candidate[]): void {
  const ids = new Set(candidates.map((c) => c.id));
  for (const p of cov.residual.present) if (p.candidate !== undefined && !ids.has(p.candidate)) fail(`coverage.residual.present: 候補 ${p.candidate} がない`);
  for (const p of cov.unverified_paths) for (const id of p.candidates) if (!ids.has(id)) fail(`coverage.unverified_paths: 候補 ${id} がない`);
  for (const id of cov.withheld_input_candidates) if (!ids.has(id)) fail(`coverage.withheld_input_candidates: 候補 ${id} がない`);
  for (const c of candidates) {
    if (!DISPLAY_ONLY_KINDS.has(c.kind)) continue;
    if (!cov.display_only_kinds.includes(c.kind)) fail(`candidates.${c.id}: 表示だけの種類が display_only_kinds にない`);
    // 表示だけの候補は送れない区分（未裁定・続けられない状態）。送れる区分なら、知らない意味の変更として止める
    if (EXECUTABLE_PROCESSABILITY.has(c.processability)) fail(`candidates.${c.id}: 表示だけの候補が送れる区分`);
  }
}

function candidate(value: unknown, i: number): Candidate {
  const w = `candidates[${i}]`;
  const o = obj(value, w);
  str(o.id, `${w}.id`);
  str(o.kind, `${w}.kind`);
  oneOf(o.processability, PROCESSABILITY, `${w}.processability`);
  strList(o.reasons, `${w}.reasons`);
  const g = obj(o.guarantees, `${w}.guarantees`);
  for (const [k, v] of Object.entries(g)) str(v, `${w}.guarantees.${k}`);
  oneOf(o.input_disclosure, INPUT_DISCLOSURE, `${w}.input_disclosure`);
  arr(o.input_stages, `${w}.input_stages`).forEach((s, j) => {
    const so = obj(s, `${w}.input_stages[${j}]`);
    int(so.stage, `${w}.input_stages[${j}].stage`);
    oneOf(so.input, INPUT_KINDS, `${w}.input_stages[${j}].input`);
  });
  if ("choices_format" in o) str(o.choices_format, `${w}.choices_format`);
  // U7-5d: 場のスタジアム（use_stadium の候補だけ。公開のカード・持ち主）。ほかの種類に来たら、知らない形として止める
  if ("stadium" in o) {
    if (!STADIUM_KINDS.has(o.kind as string)) fail(`${w}.stadium: ${String(o.kind)} の候補ではない`);
    const st = obj(o.stadium, `${w}.stadium`);
    for (const key of Object.keys(st)) if (!STADIUM_KEYS.has(key)) fail(`${w}.stadium.${key}: 知らないスタジアムの項目`);
    int(st.card, `${w}.stadium.card`);
    str(st.card_id, `${w}.stadium.card_id`);
    if (st.owner !== 0 && st.owner !== 1) fail(`${w}.stadium.owner`);
  }
  // U7-5e: 特殊能力を使うポケモンと特殊能力（use_power の候補だけ）。表示に使う。入力の形は inputs の段だけから決める（名前・カード ID から推測しない）
  for (const key of ["pokemon", "power"] as const) {
    if (!(key in o)) continue;
    if (!POWER_KINDS.has(o.kind as string)) fail(`${w}.${key}: ${String(o.kind)} の候補ではない`);
    const v = obj(o[key], `${w}.${key}`);
    const allowed = key === "pokemon" ? POWER_CANDIDATE_POKEMON_KEYS : POWER_KEYS;
    for (const k of Object.keys(v)) if (!allowed.has(k)) fail(`${w}.${key}.${k}: 知らない項目`);
    if ("face_down" in v && v.face_down !== true) fail(`${w}.${key}.face_down`);
    if (key === "pokemon") {
      int(v.pokemon, `${w}.pokemon.pokemon`);
      int(v.card, `${w}.pokemon.card`);
      oneOf(v.zone, ZONES, `${w}.pokemon.zone`);
      // v0.172（U7-5g-2）: 本人のうらのカードは face_down で、場のポケモンの項目にカード ID がない（本当のカードは power の側だけ）
      if (v.face_down === true) {
        if ("card_id" in v) fail(`${w}.pokemon: うらのポケモンにカード ID がある`);
      } else {
        str(v.card_id, `${w}.pokemon.card_id`);
      }
      if ("bench_index" in v && int(v.bench_index, `${w}.pokemon.bench_index`) < 0) fail(`${w}.pokemon.bench_index`);
    } else {
      if (int(v.index, `${w}.power.index`) < 0) fail(`${w}.power.index`);
      str(v.name_ja, `${w}.power.name_ja`);
      int(v.card, `${w}.power.card`);
      str(v.card_id, `${w}.power.card_id`);
    }
  }
  // うらのカードの特殊能力は pokemon・power の両方が face_down（片方だけなら、知らない形として止める）。pokemon と power は組で持つ
  if (("pokemon" in o) !== ("power" in o)) fail(`${w}: pokemon と power は組で持つ`);
  if ("pokemon" in o && Boolean((o.pokemon as Obj).face_down) !== Boolean((o.power as Obj).face_down)) fail(`${w}: pokemon と power の face_down が合わない`);
  return o as unknown as Candidate;
}

export function legalActions(value: unknown): LegalActions {
  const o = obj(value, "response");
  if (o.kyuura_legal_actions_format !== LEGAL_ACTIONS_FORMAT) fail("kyuura_legal_actions_format");
  str(o.game, "game");
  str(o.revision, "revision");
  if (!(o.actor === 0 || o.actor === 1 || o.actor === "host")) fail("actor");
  str(o.status, "status");
  str(o.situation, "situation");
  if (o.empty_reason !== null) str(o.empty_reason, "empty_reason");
  const cov = coverage(o.coverage);
  const candidates = arr(o.candidates, "candidates").map((c, i) => candidate(c, i));
  coverageMatchesCandidates(cov, candidates);
  return o as unknown as LegalActions;
}

export function candidatesResponse(value: unknown): CandidatesResponse {
  const o = envelope(value, "candidates");
  if (o.ok !== true) fail("candidates.ok");
  legalActions(o.response);
  return o as unknown as CandidatesResponse;
}

function count(value: unknown, where: string): void {
  const o = obj(value, where);
  const min = int(o.min, `${where}.min`);
  const max = int(o.max, `${where}.max`);
  if (min < 0 || max < min) fail(where);
}

function reasons(o: Obj, where: string): void {
  if ("reasons" in o) strList(o.reasons, `${where}.reasons`);
}

function option(value: unknown, where: string): InputOption {
  const o = obj(value, where);
  str(o.id, `${where}.id`);
  oneOf(o.processability, PROCESSABILITY, `${where}.processability`);
  if ("eligible" in o) bool(o.eligible, `${where}.eligible`);
  if ("card_id" in o) str(o.card_id, `${where}.card_id`);
  reasons(o, where);
  // U7-3 の選べるものの項目（あれば形を確かめる。表示と、にげるの個数の数え方に使う）
  if ("special" in o) bool(o.special, `${where}.special`);
  if ("units" in o && int(o.units, `${where}.units`) < 1) fail(`${where}.units`);
  if ("pokemon" in o) int(o.pokemon, `${where}.pokemon`);
  if ("zone" in o) oneOf(o.zone, ZONES, `${where}.zone`);
  if ("bench_index" in o && int(o.bench_index, `${where}.bench_index`) < 0) fail(`${where}.bench_index`);
  if ("face_down" in o) {
    if (o.face_down !== true) fail(`${where}.face_down`);
    // 情報境界: 場のポケモンの選べるもの（うらのポケモン）にカード ID は来ない。U7-4 のうらのバトル場のポケモンのワザだけは、
    // 本人が知る本当のカードの印刷のワザなので、本人の候補にカード ID がある（attack_index のある選べるものだけ）
    if ("card_id" in o && !("attack_index" in o)) fail(`${where}: うらのポケモンにカード ID がある`);
  }
  if ("holder" in o) holder(o.holder, `${where}.holder`);
  if ("after" in o) str(o.after, `${where}.after`);
  return o as unknown as InputOption;
}

/** U7-5d: エネルギーがついている本人の場のポケモン（場のポケモンの形）。うらのポケモンにカード ID は来ない。 */
function holder(value: unknown, where: string): void {
  const h = obj(value, where);
  for (const key of Object.keys(h)) if (!HOLDER_KEYS.has(key)) fail(`${where}.${key}: 知らない holder の項目`);
  int(h.pokemon, `${where}.pokemon`);
  int(h.card, `${where}.card`);
  oneOf(h.zone, ZONES, `${where}.zone`);
  if ("bench_index" in h && int(h.bench_index, `${where}.bench_index`) < 0) fail(`${where}.bench_index`);
  if ("face_down" in h) {
    if (h.face_down !== true || "card_id" in h) fail(`${where}: うらのポケモンにカード ID がある`);
  } else {
    str(h.card_id, `${where}.card_id`);
  }
}

/** U7-5e: 特殊能力の段の選べるもの（role ごとの meaning の形）。相手のうらのカードは位置と face_down だけ（カード・カード ID がない）。 */
function powerOption(meaning: string, o: InputOption, where: string): void {
  for (const key of Object.keys(o)) if (!POWER_OPTION_KEYS.has(key)) fail(`${where}.${key}: 知らない特殊能力の項目`);
  if (!("eligible" in o)) fail(`${where}.eligible`);
  if (meaning === "pokemon") {
    int(o.pokemon, `${where}.pokemon`);
    oneOf(o.zone, ZONES, `${where}.zone`);
    if (o.face_down === true) {
      if ("card_id" in o) fail(`${where}: うらのポケモンにカード ID がある`);
    } else {
      int(o.card, `${where}.card`);
      str(o.card_id, `${where}.card_id`);
    }
    return;
  }
  if ("pokemon" in o || "zone" in o || "face_down" in o) fail(`${where}: カードの選べるものに場のポケモンの項目`);
  int(o.card, `${where}.card`);
  str(o.card_id, `${where}.card_id`);
}

/** U7-5: 1 段の選べるもの（場のポケモン・手札のトレーナー・スタジアムで選ぶエネルギー）の項目の形。知らない項目は止める。 */
function singleStageOption(kind: string, o: InputOption, where: string): void {
  const keys = BOARD_KINDS.has(kind) ? BOARD_OPTION_KEYS : TRAINER_KINDS.has(kind) ? TRAINER_OPTION_KEYS : STADIUM_ENERGY_OPTION_KEYS;
  for (const key of Object.keys(o)) if (!keys.has(key)) fail(`${where}.${key}: 知らない ${kind} の項目`);
  if (!("eligible" in o)) fail(`${where}.eligible`);
  int(o.card, `${where}.card`);
  if (BOARD_KINDS.has(kind)) {
    int(o.pokemon, `${where}.pokemon`);
    oneOf(o.zone, ZONES, `${where}.zone`);
    // うらのポケモンは face_down（カード ID なし。option() が確かめる）、おもてのポケモンにはカード ID がある
    if (o.face_down !== true) str(o.card_id, `${where}.card_id`);
    return;
  }
  str(o.card_id, `${where}.card_id`);
  if (STADIUM_KINDS.has(kind) && !("holder" in o)) fail(`${where}.holder`);
}

function intList(value: unknown, where: string): number[] {
  return arr(value, where).map((v, i) => int(v, `${where}[${i}]`));
}

/** U7-4: ワザ（role: attack）の選べるもの。表示に使う項目の形と、知らない項目がないことを確かめる。 */
function attackOption(o: InputOption, where: string): void {
  for (const key of Object.keys(o)) if (!ATTACK_OPTION_KEYS.has(key)) fail(`${where}.${key}: 知らないワザの項目`);
  int(o.card, `${where}.card`);
  str(o.card_id, `${where}.card_id`);
  if (int(o.attack_index, `${where}.attack_index`) < 0) fail(`${where}.attack_index`);
  // route はエンジンが返した持ち方の表示。うらのバトル場のポケモンのワザ（face_down）にはない
  if ("route" in o) oneOf(o.route, ATTACK_ROUTES, `${where}.route`);
  else if (o.face_down !== true) fail(`${where}.route`);
  if ("provider" in o) int(o.provider, `${where}.provider`);
  if ("payer" in o) int(o.payer, `${where}.payer`);
  if ("grantors" in o) intList(o.grantors, `${where}.grantors`);
  str(o.name_ja, `${where}.name_ja`);
  arr(o.cost, `${where}.cost`).forEach((c, i) => oneOf(c, ENERGY_TYPES, `${where}.cost[${i}]`));
  if (!("damage" in o) || (o.damage !== null && typeof o.damage !== "string")) fail(`${where}.damage`);
  if (!("text_ja" in o) || (o.text_ja !== null && typeof o.text_ja !== "string")) fail(`${where}.text_ja`);
  if (!("eligible" in o)) fail(`${where}.eligible`);
}

/** U7-4: 宣言といっしょに選ぶもの（role: declaration_options）の選べるもの。addon ごとに要る項目を確かめる。 */
function addonOption(o: InputOption, where: string): void {
  for (const key of Object.keys(o)) if (!ADDON_OPTION_KEYS.has(key)) fail(`${where}.${key}: 知らない宣言の項目`);
  const addon = oneOf(o.addon, DECLARATION_ADDONS, `${where}.addon`);
  if (!("eligible" in o)) fail(`${where}.eligible`);
  if (addon === "stadium_coin") {
    int(o.card, `${where}.card`);
    str(o.card_id, `${where}.card_id`);
  } else {
    int(o.pokemon, `${where}.pokemon`);
  }
  if (addon === "with_power") {
    str(o.power, `${where}.power`);
    oneOf(o.zone, ZONES, `${where}.zone`);
  } else if ("power" in o) fail(`${where}.power`);
}

/**
 * 0.174.0（P6）: 費用を評価していない印。項目・値・型は契約の表（retreat_cost_evaluation）と同じものだけ。知らない値・項目は止める
 * （新しい status・reason・省いた項目の名前を、古い画面の意味で読まない）。
 */
function costEvaluation(value: unknown, where: string): void {
  const o = obj(value, where);
  const keys = Object.keys(o);
  if (keys.length !== 3 || !keys.every((k) => k === "status" || k === "reason" || k === "omitted")) fail(`${where}: 知らない項目`);
  if (o.status !== RETREAT_COST_EVALUATION.status) fail(`${where}.status: 知らない値`);
  if (o.reason !== RETREAT_COST_EVALUATION.reason) fail(`${where}.reason: 知らない値`);
  const omitted = arr(o.omitted, `${where}.omitted`);
  const expected = RETREAT_COST_EVALUATION.omitted;
  if (omitted.length !== expected.length || omitted.some((name, i) => name !== expected[i])) fail(`${where}.omitted: 知らない値`);
}

/**
 * にげる（retreat）。段の role は [new_active, discard]（入力のない候補は段なし）。1 段目は控え 1 匹（場のポケモンの形）、2 段目はトラッシュするカード
 * （0〜枚数・重なりなし・選んだ順）。2 段目の費用の表し方は次のどちらか 1 つだけ（エンジンの docs/legal-actions-p6-face-down-retreat.md 2.2 節）:
 * - おもてのバトル場のポケモン: total_units とすべての選べるものの units（cost_evaluation なし）
 * - 本人のうらのバトル場のポケモン（P6）: cost_evaluation（total_units・units を省く）
 * 両方ある・両方ない（費用 0 と見なさない）・一部の選べるものだけ units・cost_evaluation があるのに units がある、は止める。
 */
function retreatStages(stages: InputStage[]): void {
  if (stages.length === 0) return; // 宣言の確かめが止める候補（化石・人形のバトル場など）は選べるものを示さない（送れない候補）
  const roles = stages.map((s) => (s.input === "choose_option" ? s.role : undefined));
  if (roles.length !== RETREAT_STAGE_ROLES.length || roles.some((r, i) => r !== RETREAT_STAGE_ROLES[i])) fail("stages: retreat の段の並び");
  const [first, second] = stages as OptionStage[];
  if (!first || !second) return fail("stages: retreat の段の並び");
  for (const s of [first, second]) {
    if (s.depends_on_stage !== undefined || s.options_by_choice !== undefined || s.upstream_stages !== undefined || s.path_stages !== undefined || s.options_from_stage !== undefined) {
      fail(`stages[${s.stage}]: retreat の段に依存の形`);
    }
    if (!s.options) fail(`stages[${s.stage}].options`);
  }
  if (first.count.min !== 1 || first.count.max !== 1 || first.meaning !== "pokemon") fail("stages[1]: retreat の控えの段");
  if (first.total_units !== undefined || first.cost_evaluation !== undefined) fail("stages[1]: retreat の控えの段に費用の項目");
  (first.options ?? []).forEach((op, j) => {
    for (const key of Object.keys(op)) if (!BOARD_OPTION_KEYS.has(key)) fail(`stages[1].options[${j}].${key}: 知らない控えの項目`);
  });
  const options = second.options ?? [];
  const w = `stages[${second.stage}]`;
  if (second.meaning !== "card" || second.distinct !== true || second.order !== "significant" || second.count.min !== 0 || second.count.max !== options.length) {
    fail(`${w}: retreat のトラッシュの段`);
  }
  options.forEach((op, j) => {
    for (const key of Object.keys(op)) if (!RETREAT_DISCARD_OPTION_KEYS.has(key)) fail(`${w}.options[${j}].${key}: 知らないトラッシュの項目`);
    int(op.card, `${w}.options[${j}].card`);
    str(op.card_id, `${w}.options[${j}].card_id`);
  });
  const withUnits = options.filter((op) => "units" in op).length;
  const hasTotal = second.total_units !== undefined;
  const hasCost = second.cost_evaluation !== undefined;
  if (hasTotal && hasCost) fail(`${w}: total_units と cost_evaluation が併存`);
  if (!hasTotal && !hasCost) fail(`${w}: 費用の段に total_units も cost_evaluation もない（費用 0 と見なさない）`);
  if (hasTotal && withUnits !== options.length) fail(`${w}.total_units: units のない選べるもの`);
  if (hasCost && withUnits !== 0) fail(`${w}.cost_evaluation: 省いたはずの units がある`);
}

/**
 * 段の role で形が決まる種類（U7-4 の use_attack）: role の並びが契約の表と同じで、段ごとの選べるものの形を確かめる。
 * ほかの種類の段に、その種類の role が来たら止める（role だけで古い画面へ通さない）。
 */
function kindStages(kind: string, stages: InputStage[]): void {
  if (kind === "retreat") return retreatStages(stages);
  // にげるの外: 個数・費用の評価の項目は来ない（来たら、知らない制約として止める）
  for (const s of stages) {
    if (s.input !== "choose_option") continue;
    if (s.total_units !== undefined || s.cost_evaluation !== undefined || (s.options ?? []).some((op) => "units" in op)) fail(`stages[${s.stage}]: ${kind} の段に費用・個数の項目`);
  }
  const expectedRoles = STAGE_ROLES[kind];
  // U7-3 の種類も同じ名前で使う role（にげるの discard・エネルギーをつけるの energy）は除く
  const special = new Set(Object.values(STAGE_ROLES).flat().filter((r) => !STAGE_ROLES_SHARED.has(r)));
  if (POWER_KINDS.has(kind)) return powerStages(stages);
  // U7-5g-1: 経路で引く段は、契約の表の種類の決まった段だけ（ほかの種類・ほかの段に来たら、知らない依存の形として止める）
  const pathSpec = PATH_STAGE_KINDS[kind];
  for (const s of stages) {
    if (s.input !== "choose_option" || s.path_stages === undefined) continue;
    if (!pathSpec || s.stage !== pathSpec.stage) fail(`stages[${s.stage}]: ${kind} の段に経路で引く形（path_stages）`);
  }
  if (kind === "attach_energy") attachStages(stages);
  if (DISPLAY_ONLY_KINDS.has(kind)) return displayOnlyStages(kind, stages);
  // U7-5e の依存の形（upstream_stages・after）と role の source は、特殊能力の段だけ（ほかの種類に来たら知らない依存の形として止める）
  for (const s of stages) {
    if (s.input !== "choose_option") continue;
    if (s.upstream_stages !== undefined || (s.options ?? []).some((op) => "after" in op)) fail(`stages[${s.stage}]: ${kind} の段に依存の形（upstream_stages・after）`);
    if (s.role === "source") fail(`stages[${s.stage}].role: ${kind} の段ではない`);
  }
  if (!expectedRoles) {
    for (const s of stages) if (s.input === "choose_option" && s.role !== undefined && special.has(s.role)) fail(`stages[${s.stage}].role: ${kind} の段ではない`);
    return;
  }
  if (stages.length === 0 && STAGE_ROLES_OR_EMPTY.has(kind)) return; // U7-5d: 選ばせるもののない場のスタジアム（choices は []）
  const roles = stages.map((s) => (s.input === "choose_option" ? s.role : undefined));
  if (roles.length !== expectedRoles.length || roles.some((r, i) => r !== expectedRoles[i])) fail(`stages: ${kind} の段の並び`);
  if (BOARD_KINDS.has(kind) || TRAINER_KINDS.has(kind) || STADIUM_KINDS.has(kind)) {
    // U7-5: 1 段で 1 つを選ぶ。場のポケモン（meaning: pokemon）か、カード（meaning: card）
    const [only] = stages as OptionStage[];
    const meaning = BOARD_KINDS.has(kind) ? "pokemon" : "card";
    if (!only?.options || only.count.min !== 1 || only.count.max !== 1 || only.meaning !== meaning || only.depends_on_stage !== undefined) fail(`stages[1]: ${kind} の段`);
    only.options.forEach((op, j) => singleStageOption(kind, op, `stages[1].options[${j}]`));
    return;
  }
  if (!ATTACK_KINDS.has(kind)) return;
  const [first, second] = stages as OptionStage[];
  if (!first?.options || !second?.options || first.count.min !== 1 || first.count.max !== 1) fail("stages[1]: ワザの段");
  first.options.forEach((op, j) => attackOption(op, `stages[1].options[${j}]`));
  if (second.depends_on_stage !== first.stage || !second.options_by_choice) fail("stages[2].depends_on_stage");
  // 1 段目のすべてのワザに組の表がある（ないワザに GUI がいっしょに選ぶものを推測しない）
  for (const op of first.options) if (!(op.id in second.options_by_choice)) fail(`stages[2].options_by_choice.${op.id}`);
  second.options.forEach((op, j) => addonOption(op, `stages[2].options[${j}]`));
}

/**
 * U7-5g-1: エネルギーをつける（attach_energy）。段の role は [energy, target]（今までの形）か、カツラの効果の番の [energy, target, energy2]。
 * 3 段目は任意（count 0〜1・decline）で、path_stages [1, 2] の options_by_path で引く。選べるものは手札のエネルギーカード。
 * カツラの許可・炎の判定・付け先・回数・レインボーは GUI で判定しない（エンジンの組と check に任せる）。
 */
function attachStages(stages: InputStage[]): void {
  const roles = stages.map((s) => (s.input === "choose_option" ? s.role : undefined));
  if (!ATTACH_ENERGY_ROLE_SHAPES.some((shape) => shape.length === roles.length && shape.every((r, i) => r === roles[i]))) fail("stages: attach_energy の段の並び");
  const spec = PATH_STAGE_KINDS.attach_energy;
  const third = stages[2] as OptionStage | undefined;
  if (!third || !spec) return;
  const w = `stages[${third.stage}]`;
  if (third.stage !== spec.stage || third.meaning !== spec.meaning || third.count.min !== spec.count.min || third.count.max !== spec.count.max || third.decline !== spec.decline) fail(`${w}: energy2 の段`);
  if (!third.path_stages || third.path_stages.length !== spec.path_stages.length || third.path_stages.some((n, i) => n !== spec.path_stages[i])) fail(`${w}.path_stages`);
  third.options?.forEach((op, j) => {
    for (const key of Object.keys(op)) if (!ENERGY2_OPTION_KEYS.has(key)) fail(`${w}.options[${j}].${key}: 知らない energy2 の項目`);
    int(op.card, `${w}.options[${j}].card`);
    str(op.card_id, `${w}.options[${j}].card_id`);
    if (!("eligible" in op)) fail(`${w}.options[${j}].eligible`);
  });
}

/**
 * U7-5f: 表示だけの種類（check_face_up_deck）。1 段で、選べるものは owner・position だけ（カード ID・uid・名前があれば止める）。
 * position は 0 がいちばん上で、示すのは 2 枚目より下（1 以上）。画面は位置を表示するだけで、check・submit を呼ばない。
 */
function displayOnlyStages(kind: string, stages: InputStage[]): void {
  const spec = DISPLAY_ONLY_STAGES[kind];
  if (!spec) fail(`stages: ${kind} の段の形を知らない`);
  const [only] = stages as OptionStage[];
  if (stages.length !== 1 || !only?.options || only.role !== spec.role || only.meaning !== spec.meaning || only.count.min !== 1 || only.count.max !== 1) fail(`stages: ${kind} の段`);
  only.options.forEach((op, j) => {
    const w = `stages[1].options[${j}]`;
    for (const key of Object.keys(op)) if (!FACE_UP_OPTION_KEYS.has(key)) fail(`${w}.${key}: 知らない表示だけの項目`);
    if (op.owner !== 0 && op.owner !== 1) fail(`${w}.owner`);
    if (int(op.position, `${w}.position`) < 1) fail(`${w}.position: いちばん上より下でない`);
    if (op.eligible !== false || EXECUTABLE_PROCESSABILITY.has(op.processability)) fail(`${w}: 表示だけの選べるものが送れる区分`);
  });
}

/**
 * U7-5e: 特殊能力の段（0〜3 段）。role の並びが契約の表のどれか、どの段も 1 つを選ぶ、meaning が role のとおり、
 * 2 段目以降は直前の段に依存し upstream_stages が前のすべての段、選べるものの after が直前の段の選ぶもの（chainedStages）。
 */
function powerStages(stages: InputStage[]): void {
  const roles = stages.map((s) => (s.input === "choose_option" ? s.role : undefined));
  if (!POWER_STAGE_SHAPES.some((shape) => shape.length === roles.length && shape.every((r, i) => r === roles[i]))) fail("stages: use_power の段の並び");
  stages.forEach((raw, i) => {
    const s = raw as OptionStage;
    const w = `stages[${s.stage}]`;
    if (s.stage !== i + 1 || !s.options || s.count.min !== 1 || s.count.max !== 1) fail(`${w}: use_power の段`);
    if (s.meaning !== POWER_ROLE_MEANINGS[s.role as string]) fail(`${w}.meaning`);
    if (i > 0 && s.upstream_stages === undefined) fail(`${w}.upstream_stages`);
    s.options.forEach((op, j) => powerOption(s.meaning as string, op, `${w}.options[${j}]`));
  });
}

/**
 * U7-5e: 依存する段（upstream_stages のある段）の形。段の番号は 1 からの並び、depends_on_stage は直前の段、upstream_stages は前のすべての段、
 * 選べるものの after は options_by_choice の鍵で、その鍵の組にある。組の選べるものの after はその鍵（別の上流の選び方の番号を混ぜない）。
 * エンジンの stage_dependency_problems と同じ確かめ。合わなければ止める（項目を読み飛ばして古い 2 段の扱いで送らない）。
 */
function chainedStages(stages: InputStage[]): void {
  if (!stages.some((s) => s.input === "choose_option" && s.upstream_stages !== undefined)) return;
  stages.forEach((raw, i) => {
    const s = raw as OptionStage;
    const w = `stages[${s.stage}]`;
    if (s.stage !== i + 1 || s.input !== "choose_option" || !s.options) fail(`${w}: 依存する段の番号`);
    if (i === 0) {
      if (s.depends_on_stage !== undefined || s.upstream_stages !== undefined || s.options.some((op) => "after" in op)) fail(`${w}: 1 段目が依存する`);
      return;
    }
    const upstream = s.upstream_stages ?? [];
    if (s.depends_on_stage !== i || upstream.length !== i || upstream.some((n, k) => n !== k + 1)) fail(`${w}.upstream_stages`);
    const by = s.options_by_choice ?? {};
    const afterOf = new Map(s.options.map((op) => [op.id, op.after]));
    for (const op of s.options) {
      if (typeof op.after !== "string" || !(op.after in by) || !by[op.after]!.some((p) => p.option === op.id)) fail(`${w}.options.${op.id}.after`);
    }
    for (const [key, pairs] of Object.entries(by)) for (const p of pairs) if (afterOf.get(p.option) !== key) fail(`${w}.options_by_choice.${key}: ${p.option}`);
  });
}

function stage(value: unknown, i: number): InputStage {
  const w = `stages[${i}]`;
  const o = obj(value, w);
  // 知らない項目のある段は、画面が扱えない制約かもしれない（契約名・形式の版が同じでも古い画面へ通さない）
  for (const key of Object.keys(o)) if (!STAGE_KEYS.has(key)) fail(`${w}.${key}: 知らない入力の項目`);
  int(o.stage, `${w}.stage`);
  const kind = oneOf(o.input, INPUT_KINDS, `${w}.input`);
  count(o.count, `${w}.count`);
  str(o.order, `${w}.order`);
  if ("role" in o) str(o.role, `${w}.role`);
  if ("note" in o) str(o.note, `${w}.note`);
  if ("upstream_stages" in o) intList(o.upstream_stages, `${w}.upstream_stages`);
  if (kind === "choose_option") {
    if ("options" in o) arr(o.options, `${w}.options`).forEach((op, j) => option(op, `${w}.options[${j}]`));
    else if (!("options_from_stage" in o)) fail(`${w}.options`);
    else int(o.options_from_stage, `${w}.options_from_stage`);
    if ("depends_on_stage" in o !== "options_by_choice" in o) fail(`${w}.depends_on_stage`);
    // U7-5g-1: 前の段の選び方の組で引く段。path_stages と options_by_path は組で持ち、U7-5e の依存の形（options_by_choice・depends_on_stage・upstream_stages）と併用しない
    if ("path_stages" in o !== "options_by_path" in o) fail(`${w}: path_stages と options_by_path は組で持つ`);
    if ("path_stages" in o) {
      if ("depends_on_stage" in o || "options_by_choice" in o || "upstream_stages" in o) fail(`${w}: options_by_path を options_by_choice・depends_on_stage・upstream_stages と併用している`);
      intList(o.path_stages, `${w}.path_stages`);
      if (!("options" in o)) fail(`${w}.options`);
      const byPath = obj(o.options_by_path, `${w}.options_by_path`);
      for (const [key, refs] of Object.entries(byPath)) {
        arr(refs, `${w}.options_by_path.${key}`).forEach((pv, j) => {
          const pw = `${w}.options_by_path.${key}[${j}]`;
          const po = obj(pv, pw);
          for (const k of Object.keys(po)) if (!PAIR_KEYS.has(k)) fail(`${pw}.${k}: 知らない組の項目`);
          str(po.option, `${pw}.option`);
          bool(po.eligible, `${pw}.eligible`);
          oneOf(po.processability, PROCESSABILITY, `${pw}.processability`);
          reasons(po, pw);
        });
      }
    }
    if ("depends_on_stage" in o) {
      int(o.depends_on_stage, `${w}.depends_on_stage`);
      const by = obj(o.options_by_choice, `${w}.options_by_choice`);
      for (const [first, pairs] of Object.entries(by)) {
        arr(pairs, `${w}.options_by_choice.${first}`).forEach((pv, j) => {
          const pw = `${w}.options_by_choice.${first}[${j}]`;
          const po = obj(pv, pw);
          for (const key of Object.keys(po)) if (!PAIR_KEYS.has(key)) fail(`${pw}.${key}: 知らない組の項目`);
          str(po.option, `${pw}.option`);
          bool(po.eligible, `${pw}.eligible`);
          oneOf(po.processability, PROCESSABILITY, `${pw}.processability`);
          reasons(po, pw);
        });
      }
    }
    // にげるの費用の段（total_units・units・cost_evaluation の組み合わせ）は、種類ごとの確かめ（retreatStages）で決める。ここでは値の形だけ
    if ("total_units" in o) count(o.total_units, `${w}.total_units`);
    if ("cost_evaluation" in o) costEvaluation(o.cost_evaluation, `${w}.cost_evaluation`);
  } else {
    if ("depends_on_stage" in o || "options_by_choice" in o || "total_units" in o || "cost_evaluation" in o || "path_stages" in o || "options_by_path" in o) {
      fail(`${w}: 値の段に選べるものの項目`);
    }
    const r = obj(o.range, `${w}.range`);
    const min = int(r.min, `${w}.range.min`);
    if (int(r.max, `${w}.range.max`) < min) fail(`${w}.range`);
  }
  if ("bench" in o) {
    const b = obj(o.bench, `${w}.bench`);
    const n = int(b.count, `${w}.bench.count`);
    if (n < 0 || int(b.limit, `${w}.bench.limit`) < n) fail(`${w}.bench`);
  }
  if ("confused" in o) bool(o.confused, `${w}.confused`);
  return o as unknown as InputStage;
}

/** 段をまたいだ確かめ: 番号は段をまたいで重ならない、依存の段と組が実在の番号を指す。 */
function stagesConsistent(stages: InputStage[]): void {
  const seen = new Set<string>();
  const byNumber = new Map(stages.map((s) => [s.stage, s]));
  for (const s of stages) {
    if (s.input !== "choose_option") continue;
    const ids = new Set((s.options ?? []).map((op) => op.id));
    if (s.options) {
      for (const id of ids) {
        if (seen.has(id)) fail(`stages: 選べるものの番号 ${id} が重なる`);
        seen.add(id);
      }
      if (ids.size !== s.options.length) fail(`stages[${s.stage}]: 選べるものの番号が重なる`);
    }
    if (s.depends_on_stage !== undefined) {
      const parent = byNumber.get(s.depends_on_stage);
      if (!parent || parent.input !== "choose_option" || !parent.options || parent.stage >= s.stage) fail(`stages[${s.stage}].depends_on_stage`);
      if (parent.count.max !== 1) fail(`stages[${s.stage}].depends_on_stage: 1 段目が 1 つを選ぶ段でない`);
      const parentIds = new Set(parent.options.map((op) => op.id));
      for (const [first, pairs] of Object.entries((s as OptionStage).options_by_choice ?? {})) {
        if (!parentIds.has(first)) fail(`stages[${s.stage}].options_by_choice.${first}`);
        for (const pair of pairs) if (!ids.has(pair.option)) fail(`stages[${s.stage}].options_by_choice.${first}: ${pair.option}`);
      }
    }
    if (s.path_stages !== undefined) pathStage(s, byNumber);
  }
}

/**
 * U7-5g-1: 前の段の選び方の組で引く段（エンジンの _path_stage_problems と同じ確かめ）。
 * path_stages はこの段より前の段の番号の増える並び（自分・あとの段・重なり・循環を止める）。鍵は path_stages の段の選ぶものの番号を段の順に / でつないだもの
 * （どの番号もその段にあり、前の段どうしの組はあとの段の options_by_choice にある組）。値の参照はこの段の選ぶもので、1 つの鍵の中で重ならない。
 */
function pathStage(s: OptionStage, byNumber: Map<number, InputStage>): void {
  const w = `stages[${s.stage}]`;
  const path = s.path_stages ?? [];
  if (path.length === 0 || path.some((n, i) => n < 1 || n >= s.stage || (i > 0 && n <= (path[i - 1] as number)))) fail(`${w}.path_stages: 前の段の増える並びでない`);
  const parents = path.map((n) => {
    const p = byNumber.get(n);
    if (!p || p.input !== "choose_option" || !p.options || p.count.max !== 1) fail(`${w}.path_stages: ${n} 段目が 1 つを選ぶ段でない`);
    return p as OptionStage;
  });
  const ids = new Set((s.options ?? []).map((op) => op.id));
  for (const [key, refs] of Object.entries(s.options_by_path ?? {})) {
    const parts = key.split("/");
    if (parts.length !== path.length || parts.some((part, i) => !(parents[i]!.options ?? []).some((op) => op.id === part))) fail(`${w}.options_by_path.${key}: path_stages の段の選ぶものの組でない`);
    for (let i = 1; i < parts.length; i++) {
      const upper = parents[i]!;
      if (path[i] === (path[i - 1] as number) + 1 && upper.options_by_choice && !(upper.options_by_choice[parts[i - 1] as string] ?? []).some((p) => p.option === parts[i])) {
        fail(`${w}.options_by_path.${key}: ${parts[i - 1]}・${parts[i]} は ${upper.stage} 段目の組にない`);
      }
    }
    const options = refs.map((r) => r.option);
    if (options.some((op) => !ids.has(op))) fail(`${w}.options_by_path.${key}: この段にない選ぶもの`);
    if (new Set(options).size !== options.length) fail(`${w}.options_by_path.${key}: 参照が重なる`);
  }
}

export function inputsResponse(value: unknown): InputsResponse {
  const o = envelope(value, "inputs");
  bool(o.refetch_required, "refetch_required");
  const r = obj(o.response, "response");
  if ("refusal" in r) {
    refusal(r.refusal, "response.refusal");
  } else {
    str(r.candidate, "response.candidate");
    str(r.kind, "response.kind");
    if ("withheld" in r) refusal(r.withheld, "response.withheld");
    const stages = arr(r.stages, "response.stages").map((s, i) => stage(s, i));
    stagesConsistent(stages);
    chainedStages(stages);
    if (!("withheld" in r)) kindStages(r.kind as string, stages);
  }
  return o as unknown as InputsResponse;
}

export function checkResponse(value: unknown): CheckResponse {
  const o = envelope(value, "check");
  bool(o.refetch_required, "refetch_required");
  const r = obj(o.response, "response");
  bool(r.valid, "response.valid");
  if (r.refusal !== null) refusal(r.refusal, "response.refusal");
  return o as unknown as CheckResponse;
}

export function submitResponse(value: unknown): SubmitResponse {
  const o = envelope(value, "submit");
  if (o.ok !== true) fail("submit.ok");
  oneOf(o.outcome, OUTCOMES, "outcome");
  bool(o.refetch_required, "refetch_required");
  if (o.refusal !== null) refusal(o.refusal, "refusal");
  if (o.result !== null) {
    const d = obj(o.result, "result");
    if (!(d.role === "actor" || d.role === "host")) fail("result.role");
    str(d.outcome, "result.outcome");
    // 結果の表示（決定待ち・停止・終局）に使う値。知らない状態は推測で言い換えず、不明な応答として止める
    oneOf(d.status, STATUS_VALUES, "result.status");
    arr(d.next, "result.next").forEach((n, i) => {
      const no = obj(n, `result.next[${i}]`);
      oneOf(no.kind, NEXT_KINDS, `result.next[${i}].kind`);
      if (!(no.player === 0 || no.player === 1 || no.player === null || no.player === undefined)) fail(`result.next[${i}].player`);
    });
    if (d.halt != null) {
      const h = obj(d.halt, "result.halt");
      if (h.message != null) str(h.message, "result.halt.message");
      if (h.category != null) str(h.category, "result.halt.category");
    }
    if (d.category != null) str(d.category, "result.category");
    if (d.message != null) str(d.message, "result.message");
  }
  return o as unknown as SubmitResponse;
}

// ---------------------------------------------------------------- 0.183.0 の読み取りの要求 log

function logPosition(value: unknown, where: string): LogPosition {
  const o = obj(value, where);
  const keys = Object.keys(o);
  if (keys.length !== LOG.position_keys.length || !LOG.position_keys.every((k) => keys.includes(k))) fail(`${where} の項目`);
  for (const k of LOG.position_keys) {
    const n = int(o[k], `${where}.${k}`);
    if (n < 0 || n >= LOG.position_limit) fail(`${where}.${k} の範囲`);
  }
  return { segment: o.segment as number, index: o.index as number };
}

const before = (a: LogPosition, b: LogPosition) => a.segment < b.segment || (a.segment === b.segment && a.index < b.index);
const samePosition = (a: LogPosition, b: LogPosition) => a.segment === b.segment && a.index === b.index;
/** here が位置 prev に続く位置か（同じ位置か、後ろの区間の 0 番。エンジンの位置の正規化）。 */
const follows = (prev: LogPosition, here: LogPosition) => samePosition(prev, here) || (here.segment > prev.segment && here.index === 0);

/** 見せたカードの出来事（card_id を持ちうる）の、表示に使う項目の形。 */
function identifiedEvent(event: Record<string, unknown>, where: string): void {
  playerOrNull(event.player, `${where}.player`);
  if (event.player === null) fail(`${where}.player`);
  if (event.card !== undefined && event.card !== null) int(event.card, `${where}.card`);
  if (event.card_id !== undefined) str(event.card_id, `${where}.card_id`);
}

function logItem(value: unknown, where: string): LogItem {
  const o = obj(value, where);
  const keys = Object.keys(o);
  if (keys.length !== LOG.entry_keys.length || !LOG.entry_keys.every((k) => keys.includes(k))) fail(`${where} の項目`);
  const position = logPosition({ segment: o.segment, index: o.log_index }, where);
  const event = obj(o.event, `${where}.event`);
  str(event.kind, `${where}.event.kind`);
  if ("hidden" in event) {
    // 見えない項目の名前と、並びなら枚数だけ（値は null か 0 以上の整数）。接続層もマスクの構造として確かめてから返す
    const hidden = obj(event.hidden, `${where}.event.hidden`);
    for (const [name, v] of Object.entries(hidden)) {
      if (v !== null && (int(v, `${where}.event.hidden.${name}`) < 0)) fail(`${where}.event.hidden.${name}`);
    }
  }
  if (LOG.identified_events.includes(event.kind as string)) identifiedEvent(event, `${where}.event`);
  return { segment: position.segment, log_index: position.index, event: event as LogItem["event"] };
}

/** log の応答。from は送った位置（省いたなら null。エンジンは (0, 0) から読む）。位置の連続・next・complete を確かめる。 */
export function logResponse(value: unknown, from: LogPosition | null): LogResponse {
  const o = envelope(value, "log");
  if (o.ok !== true) fail("log.ok");
  const keys = Object.keys(o);
  if (keys.length !== LOG.response_keys.length || !LOG.response_keys.every((k) => keys.includes(k))) fail("log の項目");
  const entries = arr(o.entries, "log.entries");
  if (entries.length > LOG.max_entries) fail("log.entries の件数");
  const items = entries.map((e, i) => logItem(e, `log.entries[${i}]`));
  const next = logPosition(o.next, "log.next");
  const end = logPosition(o.end, "log.end");
  const baseline = logPosition(o.baseline_end, "log.baseline_end");
  const complete = bool(o.complete, "log.complete");
  let cursor = from ?? { segment: 0, index: 0 };
  items.forEach((item, i) => {
    const here = { segment: item.segment, index: item.log_index };
    if (!follows(cursor, here)) fail(`log.entries[${i}] の位置`);
    cursor = { segment: here.segment, index: here.index + 1 };
  });
  if (!follows(cursor, next)) fail("log.next の位置");
  if (complete !== samePosition(next, end)) fail("log.complete");
  if (!complete && items.length < LOG.max_entries) fail("log.complete（256 件未満で続きがある）");
  if (before(end, next) || before(end, baseline)) fail("log.end");
  return { contract: CONTRACT as "kyuura-client-api", format: 1, type: "log", ok: true, entries: items, next, end, complete, baseline_end: baseline };
}

// ---------------------------------------------------------------- 接続層の封筒

function guiEnvelope(value: unknown): Obj {
  const o = obj(value, "応答");
  if (o.gui_server !== GUI_SERVER_FORMAT) fail("gui_server");
  bool(o.ok, "ok");
  return o;
}

/** 接続層の誤り（gui_server の封筒で ok が偽）なら、その誤り。 */
export function guiError(value: unknown): { code: string; message: string } | null {
  if (typeof value !== "object" || value === null || (value as Obj).gui_server !== GUI_SERVER_FORMAT) return null;
  const o = value as Obj;
  if (o.ok !== false || typeof o.error !== "object" || o.error === null) return null;
  const e = o.error as Obj;
  if (typeof e.code !== "string" || typeof e.message !== "string") return null;
  return { code: e.code, message: e.message };
}

function updateItem(value: unknown, i: number): UpdateItem {
  // 公開の更新は ok を持たない封筒（{contract, format, type: "update", number, status, observation}）
  const o = obj(value, `updates[${i}]`);
  if (o.contract !== CONTRACT || o.format !== FORMAT || o.type !== "update") fail(`updates[${i}] の封筒`);
  int(o.number, `updates[${i}].number`);
  status(o.status);
  if (o.observation !== null) observation(o.observation);
  return o as unknown as UpdateItem;
}

export function updatesResponse(value: unknown): UpdatesResponse {
  const o = guiEnvelope(value);
  if (o.ok !== true || o.kind !== "updates") fail("updates");
  int(o.latest, "latest");
  bool(o.gap, "gap");
  arr(o.updates, "updates").forEach((u, i) => updateItem(u, i));
  return o as unknown as UpdatesResponse;
}

function matchInfo(value: unknown): MatchInfo {
  const o = obj(value, "match");
  str(o.match_id, "match.match_id");
  const origin = obj(o.origin, "match.origin");
  str(origin.kind, "match.origin.kind");
  str(origin.label, "match.origin.label");
  const seats = obj(o.seats, "match.seats");
  for (const key of ["player0", "player1", "spectator"]) str(obj(seats[key], `match.seats.${key}`).token, `match.seats.${key}.token`);
  str(obj(o.host, "match.host").token, "match.host.token");
  return o as unknown as MatchInfo;
}

export function createMatchResult(value: unknown): CreateMatchResult {
  const o = guiEnvelope(value);
  if (o.start != null) {
    const s = obj(o.start, "start");
    if (s.contract !== CONTRACT || s.format !== FORMAT || s.type !== "start") fail("start");
    str(s.outcome, "start.outcome");
    str(s.status, "start.status");
  }
  if (o.deck_diagnostics != null) {
    arr(o.deck_diagnostics, "deck_diagnostics").forEach((list, i) =>
      arr(list, `deck_diagnostics[${i}]`).forEach((d, j) => {
        const dd = obj(d, `deck_diagnostics[${i}][${j}]`);
        str(dd.code, "code");
        str(dd.message, "message");
      }),
    );
  }
  if (o.ok === true) matchInfo(o.match);
  return o as unknown as CreateMatchResult;
}

export function presetsResponse(value: unknown): { presets: PresetDeck[]; convention_sets: string[] } {
  const o = guiEnvelope(value);
  arr(o.presets, "presets").forEach((p, i) => {
    const po = obj(p, `presets[${i}]`);
    str(po.id, "id");
    str(po.name_ja, "name_ja");
    arr(po.entries, "entries");
  });
  strList(o.convention_sets, "convention_sets");
  return o as unknown as { presets: PresetDeck[]; convention_sets: string[] };
}

export function cardsResponse(value: unknown): CatalogCard[] {
  const o = guiEnvelope(value);
  return arr(o.cards, "cards").map((c, i) => {
    const co = obj(c, `cards[${i}]`);
    str(co.id, "id");
    str(co.name_ja, "name_ja");
    return co as unknown as CatalogCard;
  });
}

export function scenariosResponse(value: unknown): ScenarioInfo[] {
  const o = guiEnvelope(value);
  return arr(o.scenarios, "scenarios").map((s, i) => {
    const so = obj(s, `scenarios[${i}]`);
    str(so.id, "id");
    str(so.label, "label");
    str(so.description, "description");
    return so as unknown as ScenarioInfo;
  });
}
