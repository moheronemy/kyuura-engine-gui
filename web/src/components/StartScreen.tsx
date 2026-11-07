// 対戦の開始の画面。デッキは「カード ID と枚数」で 2 人分を入力する（エンジンの固定デッキをサンプルとして読み込める）。
// デッキの中身の検査（枚数・同じ名前の上限・カードの対応）はエンジンが行い、ここは行の形だけを確かめる。
import { useEffect, useId, useState } from "react";
import { createMatch, loadPresets, loadScenarios, type Transport } from "../api/transport";
import type { CreateMatchRequest, CreateMatchResult, DeckEntry, MatchInfo, PresetDeck, ScenarioInfo } from "../api/types";

export interface ParsedDeck {
  entries: DeckEntry[];
  errors: string[];
  total: number;
}

/** 1 行に「カードID 枚数」（空白・カンマ・タブ区切り）。# からは注記。 */
export function parseDeckText(text: string): ParsedDeck {
  const entries: DeckEntry[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) return;
    const parts = line.split(/[\s,]+/);
    const [id, count] = parts;
    const n = Number(count);
    if (parts.length !== 2 || !id || !Number.isInteger(n) || n < 1 || n > 60) {
      errors.push(`${index + 1} 行目: 「カードID 枚数」の形にしてください`);
      return;
    }
    entries.push({ card_id: id, count: n });
  });
  return { entries, errors, total: entries.reduce((s, e) => s + e.count, 0) };
}

