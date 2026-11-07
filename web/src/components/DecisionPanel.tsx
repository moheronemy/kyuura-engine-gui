// 決定・操作の入力の画面。候補の入力の段（inputs の stages）と入力の制約だけから組み立てる。
// - 選択肢の ID（o1, o2, …）・値をそのまま送る。カード名などから uid・コマンドを推測しない
// - 選んだ順を保つ（並べ替えない）。順序が未確認でも入力順のまま送る
// - 0 枚の回答・辞退・空の選択肢も表示し、GUI が独自に決定を飛ばさない（送るのは利用者の操作だけ）
// - 制約の表示と送信ボタンの可否は、エンジンが返した count・range を読むだけ（合法性の最終の判定はエンジン）
import { useId, useMemo, useState } from "react";
import { EXECUTABLE_PROCESSABILITY } from "../api/contract";
import type { Choice, FieldSlot, InputOption, InputStage, Observation, OptionStage } from "../api/types";
import type { Selection } from "../state/useEndpointSession";
import { KIND_LABELS, ORDER_TEXT, PLACEMENT_TEXT, PROCESSABILITY_TEXT, labelOf, playerLabel } from "../labels";
import { DisclosureBadge, ProcessabilityBadge } from "./Badges";

type Names = (cardId: string) => string | undefined;

interface Props {
  selection: Selection;
  observation: Observation | null;
  names: Names;
  busy: boolean;
  blocked: boolean;
  onCheck(choices: Choice[]): void;
  onSubmit(choices: Choice[]): void;
  onCancel(): void;
}

const ROLE_LABELS: Record<string, string> = { active: "バトル場", bench: "ベンチ" };
const MEANING_LABELS: Record<string, string> = {
  count: "枚数",
  player: "プレイヤー",
  pokemon: "ポケモン",
  card: "カード",
  position: "位置",
  number: "数",
  value: "値",
  color: "色",
  name: "名前",
  janken: "じゃんけんの手",
};

function isField(slot: FieldSlot | null): slot is Exclude<FieldSlot, { face_down: true }> {
  return slot != null && !("face_down" in slot);
}

function pokemonPlace(observation: Observation | null, pokemonId: number): string | null {
  if (!observation) return null;
  for (const p of observation.players) {
    if (isField(p.active) && p.active.pokemon_id === pokemonId) return `${p.active.name_ja}（${playerLabel(p.player)}・バトル場）`;
    const index = p.bench.findIndex((b) => isField(b) && b.pokemon_id === pokemonId);
    const bench = p.bench[index];
    if (index >= 0 && isField(bench ?? null)) return `${(bench as { name_ja: string }).name_ja}（${playerLabel(p.player)}・ベンチ${index + 1}）`;
  }
  return null;
}

const KNOWN_OPTION_KEYS = new Set(["id", "processability", "value", "card", "card_id", "placement", "eligible", "convention"]);

/** 選択肢の表示名（表示だけ。送るのは id）。 */
export function optionLabel(option: InputOption, stage: OptionStage, observation: Observation | null, names: Names): string {
  if (typeof option.card_id === "string") {
    const name = names(option.card_id);
    return `${name ?? "（カード名表にない）"} ${option.card_id}`;
  }
  const v = option.value;
  if (stage.meaning === "pokemon" && typeof v === "number") return pokemonPlace(observation, v) ?? `ポケモン番号 ${v}`;
  if (stage.meaning === "position" && typeof v === "number") return `位置 ${v + 1}（値 ${v}）`;
  for (const key of ["name", "color", "hand", "attack_name"]) {
    if (typeof option[key] === "string") return `${option[key] as string}（値 ${String(v)}）`;
  }
  return `値 ${String(v)}`;
}

function optionExtras(option: InputOption): string[] {
  return Object.entries(option)
    .filter(([k]) => !KNOWN_OPTION_KEYS.has(k))
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
}

function stageOptions(stage: OptionStage, stages: InputStage[]): InputOption[] {
  if (stage.options) return stage.options;
  const from = stages.find((s) => s.stage === stage.options_from_stage);
  return from && from.input === "choose_option" && from.options ? from.options : [];
}

