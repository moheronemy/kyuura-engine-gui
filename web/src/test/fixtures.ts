// UI の単体テスト用の模擬の応答（実エンジンとの接続確認ではない。実エンジンとの確認は e2e/ と server/tests/）。
// 形は固定版のエンジン（v0.165.0）で実際に得た応答に合わせている（U7-3 の入力の形は test/u73.ts）。
import type { Transport } from "../api/transport";
import type { Candidate, InputStage, Observation, PlayerObservation } from "../api/types";

export const ENV = { contract: "kyuura-client-api", format: 1 } as const;

export function player(index: 0 | 1, opts: { handCards?: { card: number; card_id: string }[] | null; active?: unknown } = {}): PlayerObservation {
  const cards = opts.handCards === undefined ? null : opts.handCards;
  return {
    player: index,
    hand: { count: cards ? cards.length : 5, cards, revealed_by: [] },
    deck: { count: 40 + index },
    prizes: { count: 6, face_up: [] },
    set_aside: [],
    discard: [],
    active: (opts.active ?? null) as PlayerObservation["active"],
    bench: [],
  };
}

export function pokemon(id: number, name: string, extra: Record<string, unknown> = {}) {
  return {
    pokemon_id: id,
    card: id * 10,
    card_id: `T-${id}`,
    name_ja: name,
    hp: 70,
    printed_hp: 70,
    damage: 20,
    pokemon_type: "fighting",
    weakness: "psychic",
    resistance: null,
    resistance_value: 0,
    energy: [{ card: 99, card_id: "PMCG1-102" }],
    trainers: [],
    special_conditions: ["poisoned"],
    persistent_effects: [],
    markers: [],
    attacks: [{ name_ja: "ジャブ" }],
    ...extra,
  };
}

export function observation(viewer: 0 | 1 | null, players: [PlayerObservation, PlayerObservation], extra: Partial<Observation> = {}): Observation {
  return {
    viewer,
    turn: 3,
    current_player: 0,
    phase: "main",
    players,
    stadium: null,
    trainer_in_use: null,
    decision: null,
    result: null,
    ...extra,
  };
}

export function view(viewerLabel: 0 | 1 | "spectator" | "host", obs: Observation, status: Record<string, unknown> = {}) {
  return {
    ...ENV,
    type: "view",
    ok: true,
    viewer: viewerLabel,
    status: { status: "in_progress", phase: obs.phase, segment: 0, continuable: true, waiting: [{ kind: "turn_action", by: 0 }], halt: null, ...status },
    observation: obs,
  };
}

export const COVERAGE_TURN = {
  // 固定版のエンジン（0.165.0）の番の coverage。基本の 4 種類は評価した（scope_kinds）が、この例では候補に出していない
  implemented_kinds: ["take_prize", "promote_active", "answer_decision", "end_turn", "place_starting", "mulligan_draw", "play_basic", "attach_energy", "evolve", "retreat", "report_janken", "start_sudden_death"],
  scope_kinds: ["end_turn", "play_basic", "attach_energy", "evolve", "retreat", "use_attack", "play_trainer", "use_power", "use_stadium", "remove_disguise", "discard_from_play", "reveal_face_down", "check_face_up_deck"],
  offered_kinds: ["end_turn"],
  not_covered_kinds: ["use_attack", "play_trainer", "use_power", "use_stadium", "remove_disguise", "discard_from_play", "reveal_face_down", "check_face_up_deck"],
  withheld_input_candidates: [],
  completeness: "partial",
  completeness_scope: "scope_kinds（この応答に明示した種類だけ。全コマンドの合法手ではない）",
};

export function cand(kind: string, processability = "may_stop_later", extra: Partial<Candidate> = {}): Candidate {
  return {
    id: "c1",
    kind,
    processability,
    reasons: [],
    guarantees: { preconditions: "前提", acceptance: "保証しない", after_acceptance: "評価していない" },
    input_disclosure: "confirmed",
    input_stages: [{ stage: 1, input: "choose_option" }],
    ...extra,
  };
}