export function presetToText(preset: PresetDeck): string {
  return preset.entries.map((e) => `${e.card_id} ${e.count}${e.name_ja ? `  # ${e.name_ja}` : ""}`).join("\n");
}

function DeckEditor({
  player,
  presets,
  text,
  onChange,
  names,
}: {
  player: 0 | 1;
  presets: PresetDeck[];
  text: string;
  onChange(text: string): void;
  names: (id: string) => string | undefined;
}) {
  const id = useId();
  const parsed = parseDeckText(text);
  const unknown = parsed.entries.filter((e) => !names(e.card_id)).map((e) => e.card_id);
  return (
    <fieldset className="deck-editor">
      <legend>プレイヤー{player}のデッキ</legend>
      <label className="field" htmlFor={`${id}-preset`}>
        <span>サンプル（エンジンの固定デッキ）を読み込む</span>
        <select
          id={`${id}-preset`}
          defaultValue=""
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) onChange(presetToText(preset));
          }}
        >
          <option value="">選んでください</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name_ja}（{p.id}）
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor={`${id}-text`}>
        <span>カードID と枚数（1 行に 1 種類）</span>
        <textarea id={`${id}-text`} rows={10} value={text} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </label>
      <p className="small">
        合計 {parsed.total} 枚・{parsed.entries.length} 種類
      </p>
      {parsed.errors.length ? (
        <ul className="small warn" role="alert">
          {parsed.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {unknown.length ? <p className="small warn">カード名表にない ID: {unknown.join("・")}（エンジンの検査で確かめます）</p> : null}
    </fieldset>
  );
}

export function StartScreen({
  transport,
  names,
  onStarted,
}: {
  transport: Transport;
  names: (id: string) => string | undefined;
  onStarted(match: MatchInfo): void;
}) {
  const [presets, setPresets] = useState<PresetDeck[]>([]);
  const [conventionSets, setConventionSets] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [mode, setMode] = useState<"decks" | "scenario">("decks");
  const [texts, setTexts] = useState<[string, string]>(["", ""]);
  const [conventions, setConventions] = useState("");
  const [scenario, setScenario] = useState("");
  const [result, setResult] = useState<CreateMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  useEffect(() => {
    let alive = true;
    loadPresets(transport)
      .then((r) => {
        if (!alive) return;
        setPresets(r.presets);
        setConventionSets(r.convention_sets);
        const [a, b] = r.presets;
        if (a && b) setTexts([presetToText(a), presetToText(b)]);
      })
      .catch(() => alive && setError("サンプルデッキを読み込めませんでした（接続層が起動しているか確かめてください）"));
    loadScenarios(transport)
      .then((s) => {
        if (!alive) return;
        setScenarios(s);
        if (s[0]) setScenario(s[0].id);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [transport]);

  const parsed = [parseDeckText(texts[0]), parseDeckText(texts[1])] as const;
  const deckReady = parsed.every((p) => p.errors.length === 0 && p.entries.length > 0);

  async function start() {
    setBusy(true);
    setError(null);
    setResult(null);
    const body: CreateMatchRequest =
      mode === "scenario"
        ? { mode: "scenario", scenario }
        : { mode: "decks", decks: [{ entries: parsed[0].entries }, { entries: parsed[1].entries }], ...(conventions ? { conventions } : {}) };
    try {
      const r = await createMatch(transport, body);
      if (r.ok && r.match) onStarted(r.match);
      else setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "対戦を作成できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="start panel" aria-labelledby={`${formId}-h`}>
      <h2 id={`${formId}-h`}>ローカル対戦を作る</h2>
      <p className="small">
        作成すると、接続層が持っている前の対戦は破棄されます（初版は 1 つの対戦だけを持ちます）。乱数の種は接続層が決め、画面には返しません。
      </p>
      <div className="radio-row" role="radiogroup" aria-label="作り方">
        <label className="option">
          <input type="radio" name={`${formId}-mode`} checked={mode === "decks"} onChange={() => setMode("decks")} />
          <span>デッキを指定して新しく始める</span>
        </label>
        <label className="option">
          <input type="radio" name={`${formId}-mode`} checked={mode === "scenario"} onChange={() => setMode("scenario")} />
          <span>検証用の固定例から始める</span>
        </label>
      </div>
      {mode === "decks" ? (
        <>
          <div className="deck-grid">
            {[0, 1].map((p) => (
              <DeckEditor
                key={p}
                player={p as 0 | 1}
                presets={presets}
                text={texts[p as 0 | 1]}
                names={names}
                onChange={(t) => setTexts((old) => (p === 0 ? [t, old[1]] : [old[0], t]))}
              />
            ))}
          </div>
          <label className="field" htmlFor={`${formId}-conv`}>
            <span>規約集合（任意）</span>
            <select id={`${formId}-conv`} value={conventions} onChange={(e) => setConventions(e.target.value)}>
              <option value="">既定（エンジンの現行の規約集合）</option>
              {conventionSets.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <fieldset>
          <legend>固定例</legend>
          <p className="small">
            エンジンのテストの既存の固定例を接続層が再生した盤面から始めます（再生は API の外の準備です。通常の合法な操作の列とは別の確かめです）。番の基本の操作・ワザの宣言・宣言のあとの決定は、デッキを指定して新しく始めた対戦でも扱えます。
          </p>
          <ul className="options">
            {scenarios.map((s) => (
              <li key={s.id}>
                <label className="option">
                  <input type="radio" name={`${formId}-sc`} checked={scenario === s.id} onChange={() => setScenario(s.id)} />
                  <span>
                    <strong>{s.label}</strong>
                    <br />
                    <span className="small">{s.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <div className="actions">
        <button type="button" className="primary" onClick={() => void start()} disabled={busy || (mode === "decks" ? !deckReady : !scenario)}>
          {busy ? "作成中…" : "対戦を作成（前の対戦は破棄）"}
        </button>
      </div>
      {error ? (
        <p className="callout error" role="alert">
          {error}
        </p>
      ) : null}
      {result && !result.ok ? (
        <div className="callout error" role="alert">
          <strong>対戦を開始できませんでした</strong>
          {result.start?.diagnostic ? (
            <p>
              <code>{result.start.diagnostic.diagnostic_id}</code>（{result.start.diagnostic.category}）: {result.start.diagnostic.message}
            </p>
          ) : null}
          {result.error ? <p className="small">{result.error.message}</p> : null}
          {result.deck_diagnostics?.map((list, p) =>
            list.length ? (
              <div key={p}>
                <p>プレイヤー{p}のデッキ:</p>
                <ul>
                  {list.map((d, i) => (
                    <li key={i}>
                      <code>{d.code}</code> {d.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}