export function optionUnavailable(option: InputOption): string | null {
  if (option.eligible === false) return PLACEMENT_TEXT[option.placement ?? ""] || "この選択肢は送れません。";
  if (!EXECUTABLE_PROCESSABILITY.has(option.processability)) {
    return PROCESSABILITY_TEXT[option.processability]?.description ?? "この選択肢は今は処理できません。";
  }
  return null;
}

export function DecisionPanel({ selection, observation, names, busy, blocked, onCheck, onSubmit, onCancel }: Props) {
  const { candidate, inputs } = selection;
  const stages = useMemo(() => {
    if (!inputs || !("stages" in inputs.response)) return [];
    return inputs.response.stages;
  }, [inputs]);
  const [picks, setPicks] = useState<Record<number, string[]>>({});
  const [values, setValues] = useState<Record<number, string>>({});
  const headingId = useId();

  if (!inputs) {
    return (
      <section className="panel decision" aria-labelledby={headingId} aria-busy="true">
        <h3 id={headingId}>{labelOf(KIND_LABELS, candidate.kind)}</h3>
        <p>入力を取得しています…</p>
      </section>
    );
  }

  const body = inputs.response;
  if ("refusal" in body) {
    return (
      <section className="panel decision" aria-labelledby={headingId}>
        <h3 id={headingId}>{labelOf(KIND_LABELS, candidate.kind)}</h3>
        <p role="alert">
          入力を取得できませんでした: <code>{body.refusal.code}</code> {body.refusal.message}
        </p>
        <button type="button" onClick={onCancel}>閉じる</button>
      </section>
    );
  }

  const pickedElsewhere = (stageNo: number) =>
    new Set(
      Object.entries(picks)
        .filter(([k]) => Number(k) !== stageNo)
        .flatMap(([, v]) => v),
    );

  const satisfied = stages.every((stage) => {
    if (stage.input === "choose_option") {
      const n = (picks[stage.stage] ?? []).length;
      return n >= stage.count.min && n <= stage.count.max;
    }
    const raw = values[stage.stage];
    if (raw === undefined || raw === "") return false;
    const v = Number(raw);
    return Number.isInteger(v) && v >= stage.range.min && v <= stage.range.max;
  });

  const choices: Choice[] = stages.flatMap((stage): Choice[] =>
    stage.input === "choose_option" ? (picks[stage.stage] ?? []) : values[stage.stage] !== undefined ? [Number(values[stage.stage])] : [],
  );

  const toggle = (stage: OptionStage, id: string) => {
    setPicks((p) => {
      const list = p[stage.stage] ?? [];
      let next: string[];
      if (stage.count.max === 1) next = list[0] === id ? [] : [id];
      else next = list.includes(id) ? list.filter((x) => x !== id) : list.length < stage.count.max ? [...list, id] : list;
      const updated = { ...p, [stage.stage]: next };
      // 段をまたいで重ならない（distinct_across_stages）: 前の段で選んだものを後の段から外す
      for (const other of stages) {
        if (other.stage !== stage.stage && other.input === "choose_option" && other.distinct_across_stages && updated[other.stage]) {
          updated[other.stage] = (updated[other.stage] ?? []).filter((x) => !next.includes(x));
        }
      }
      return updated;
    });
  };

  const move = (stageNo: number, index: number, delta: number) => {
    setPicks((p) => {
      const list = [...(p[stageNo] ?? [])];
      const target = index + delta;
      if (target < 0 || target >= list.length) return p;
      [list[index], list[target]] = [list[target] as string, list[index] as string];
      return { ...p, [stageNo]: list };
    });
  };

  const withheld = body.withheld;
  const canSend = !withheld && satisfied && !busy && !blocked && EXECUTABLE_PROCESSABILITY.has(candidate.processability);

  return (
    <section className="panel decision" aria-labelledby={headingId}>
      <h3 id={headingId}>
        入力: {labelOf(KIND_LABELS, candidate.kind)} <code className="muted">{candidate.kind}</code>
      </h3>
      <div className="badges">
        <ProcessabilityBadge value={candidate.processability} withDescription />
        <DisclosureBadge value={candidate.input_disclosure} />
      </div>
      {candidate.choices_format ? <p className="muted small">送る形: {candidate.choices_format}</p> : null}

      {withheld ? (
        <div className="callout warn" role="status">
          <strong>入力非公開</strong>（input_disclosure）: エンジンが入力の情報境界を確かめていないため、選べるもの・数・並びを表示しません。
          <br />
          <code>{withheld.code}</code> {withheld.message}
        </div>
      ) : null}

      {!withheld && stages.length === 0 ? <p>この操作に入力はありません。</p> : null}

      {stages.map((stage) =>
        stage.input === "choose_option" ? (
          <OptionStageInput
            key={stage.stage}
            stage={stage}
            options={stageOptions(stage, stages)}
            picked={picks[stage.stage] ?? []}
            elsewhere={stage.distinct_across_stages ? pickedElsewhere(stage.stage) : new Set()}
            observation={observation}
            names={names}
            onToggle={(id) => toggle(stage, id)}
            onMove={(i, d) => move(stage.stage, i, d)}
          />
        ) : (
          <fieldset key={stage.stage} className="stage">
            <legend>
              段 {stage.stage}: {labelOf(MEANING_LABELS, stage.meaning)}（{stage.range.min}〜{stage.range.max}
              {stage.range.unit ?? ""}）
            </legend>
            {stage.note ? <p className="small">{stage.note}</p> : null}
            {stage.remaining !== undefined ? <p className="small">残りの回数: {stage.remaining}</p> : null}
            {stage.decline ? <p className="small">辞退できます（{stage.range.min} を選べます）。</p> : null}
            <ValueInput stage={stage} value={values[stage.stage] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [stage.stage]: v }))} />
          </fieldset>
        ),
      )}

      {selection.check ? (
        <p role="status" className={selection.check.valid ? "ok" : "warn"}>
          入力の検査:{" "}
          {selection.check.valid
            ? "制約に合っています（受理の保証ではありません。最終の判定はエンジン）"
            : `制約に合いません ${selection.check.refusal?.code ?? ""} ${selection.check.refusal?.message ?? ""}`}
        </p>
      ) : null}

      {!withheld && !satisfied ? <p className="small muted">選ぶ数・値の制約を満たすと送れます。</p> : null}
      {!EXECUTABLE_PROCESSABILITY.has(candidate.processability) ? (
        <p className="small warn">この候補は処理可能性の区分により送れません（ゲーム上の禁止ではありません）。</p>
      ) : null}

      <div className="actions">
        {!withheld ? (
          <button type="button" onClick={() => onCheck(choices)} disabled={busy || blocked}>
            入力を検査
          </button>
        ) : null}
        <button type="button" className="primary" onClick={() => onSubmit(choices)} disabled={!canSend}>
          {busy ? "送信中…" : "送信"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          やめる
        </button>
      </div>
      {!withheld && choices.length > 0 ? (
        <p className="small muted">
          送る値: <code>{JSON.stringify(choices)}</code>
        </p>
      ) : null}
    </section>
  );
}