export function candidates(revision: string, list: Candidate[], extra: Record<string, unknown> = {}) {
  return {
    ...ENV,
    type: "candidates",
    ok: true,
    response: {
      kyuura_legal_actions_format: 1,
      game: "g1",
      actor: 0,
      revision,
      status: "in_progress",
      situation: list.length ? "actor_to_act" : "waiting_for_player",
      empty_reason: list.length ? null : "not_actor",
      coverage: COVERAGE_TURN,
      candidates: list,
      ...extra,
    },
  };
}

export function inputs(kind: string, stages: InputStage[], extra: Record<string, unknown> = {}) {
  return { ...ENV, type: "inputs", ok: true, response: { candidate: "c1", kind, stages, ...extra }, refetch_required: false };
}

export function submitResult(outcome: string, opts: { refusal?: { code: string; message: string } | null; refetch?: boolean } = {}) {
  return {
    ...ENV,
    type: "submit",
    ok: true,
    outcome,
    refusal: opts.refusal ?? null,
    result:
      outcome === "refused"
        ? null
        : { role: "actor", outcome, status: "in_progress", continuable: true, next: [], diagnostic_id: null, category: null, message: null, halt: null, operation_id: "x" },
    refetch_required: opts.refetch ?? outcome === "accepted",
  };
}

export const EMPTY_UPDATES = { gui_server: 1, ok: true, kind: "updates", latest: 0, oldest_retained: null, gap: false, updates: [] };

export interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}

type Handler = (call: Call) => unknown | Promise<unknown>;

/** 模擬の接続層。route（seat/host）と識別子と要求の種類で応答を決める。 */
export function mockTransport(handler: Handler): Transport & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async request(method, path, body) {
      const call = { method, path, body: body as Record<string, unknown> | undefined };
      calls.push(call);
      const result = await handler(call);
      if (result instanceof Error) throw result;
      return JSON.parse(JSON.stringify(result)) as unknown;
    },
  };
}

export const MATCH = {
  gui_server: 1,
  ok: true,
  start: { ...ENV, type: "start", ok: true, outcome: "accepted", status: "in_progress", diagnostic: null },
  deck_diagnostics: [[], []],
  match: {
    match_id: "m1",
    origin: { kind: "new_game", label: "新しいローカル対戦" },
    seats: { player0: { token: "tok0" }, player1: { token: "tok1" }, spectator: { token: "tokS" } },
    host: { token: "tokH" },
  },
};

export const PRESETS = {
  gui_server: 1,
  ok: true,
  presets: [
    { id: "a", name_ja: "A", entries: [{ card_id: "T-1", count: 60, name_ja: "テスト" }] },
    { id: "b", name_ja: "B", entries: [{ card_id: "T-2", count: 60, name_ja: "テスト2" }] },
  ],
  convention_sets: [],
};

/** 作成の画面・カード名表・固定例の一覧の共通の応答。 */
export function commonRoutes(call: Call): unknown | undefined {
  if (call.path === "/api/decks/presets") return PRESETS;
  if (call.path === "/api/cards") return { gui_server: 1, ok: true, cards: [{ id: "PMCG1-058", name_ja: "エビワラー", category: "pokemon", stage: "basic", hp: 70 }] };
  if (call.path === "/api/scenarios") return { gui_server: 1, ok: true, scenarios: [] };
  if (call.path === "/api/card-definitions") return CARD_DEFINITIONS;
  if (call.path === "/api/local-match") return MATCH;
  if (call.path.endsWith("/updates?after=0") || /\/updates\?after=\d+$/.test(call.path)) return EMPTY_UPDATES;
  return undefined;
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------- 公開カード定義（接続層の拡張の口）と模擬の描画

const text = (ja: string | null, en: string | null = null) => ({ ja, en });

/** 固定版のエンジンの同梱データの形に合わせた記録（接続層が写す項目だけ）。 */
export function pokemonRecord(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    jp_set: "PMCG1",
    category: "pokemon",
    name: text(name),
    pokemon: {
      stage: "basic",
      evolves_from: null,
      hp: 70,
      types: ["fighting"],
      weaknesses: [{ type: "psychic" }],
      resistances: [],
      retreat_cost: 2,
      rules_text: null,
      powers: [],
      attacks: [{ name: text("ジャブ"), cost: ["fighting"], damage: { display: "20" }, text: text(null) }],
      ...extra,
    },
    trainer: null,
    energy: null,
    jp_print: { level: 33, rarity: "●(C)" },
  };
}

