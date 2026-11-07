// 実行時の検証。ブラウザが受け取った JSON を、契約の識別・形式の版・表示と操作に使う項目の形で確かめてから型に入れる。
// 合わなければ ProtocolError（画面は「不明な応答」を表示し、操作を止める）。全応答を any で通さない。
import {
  CONTRACT,
  FORMAT,
  GUI_SERVER_FORMAT,
  INPUT_DISCLOSURE,
  INPUT_KINDS,
  LEGAL_ACTIONS_FORMAT,
  OUTCOMES,
  PAIR_KEYS,
  PROCESSABILITY,
  STAGE_KEYS,
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

function playerObservation(value: unknown, i: number): PlayerObservation {
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
  if (o.active !== null) fieldSlot(o.active, `${w}.active`);
  arr(o.bench, `${w}.bench`).forEach((b, j) => fieldSlot(b, `${w}.bench[${j}]`));
  return o as unknown as PlayerObservation;
}

function cardRef(value: unknown, where: string): void {
  const o = obj(value, where);
  int(o.card, `${where}.card`);
  str(o.card_id, `${where}.card_id`);
}

function fieldSlot(value: unknown, where: string): void {
  const o = obj(value, where);
  if (o.face_down === true) return;
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
  playerOrNull(o.viewer, "observation.viewer");
  int(o.turn, "observation.turn");
  playerOrNull(o.current_player, "observation.current_player");
  str(o.phase, "observation.phase");
  const players = arr(o.players, "observation.players");
  if (players.length !== 2) fail("observation.players");
  players.forEach((p, i) => playerObservation(p, i));
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
  for (const key of ["implemented_kinds", "scope_kinds", "offered_kinds", "not_covered_kinds", "withheld_input_candidates"]) {
    strList(o[key], `coverage.${key}`);
  }
  str(o.completeness, "coverage.completeness");
  str(o.completeness_scope, "coverage.completeness_scope");
  return o as unknown as Coverage;
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
  coverage(o.coverage);
  arr(o.candidates, "candidates").forEach((c, i) => candidate(c, i));
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
    if ("card_id" in o) fail(`${where}: うらのポケモンにカード ID がある`); // 情報境界（エンジンは出さない）
  }
  return o as unknown as InputOption;
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
  if (kind === "choose_option") {
    if ("options" in o) arr(o.options, `${w}.options`).forEach((op, j) => option(op, `${w}.options[${j}]`));
    else if (!("options_from_stage" in o)) fail(`${w}.options`);
    else int(o.options_from_stage, `${w}.options_from_stage`);
    if ("depends_on_stage" in o !== "options_by_choice" in o) fail(`${w}.depends_on_stage`);
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
    if ("total_units" in o) {
      count(o.total_units, `${w}.total_units`);
      // 個数で数える段は、すべての選べるものに units がある
      if (!("options" in o) || (o.options as Obj[]).some((op) => !("units" in op))) fail(`${w}.total_units: units のない選べるもの`);
    }
  } else {
    if ("depends_on_stage" in o || "options_by_choice" in o || "total_units" in o) fail(`${w}: 値の段に選べるものの項目`);
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
    stagesConsistent(arr(r.stages, "response.stages").map((s, i) => stage(s, i)));
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
    str(d.status, "result.status");
  }
  return o as unknown as SubmitResponse;
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