function OptionStageInput({
  stage,
  options,
  picked,
  elsewhere,
  observation,
  names,
  onToggle,
  onMove,
}: {
  stage: OptionStage;
  options: InputOption[];
  picked: string[];
  elsewhere: Set<string>;
  observation: Observation | null;
  names: Names;
  onToggle(id: string): void;
  onMove(index: number, delta: number): void;
}) {
  const single = stage.count.max === 1;
  const name = useId();
  const byId = new Map(options.map((o) => [o.id, o]));
  const orderText = ORDER_TEXT[stage.order] ?? `順序: ${stage.order}`;
  return (
    <fieldset className="stage">
      <legend>
        段 {stage.stage}
        {stage.role ? `: ${ROLE_LABELS[stage.role] ?? stage.role}` : ""}
        {stage.decision_kind ? ` （決定 ${stage.decision_kind}）` : ""}・選ぶ数 {stage.count.min}〜{stage.count.max}
      </legend>
      {stage.note ? <p className="small">{stage.note}</p> : null}
      {stage.decline ? <p className="small">辞退できます（何も選ばずに送れます）。</p> : null}
      {orderText && stage.count.max > 1 ? <p className="small">{orderText}</p> : null}
      {options.length === 0 ? (
        <p className="callout info">
          選べるものがありません（エンジンの応答のまま表示しています）。
          {stage.count.min === 0 ? " 0 個のまま送れます。" : " 最小数を満たせないため送れません。"}
        </p>
      ) : null}
      <ul className="options" role="list">
        {single && stage.count.min === 0 ? (
          <li>
            <label className="option">
              <input type="radio" name={name} checked={picked.length === 0} onChange={() => picked[0] && onToggle(picked[0])} />
              <span>選ばない</span>
            </label>
          </li>
        ) : null}
        {options.map((option) => {
          const unavailable = optionUnavailable(option);
          const taken = elsewhere.has(option.id);
          const checked = picked.includes(option.id);
          const full = !single && !checked && picked.length >= stage.count.max;
          const extras = optionExtras(option);
          return (
            <li key={option.id} className={checked ? "selected" : undefined}>
              <label className={`option${unavailable || taken ? " disabled" : ""}`}>
                <input
                  type={single ? "radio" : "checkbox"}
                  name={name}
                  checked={checked}
                  disabled={Boolean(unavailable) || taken || full}
                  onChange={() => onToggle(option.id)}
                />
                <span className="option-text">
                  <span>{optionLabel(option, stage, observation, names)}</span>
                  <code className="muted small">{option.id}</code>
                  {typeof option.card === "number" ? <code className="muted small">#{option.card}</code> : null}
                  {checked && !single ? <span className="order-no">{picked.indexOf(option.id) + 1}番目</span> : null}
                </span>
              </label>
              <span className="option-meta">
                <ProcessabilityBadge value={option.processability} />
                {option.placement && option.placement !== "eligible" ? <code className="small">placement: {option.placement}</code> : null}
                {option.convention ? <code className="small">規約 {option.convention}</code> : null}
                {extras.length ? <span className="small muted">{extras.join("・")}</span> : null}
              </span>
              {unavailable ? <span className="small warn">{unavailable}</span> : null}
              {taken ? <span className="small muted">ほかの段で選択済み</span> : null}
            </li>
          );
        })}
      </ul>
      {!single && picked.length > 0 ? (
        <div className="picked">
          <p className="small">選んだ順（送る順）:</p>
          <ol>
            {picked.map((id, i) => {
              const option = byId.get(id);
              return (
                <li key={id}>
                  <span>{option ? optionLabel(option, stage, observation, names) : id}</span> <code className="small muted">{id}</code>
                  <span className="row-actions">
                    <button type="button" aria-label={`${id} を前へ`} onClick={() => onMove(i, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button type="button" aria-label={`${id} を後へ`} onClick={() => onMove(i, 1)} disabled={i === picked.length - 1}>
                      ↓
                    </button>
                    <button type="button" aria-label={`${id} を外す`} onClick={() => onToggle(id)}>
                      外す
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </fieldset>
  );
}

function ValueInput({ stage, value, onChange }: { stage: Extract<InputStage, { input: "choose_value" }>; value: string; onChange(v: string): void }) {
  const id = useId();
  const { min, max } = stage.range;
  if (stage.meaning === "player" && min === 0 && max === 1) {
    return (
      <div className="radio-row" role="radiogroup" aria-label="プレイヤー">
        {[0, 1].map((p) => (
          <label key={p} className="option">
            <input type="radio" name={id} checked={value === String(p)} onChange={() => onChange(String(p))} />
            <span>{playerLabel(p as 0 | 1)}</span>
          </label>
        ))}
      </div>
    );
  }
  if (max - min <= 30) {
    return (
      <label className="field" htmlFor={id}>
        <span>値</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">選んでください</option>
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((v) => (
            <option key={v} value={String(v)}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="field" htmlFor={id}>
      <span>値（{min}〜{max}）</span>
      <input id={id} type="number" min={min} max={max} step={1} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