export const TRAINER_RECORD = { id: "PMCG1-091", jp_set: "PMCG1", category: "trainer", name: text("ポケモン交換おじさん"), pokemon: null, trainer: { text: text("説明") }, energy: null, jp_print: null };
export const ENERGY_RECORD = { id: "PMCG1-102", jp_set: "PMCG1", category: "energy", name: text("基本闘エネルギー"), pokemon: null, trainer: null, energy: { kind: "basic", provides: ["fighting"], text: text(null) }, jp_print: null };

export function cardDefinitions(cards: unknown[], extra: Record<string, unknown> = {}) {
  return {
    gui_server: 1,
    ok: true,
    kind: "card_definitions",
    schema: "kyuura-gui-card-definitions",
    schema_version: 1,
    source: { package: "kyuura_engine", resource: "data/kyuura_cards.json", format: "kyuura-engine card extract 1", engine_version: "0.165.0", sha256: "0".repeat(64) },
    card_count: cards.length,
    omitted: 0,
    cards,
    ...extra,
  };
}

/** 全体の表には非公開のカード（SECRET-1）の定義もある。表にあることは、表面を描いてよいことを意味しない。 */
export const CARD_DEFINITIONS = cardDefinitions([pokemonRecord("PMCG1-058", "エビワラー"), pokemonRecord("PMCG1-029", "ニドラン♂"), pokemonRecord("PMCG1-030", "ニドリーノ", { stage: "stage1", evolves_from: { ja: "ニドラン♂", en: null } }), pokemonRecord("SECRET-1", "ひみつのポケモン"), pokemonRecord("T-1", "テスト"), TRAINER_RECORD, ENERGY_RECORD]);

export interface RenderCall {
  canvas: HTMLCanvasElement;
  item: unknown;
  cardId: string | null;
  scale: number;
  resolve(drawn: boolean): void;
  reject(error: unknown): void;
}

/**
 * 模擬の描画（jsdom には Canvas 2D がない）。要求ごとに終わり方をテストが決める。
 * toItem は記録の id を持つだけの内容を返す（どのカードを描こうとしたかを確かめるため）。
 */
export function mockRenderer(opts: { back?: Promise<string>; toItem?: (record: { id: string }) => unknown } = {}) {
  const calls: RenderCall[] = [];
  const cancelled: HTMLCanvasElement[] = [];
  const items: string[] = [];
  let backCalls = 0;
  const renderer = {
    toItem(record: { id: string }) {
      items.push(record.id);
      if (opts.toItem) return opts.toItem(record);
      return { kind: "card", cardId: record.id };
    },
    render(canvas: HTMLCanvasElement, item: unknown, scale: number) {
      const d = deferred<boolean>();
      const cardId = typeof item === "object" && item !== null && "cardId" in item ? String(item.cardId) : null;
      calls.push({ canvas, item, cardId, scale, resolve: d.resolve, reject: d.reject });
      return d.promise;
    },
    cancel(canvas: HTMLCanvasElement) {
      cancelled.push(canvas);
    },
    backImage() {
      backCalls += 1;
      return opts.back ?? Promise.resolve("data:image/png;base64,QkFDSw==");
    },
  };
  return { renderer: renderer as unknown as import("../cards/renderer").CardRenderer, calls, cancelled, items, backCalls: () => backCalls };
}
