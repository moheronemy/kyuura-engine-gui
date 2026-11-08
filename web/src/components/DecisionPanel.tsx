// 決定・操作の入力の画面。候補の入力の段（inputs の stages）と入力の制約だけから組み立てる。
// - 選択肢の ID（o1, o2, …）・値をそのまま送る。カード名などから uid・コマンドを推測しない
// - 選んだ順を保つ（並べ替えない）。順序が未確認でも入力順のまま送る
// - 0 枚の回答・辞退・空の選択肢も表示し、GUI が独自に決定を飛ばさない（送るのは利用者の操作だけ）
// - 制約の表示と送信ボタンの可否は、エンジンが返した count・range を読むだけ（合法性の最終の判定はエンジン）
// - 選択肢に本人へ公開された card_id があるときだけ、そのカードの画像を選択肢のラベルの中に出す。画像を押しても
//   同じ選択肢の入力（radio・checkbox）を選ぶだけで、画像・カード名から送る値やコマンドを決めない
// U7-3:
// - 2 段の操作（depends_on_stage）: 2 段目は、1 段目で選んだ番号の options_by_choice の組だけを、組ごとの eligible・
//   processability で選べるようにする。1 段目を変えたら 2 段目の選択を捨てる
// - 個数で数える段（total_units。にげる）: カードの枚数（count）と出すエネルギーの個数（units の合計）を分けて表示する。
//   個数が範囲に入っていても合法とは書かない。送る前に check の答え（今の入力・今の取っ手への答え）を必須にする
// - check の答えは、今の入力と同じ入力への答えだけを表示・送信の条件に使う（入力を変えたら前の答えは使わない）
// U7-4（ワザの宣言。段の role で組み立てる。カード名・ワザの名前で分けない）:
// - 1 段目（role: attack）: エンジンが返したワザの名前・必要なエネルギー・印刷のダメージの表示・説明・持ち方（route・provider・payer・
//   grantors）を表示する。印刷のダメージは与えるダメージの予測ではない（弱点・抵抗力・効果を GUI で計算しない）
// - 2 段目（role: declaration_options）: 1 段目のワザの options_by_choice の組だけ。0 個でよく、選んだ順のまま送る。重なり・併用の可否は
//   GUI で決めず、エンジンの check が確かめる。ワザを変えたら 2 段目の選択を捨てる（check の答えも今の入力と違うので使わない）
// - 対象・トラッシュ・山札から選ぶカード・写すワザ・コインの結果は、ここで聞かない（受理のあとのエンジンの決定で答える）
// - 送る前に、今の入力・今の取っ手への check が通っていることを必須にする（check_before_submit_kinds。受理の保証ではない）
// U7-5（1 段の操作。段の role・候補の stadium・選べるものの holder で組み立てる。カード名・画像で分けない）:
// - 場のポケモン 1 匹を指す操作（remove_disguise・discard_from_play・reveal_face_down）: 本人の場のポケモンを選ぶ。うらのポケモンは裏面で、
//   カード ID・名前を補わない。おもてにしたあと残るか・トラッシュするかを予告しない（結果は受理のあとの観測で表示する）
// - 手札のトレーナー（play_trainer）: 手札のカード 1 枚だけを選ぶ。対象・費用・検索・相手が答える決定（錯乱ジム・［ちえくらべ］）は受理のあとの決定
// - 場のスタジアム（use_stadium）: 候補の stadium（持ち主）と、使う主体（番のプレイヤー）を分けて示す。選ばせるもののない効果は choices []、
//   エネルギーを選ばせる効果はエネルギーカードとついているポケモン（holder）を示す。回数・使えるかは GUI で決めない（エンジンの候補と check）
import { useId, useMemo, useState } from "react";
// U7-5e（特殊能力。候補の pokemon・power と、0〜3 段の依存する段）:
// - 候補は id で区別する（同じ use_power がいくつも並ぶ）。特殊能力の名前・カード ID から入力の形を推測しない
// - k 段目は、直前の段で選んだ番号の options_by_choice の組だけ。k 段目を変えたら、それに依存する後のすべての段の選択を捨てる
//   （check の答えも今の入力と違うので使わない）。全段の組み合わせを GUI で作らない
// - 相手のうらのカードは、エンジンが示した位置と face_down だけ（カード ID・名前・表の画像を補わない）
// U7-5f・g（v0.172）:
// - 表示だけの種類（check_face_up_deck）: エンジンが返した owner・position だけを表示し、check・submit を呼ばない（未裁定。ゲーム上の禁止ではない）
// - attach_energy の任意の 3 段目（energy2。カツラの 2 枚目）: 1・2 段目の今の選択の鍵（"o1/o8"）の options_by_path の一覧だけ。1 段目・2 段目を変えたら
//   3 段目の選択と検査の結果を捨てる。選ばなければ今までどおり 1 枚。カツラの許可・炎・付け先・回数・レインボーは GUI で判定しない
// - attach_energy は 1 枚・2 枚とも、今の取っ手・今の候補・今の入力への check が通ってから送る（GUI の方針。エンジンは check なしの submit も受け付ける）。
//   3 段目の 2 枚目を選ぶ・変える・外すのも入力の変更で、前の check の答えを使わない
// - 本人のうらのカードの特殊能力: 本人が知る本当のカード（power.card_id）を、公開の盤面の情報と分けて文字で示す（盤面は裏面のまま）
import { ATTACK_KINDS, DISPLAY_ONLY_KINDS, EXECUTABLE_PROCESSABILITY, PATH_STAGE_KINDS, POWER_KINDS, STADIUM_KINDS, TRAINER_KINDS } from "../api/contract";
import type { Candidate, Choice, FieldSlot, Holder, InputOption, InputStage, Observation, OptionStage, PairOption, PlayerIndex, StadiumRef } from "../api/types";
import { CardBack, CardFace, usePowerText } from "../cards/CardImages";
import { currentCheck, needsCheckBeforeSubmit } from "../state/checkGate";
import type { Selection } from "../state/useEndpointSession";
import {
  ADDON_LABELS,
  DECISION_TEXT,
  ENERGY_LABELS,
  KIND_LABELS,
  ORDER_TEXT,
  PLACEMENT_TEXT,
  PROCESSABILITY_TEXT,
  REFUSAL_TEXT,
  ROUTE_LABELS,
  labelOf,
  playerLabel,
  reasonsText,
  roleLabel,
} from "../labels";
import { DisclosureBadge, ProcessabilityBadge } from "./Badges";

type Names = (cardId: string) => string | undefined;

interface Props {
  selection: Selection;
  /** 送る主体（場のスタジアムの持ち主と分けて書く）。 */
  actor?: PlayerIndex | "host" | null;
  observation: Observation | null;
  names: Names;
  busy: boolean;
  blocked: boolean;
  onCheck(choices: Choice[]): void;
  onSubmit(choices: Choice[]): void;
  onCancel(): void;
  /** 入力（選択・値）が変わったとき。前の check の答えと、届いていない check の答えを捨てる（今の入力への答えだけを使う）。 */
  onInputChange?(): void;
}

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

const KNOWN_OPTION_KEYS = new Set([
  "id",
  "processability",
  "value",
  "card",
  "card_id",
  "placement",
  "eligible",
  "convention",
  "reasons",
  "special",
  "units",
  "pokemon",
  "zone",
  "bench_index",
  "face_down",
  // U7-4（ワザ・宣言といっしょに選ぶもの。専用の表示で示す）
  "attack_index",
  "route",
  "provider",
  "payer",
  "grantors",
  "name_ja",
  "cost",
  "damage",
  "text_ja",
  "addon",
  "power",
  // U7-5d（スタジアムで選ぶエネルギーがついているポケモン。専用の表示で示す）
  "holder",
  // U7-5e（依存する段の前の段の番号。表示しない）
  "after",
  // U7-5f（表示だけの山札の位置。専用の表示で示す）
  "owner",
  "position",
]);

/** 場のポケモンの番号の持ち主（観測のバトル場・ベンチ。うらのカードも番号は公開）。 */
function ownerOf(observation: Observation | null, pokemonId: number): PlayerIndex | null {
  if (!observation) return null;
  for (const p of observation.players) {
    const slots = [p.active, ...p.bench];
    if (slots.some((slot) => slot != null && (slot as { pokemon_id?: number }).pokemon_id === pokemonId)) return p.player;
  }
  return null;
}

/** 選べるものの場のポケモンが、閲覧者の側か相手の側か（観測の番号から。分からなければ空）。 */
function sideOf(observation: Observation | null, option: InputOption): string {
  if (typeof option.pokemon !== "number" || !observation || observation.viewer == null) return "";
  const owner = ownerOf(observation, option.pokemon);
  if (owner === null) return "";
  return owner === observation.viewer ? "自分の" : "相手の";
}

function zonePlace(option: InputOption): string | null {
  if (option.zone === "active") return "バトル場";
  if (option.zone === "bench") return `ベンチ${(option.bench_index ?? 0) + 1}`;
  return null;
}

/** 選択肢の表示名（表示だけ。送るのは id）。 */
export function optionLabel(option: InputOption, stage: OptionStage, observation: Observation | null, names: Names): string {
  const place = zonePlace(option);
  if (typeof option.attack_index === "number" && typeof option.name_ja === "string") return `［${option.name_ja}］`; // U7-4: エンジンが返したワザの名前
  if (typeof option.addon === "string") return addonLabel(option, observation, names);
  if (option.face_down) return `${sideOf(observation, option)}裏向きのポケモン${place ? `（${place}）` : ""}`; // うらのカード: カード ID は来ない
  if (option.holder && typeof option.card_id === "string") {
    // U7-5d: エネルギーカード（ついているカードは公開）と、ついている本人の場のポケモン（エンジンが返した holder）
    return `${names(option.card_id) ?? "（カード名表にない）"} ${option.card_id}（ついている: ${holderLabel(option.holder, names)}）`;
  }
  if (typeof option.card_id === "string") {
    const name = names(option.card_id);
    const side = place ? sideOf(observation, option) : "";
    return `${name ?? "（カード名表にない）"} ${option.card_id}${place ? `（${side}${place}）` : ""}`;
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

/** U7-5d: エネルギーがついている本人の場のポケモン（うらのポケモンはカード ID・名前を補わない）。 */
export function holderLabel(holder: Holder, names: Names): string {
  const place = holder.zone === "active" ? "バトル場" : `ベンチ${(holder.bench_index ?? 0) + 1}`;
  if (holder.face_down || typeof holder.card_id !== "string") return `裏向きのポケモン（${place}）`;
  return `${names(holder.card_id) ?? holder.card_id}（${place}）`;
}

/** U7-5d: 場のスタジアム（候補の stadium。持ち主）と、使う主体（番のプレイヤー）。回数・使えるかは示さない（エンジンが候補と check で決める）。 */
function StadiumInfo({ stadium, actor, names }: { stadium: StadiumRef; actor: PlayerIndex | "host" | null; names: Names }) {
  const owner = actor === stadium.owner ? `あなた（${playerLabel(stadium.owner)}）` : playerLabel(stadium.owner);
  return (
    <div className="stadium-info" aria-label="場のスタジアム">
      <CardFace cardId={stadium.card_id} name={names(stadium.card_id) ?? stadium.card_id} size="s" decorative />
      <p className="small">
        場のスタジアム: <strong>{names(stadium.card_id) ?? stadium.card_id}</strong> <code className="muted">{stadium.card_id}</code>
        <br />
        持ち主（出したプレイヤー）: {owner} ／ 使うのは: 番のプレイヤー{actor === 0 || actor === 1 ? `（あなた・${playerLabel(actor)}）` : ""}
        <br />
        <span className="muted">持ち主でなくても、番のプレイヤーが使えます。回数・使えるかはエンジンが決めます（GUI は数えません）。</span>
      </p>
    </div>
  );
}

/** U7-5e: 特殊能力を使うポケモンと特殊能力（候補の pokemon・power）。説明は公開カード定義の印刷（位置と名前が合うときだけ）。 */
function PowerInfo({ candidate, names }: { candidate: Candidate; names: Names }) {
  const { pokemon, power } = candidate;
  const text = usePowerText(power?.card_id ?? "", power?.index ?? -1, power?.name_ja ?? "");
  if (!pokemon || !power) return null;
  const place = pokemon.zone === "active" ? "バトル場" : `ベンチ${(pokemon.bench_index ?? 0) + 1}`;
  if (power.face_down || pokemon.face_down || typeof pokemon.card_id !== "string") {
    // v0.172（U7-5g-2）: 本人のうらのカード。盤面の情報（公開）は「裏向きのポケモン・場所」だけ。本当のカードは本人の候補にだけ来た本人の知識（相手・観戦者には出ない）
    return (
      <div className="power-info face-down-power" aria-label="特殊能力">
        <p className="small">
          特殊能力: <strong>［{power.name_ja}］</strong> ／ 使うポケモン: 自分の裏向きのポケモン（{place}。盤面ではうらのまま）
          <br />
          あなただけが知る本当のカード（印刷の情報）: {names(power.card_id) ?? power.card_id} <code className="muted">{power.card_id}</code>（相手・観戦者には見えません）
        </p>
        <p className="small attack-text">{text ?? "説明なし（公開カード定義に合う説明がない）"}</p>
        <p className="small warn">
          送ると、エンジンがこのカードをおもてにしてから決めます（受理・拒否・トラッシュ）。「未確認」は使える・受理されるという意味ではありません。拒否なら状態はもどり、おもてにしたことも相手・観戦者に知らされません。
        </p>
      </div>
    );
  }
  return (
    <div className="power-info" aria-label="特殊能力">
      <p className="small">
        特殊能力: <strong>［{power.name_ja}］</strong> ／ 使うポケモン: {names(pokemon.card_id) ?? pokemon.card_id} <code className="muted">{pokemon.card_id}</code>（自分の{place}）
        {power.card_id !== pokemon.card_id ? (
          <>
            <br />
            印刷したカード: {names(power.card_id) ?? power.card_id} <code className="muted">{power.card_id}</code>（場のポケモンのカードと違う。「ばける」・写した特殊能力など）
          </>
        ) : null}
      </p>
      <p className="small attack-text">{text ?? "説明なし（公開カード定義に合う説明がない）"}</p>
    </div>
  );
}

/** U7-5: 種類ごとの説明（入力の画面は段の role で同じ部品を使う。ここは何を聞かないかと、受理のあとの続きの説明だけ）。 */
function kindNote(kind: string, noStages: boolean, hasPathStage = false): string | null {
  if (TRAINER_KINDS.has(kind)) {
    return "ここで選ぶのは手札のトレーナーカード 1 枚だけです。対象・枚数・費用・山札から選ぶカード・相手が答える決定（錯乱ジム・［ちえくらべ］など）は、受理のあとにエンジンが決定として聞きます。コインはエンジンが投げます（結果は入力しません）。どうぐ・手札から出すスタジアム・化石・人形もこの操作です（場のスタジアムの効果は「場のスタジアムを使う」）。";
  }
  if (STADIUM_KINDS.has(kind)) {
    return noStages
      ? "場のスタジアムの効果を使います（手札から出すのは「手札のトレーナーを使う」）。この効果に選ぶものはありません（choices: [] で送ります）。コイン・効果の決定は受理のあとにエンジンが行います。"
      : "場のスタジアムの効果を使います（手札から出すのは「手札のトレーナーを使う」）。選べるのはエンジンが示したエネルギーカードだけです。コイン・効果の決定は受理のあとにエンジンが行います。";
  }
  if (POWER_KINDS.has(kind)) {
    return noStages
      ? "この特殊能力に宣言といっしょに選ぶものはありません（choices: [] で送ります）。コインの結果・効果の決定（回復するポケモン・トラッシュするカードなど）は、受理のあとにエンジンが聞きます。回数・使えるかはエンジンが決めます（GUI は数えません）。"
      : "宣言といっしょに選ぶものを段の順に 1 つずつ選びます。後の段には、前の段で選んだものに続く選べるものだけが出ます。前の段を変えると、後の段の選択と検査の結果は捨てます。コインの結果・効果の決定は、受理のあとにエンジンが聞きます。";
  }
  if (kind === "attach_energy" && hasPathStage) {
    return "この番はカツラの効果で、3 段目に 2 枚目のエネルギーカードを選べます（任意。選ばなければ今までどおり 1 枚）。3 段目に出るのは、1・2 段目の今の選択の組でエンジンが示したカードだけです。1 段目か 2 段目を変えると、3 段目の選択と検査の結果を捨てます。2 枚つけられるか（カツラのポケモン・炎・回数など）は GUI では決めず、エンジンが組と送信で決めます。";
  }
  if (kind === "reveal_face_down") {
    return "おもてにしたあと場に残るか・トラッシュするかは、エンジンが本当のカードで決めます（ここでは予告しません）。結果は受理のあとの観測で表示します。バトル場が空けば、バトル場に出すポケモンを選ぶ決定に続きます。";
  }
  if (kind === "discard_from_play") {
    return "ついているカードもいっしょにトラッシュします（きぜつではありません）。バトル場が空けば、バトル場に出すポケモンを選ぶ決定に続きます。";
  }
  if (kind === "remove_disguise") {
    return "のせたカードを持ち主のトラッシュに置き、元の姿にもどします。元の姿の最大HPの確かめなどで、エンジンが受け付けないことがあります（送るまで分かりません）。";
  }
  return null;
}

/** U7-4: 宣言といっしょに選ぶものの表示名（addon の種類と、エンジンが返した場所・名前だけ）。 */
export function addonLabel(option: InputOption, observation: Observation | null, names: Names): string {
  const kind = labelOf(ADDON_LABELS, option.addon);
  if (option.addon === "stadium_coin" && typeof option.card_id === "string") return `${kind}（${names(option.card_id) ?? option.card_id}）`;
  const where = typeof option.pokemon === "number" ? (pokemonPlace(observation, option.pokemon) ?? `ポケモン番号 ${option.pokemon}`) : null;
  if (option.addon === "with_power" && typeof option.power === "string") return `［${option.power}］ — ${kind}${where ? `（${where}）` : ""}`;
  return `${kind}${where ? `（${where}）` : ""}`;
}

/** U7-4: 必要なエネルギー（cost の値ごとの個数。印刷の値）。 */
export function costText(cost: readonly string[]): string {
  if (cost.length === 0) return "なし（0 個）";
  const counts = new Map<string, number>();
  for (const c of cost) counts.set(c, (counts.get(c) ?? 0) + 1);
  return `${[...counts].map(([c, n]) => `${labelOf(ENERGY_LABELS, c)} ${n} 個`).join("・")}（計 ${cost.length} 個）`;
}

function pokemonRef(observation: Observation | null, id: number): string {
  return pokemonPlace(observation, id) ?? `ポケモン番号 ${id}`;
}

/** U7-4: ワザの選べるものの中身（印刷の情報と、エンジンが返した持ち方）。表示だけで、送る値は id。 */
function AttackDetails({ option, observation }: { option: InputOption; observation: Observation | null }) {
  return (
    <span className="attack-details">
      <span className="small">必要なエネルギー: {costText(option.cost ?? [])}</span>
      <span className="small">
        ダメージの表示（印刷）: {option.damage ? <strong>{option.damage}</strong> : "なし"}
        <span className="muted">（印刷のままの表示です。弱点・抵抗力・効果を含めた与えるダメージではありません）</span>
      </span>
      <span className="small attack-text">{option.text_ja ?? "説明なし"}</span>
      {option.face_down ? (
        <span className="small">あなたのうらのバトル場のポケモン（本人だけが知るカード）のワザです。エンジンがおもてにしてから確かめます。</span>
      ) : (
        <span className="small">
          出どころ: {labelOf(ROUTE_LABELS, option.route)} <code className="muted">route: {option.route}</code>
        </span>
      )}
      {option.provider !== undefined ? <span className="small">ワザを持つポケモン: {pokemonRef(observation, option.provider)}</span> : null}
      {option.payer !== undefined ? <span className="small">エネルギーを払うポケモン: {pokemonRef(observation, option.payer)}</span> : null}
      {option.grantors?.length ? (
        <span className="small">許可を与えるポケモン: {option.grantors.map((g) => pokemonRef(observation, g)).join("・")}</span>
      ) : null}
    </span>
  );
}

export function optionUnavailable(option: InputOption): string | null {
  if (option.eligible === false && option.placement) return PLACEMENT_TEXT[option.placement] || "この選択肢は送れません。";
  if (!EXECUTABLE_PROCESSABILITY.has(option.processability)) {
    return PROCESSABILITY_TEXT[option.processability]?.description ?? "この選択肢は今は処理できません。";
  }
  if (option.eligible === false) return "この選択肢は送れません（エンジンの候補の区分）。";
  return null;
}

/**
 * 段の今の選べるもの。
 * - options_from_stage: 指す段の選択肢
 * - depends_on_stage: 指す段（1 段目）で選んだ番号の options_by_choice の組だけ。組ごとの eligible・processability・reasons を使う
 * 2 つめの値は、依存の段で 1 段目がまだ選ばれていないとき true。
 */
export function stageOptions(stage: OptionStage, stages: InputStage[], picks: Record<number, string[]>): [InputOption[], boolean] {
  if (stage.path_stages !== undefined) {
    // U7-5g-1: path_stages の段の今の選択を段の順に / でつないだ鍵の一覧だけ（鍵がない組では選べない。全部の組み合わせを GUI で作らない）
    const parts = stage.path_stages.map((n) => (picks[n] ?? [])[0]);
    if (parts.some((p) => p === undefined)) return [[], true];
    return [merge(stage, stage.options_by_path?.[parts.join("/")] ?? []), false];
  }
  if (stage.depends_on_stage !== undefined) {
    const chosen = (picks[stage.depends_on_stage] ?? [])[0];
    if (chosen === undefined) return [[], true];
    return [merge(stage, stage.options_by_choice?.[chosen] ?? []), false];
  }
  if (stage.options) return [stage.options, false];
  const from = stages.find((s) => s.stage === stage.options_from_stage);
  return [from && from.input === "choose_option" && from.options ? from.options : [], false];
}

/** 組の参照（option・eligible・processability・reasons）を段の選べるものに重ねる（組ごとの可否を使う）。 */
function merge(stage: OptionStage, pairs: PairOption[]): InputOption[] {
  const byId = new Map((stage.options ?? []).map((o) => [o.id, o]));
  const out: InputOption[] = [];
  for (const pair of pairs) {
    const base = byId.get(pair.option);
    if (!base) continue; // 検証済み（validate.ts）なので来ない
    const merged: InputOption = { ...base, eligible: pair.eligible, processability: pair.processability };
    if (pair.reasons) merged.reasons = pair.reasons;
    else delete merged.reasons;
    out.push(merged);
  }
  return out;
}

/** 段が直接に頼る前の段（depends_on_stage か path_stages）。 */
function upstreamOf(stage: InputStage): number[] {
  if (stage.input !== "choose_option") return [];
  if (stage.path_stages !== undefined) return stage.path_stages;
  return stage.depends_on_stage === undefined ? [] : [stage.depends_on_stage];
}

/** stageNo に直接・間接に依存する段の番号（depends_on_stage・path_stages をたどる）。 */
export function downstreamOf(stages: InputStage[], stageNo: number): Set<number> {
  const out = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of stages) {
      const ups = upstreamOf(s);
      if (ups.length === 0 || out.has(s.stage)) continue;
      if (ups.some((n) => n === stageNo || out.has(n))) {
        out.add(s.stage);
        grew = true;
      }
    }
  }
  return out;
}

/** 個数で数える段の、選んだカードの units の合計。 */
export function unitsOf(stage: OptionStage, picked: string[]): number {
  const byId = new Map((stage.options ?? []).map((o) => [o.id, o]));
  return picked.reduce((sum, id) => sum + (byId.get(id)?.units ?? 0), 0);
}

export function DecisionPanel({ selection, actor = null, observation, names, busy, blocked, onCheck, onSubmit, onCancel, onInputChange }: Props) {
  const { candidate, inputs } = selection;
  const stages = useMemo(() => {
    if (!inputs || !("stages" in inputs.response)) return [];
    return inputs.response.stages;
  }, [inputs]);
  const [picks, setPicks] = useState<Record<number, string[]>>({});
  const [values, setValues] = useState<Record<number, string>>({});
  // 入力を変えて前の check の答えを捨てたか（捨てたことを表示する。答えそのものは session が捨てる）
  const [discarded, setDiscarded] = useState(false);
  const headingId = useId();
  const changed = () => {
    if (selection.check !== null) setDiscarded(true);
    onInputChange?.();
  };

  if (!inputs) {
    return (
      <section className="panel decision" aria-labelledby={headingId} aria-busy="true">
        <h3 id={headingId}>{labelOf(KIND_LABELS, candidate.kind)}</h3>
        <p>入力を取得しています…</p>
      </section>
    );
  }

  const body = inputs.response;
  if (!("refusal" in body) && DISPLAY_ONLY_KINDS.has(candidate.kind)) {
    // U7-5f: 表示だけの候補。check・submit のボタンを出さない（未裁定で送れない）
    return <DisplayOnlyInputs candidate={candidate} stages={stages} actor={actor} headingId={headingId} onCancel={onCancel} />;
  }
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
    changed(); // 入力が変わる: 前の check の答えと、届いていない答えを使わない（更新関数の外で知らせる）
    setPicks((p) => {
      const list = p[stage.stage] ?? [];
      let next: string[];
      if (stage.count.max === 1) next = list[0] === id ? [] : [id];
      else next = list.includes(id) ? list.filter((x) => x !== id) : list.length < stage.count.max ? [...list, id] : list;
      const updated = { ...p, [stage.stage]: next };
      const changed = (list[0] ?? null) !== (next[0] ?? null);
      const dependents = changed ? downstreamOf(stages, stage.stage) : new Set<number>();
      for (const other of stages) {
        if (other.stage === stage.stage || other.input !== "choose_option") continue;
        // 段をまたいで重ならない（distinct_across_stages）: 前の段で選んだものを後の段から外す
        if (other.distinct_across_stages && updated[other.stage]) {
          updated[other.stage] = (updated[other.stage] ?? []).filter((x) => !next.includes(x));
        }
        // 依存する段: 前の段を変えたら、それに（直接・間接に）依存するすべての段の選択を捨てる（組・番号が変わる。U7-5e の 3 段・U7-5g の energy2 を含む）
        if (dependents.has(other.stage)) updated[other.stage] = [];
      }
      return updated;
    });
  };

  const move = (stageNo: number, index: number, delta: number) => {
    changed();
    setPicks((p) => {
      const list = [...(p[stageNo] ?? [])];
      const target = index + delta;
      if (target < 0 || target >= list.length) return p;
      [list[index], list[target]] = [list[target] as string, list[index] as string];
      return { ...p, [stageNo]: list };
    });
  };

  const withheld = body.withheld;
  // 今の入力への check の答え（入力が変わったら前の答えは使わない。取っ手が変われば選択ごと作り直される）
  const check = currentCheck(selection, choices);
  const staleCheck = (selection.check !== null && check === null) || (discarded && selection.check === null);
  // 個数で数える段がある操作（にげる）は、今の入力が check を通ってから送る（個数の表示だけで合法と決めない）
  // ワザ・U7-5 の操作・attach_energy（1 枚・2 枚とも。check_before_submit_kinds）も同じ（GUI の方針。check を通っても受理・完走の保証ではない）
  // 送信の入口（useEndpointSession の submit）も同じ関数（state/checkGate.ts）で確かめる
  const needsCheck = needsCheckBeforeSubmit(candidate, stages);
  const executable = EXECUTABLE_PROCESSABILITY.has(candidate.processability);
  const canSend = !withheld && satisfied && !busy && !blocked && executable && (!needsCheck || check?.valid === true);
  const hasPathStage = stages.some((s) => s.input === "choose_option" && s.path_stages !== undefined && PATH_STAGE_KINDS[candidate.kind] !== undefined);

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

      {candidate.stadium ? <StadiumInfo stadium={candidate.stadium} actor={actor} names={names} /> : null}
      {POWER_KINDS.has(candidate.kind) ? <PowerInfo candidate={candidate} names={names} /> : null}
      {!withheld && stages.length === 0 ? <p>この操作に入力はありません。</p> : null}
      {kindNote(candidate.kind, stages.length === 0, hasPathStage) ? <p className="small">{kindNote(candidate.kind, stages.length === 0, hasPathStage)}</p> : null}
      {ATTACK_KINDS.has(candidate.kind) ? (
        <p className="small">
          ここで選ぶのは、ワザと、宣言といっしょに選ぶもの（あれば）だけです。ワザの対象・トラッシュするエネルギー・山札から選ぶカード・写すワザは、受理のあとにエンジンが決定として聞きます。コインはエンジンが投げます（結果は入力しません）。
        </p>
      ) : null}

      {stages.map((stage) => {
        if (stage.input !== "choose_option") {
          return (
            <fieldset key={stage.stage} className="stage">
              <legend>
                段 {stage.stage}: {labelOf(MEANING_LABELS, stage.meaning)}（{stage.range.min}〜{stage.range.max}
                {stage.range.unit ?? ""}）
              </legend>
              {stage.note ? <p className="small">{stage.note}</p> : null}
              {stage.remaining !== undefined ? <p className="small">残りの回数: {stage.remaining}</p> : null}
              {stage.decline ? <p className="small">辞退できます（{stage.range.min} を選べます）。</p> : null}
              <ValueInput
                stage={stage}
                value={values[stage.stage] ?? ""}
                onChange={(v) => {
                  changed();
                  setValues((s) => ({ ...s, [stage.stage]: v }));
                }}
              />
            </fieldset>
          );
        }
        const [options, waiting] = stageOptions(stage, stages, picks);
        return (
          <OptionStageInput
            key={stage.stage}
            kind={candidate.kind}
            stage={stage}
            options={options}
            waitingFor={waiting ? (stage.path_stages ?? (stage.depends_on_stage === undefined ? [] : [stage.depends_on_stage])) : null}
            picked={picks[stage.stage] ?? []}
            elsewhere={stage.distinct_across_stages ? pickedElsewhere(stage.stage) : new Set()}
            observation={observation}
            names={names}
            onToggle={(id) => toggle(stage, id)}
            onMove={(i, d) => move(stage.stage, i, d)}
          />
        );
      })}

      {check ? (
        <p role="status" className={`check-result ${check.valid ? "ok" : "warn"}`}>
          入力の検査（今の入力）:{" "}
          {check.valid
            ? "エンジンの検査を通りました（受理・完走の保証ではありません。結果は送信の応答で決まります）"
            : `通りません ${check.refusal?.code ?? ""}${check.refusal ? `（${REFUSAL_TEXT[check.refusal.code] ?? check.refusal.message}）` : ""}`}
        </p>
      ) : null}
      {staleCheck ? <p className="small muted">入力を変えたので、前の検査の結果は使いません。</p> : null}

      {!withheld && !satisfied ? <p className="small muted">選ぶ数・値の制約を満たすと送れます。</p> : null}
      {!withheld && needsCheck && satisfied && check?.valid !== true ? (
        <p className="small">この操作は、送る前に「入力を検査」で今の入力をエンジンに確かめます。</p>
      ) : null}
      {!executable ? <p className="small warn">この候補は処理可能性の区分により送れません（ゲーム上の禁止ではありません）。</p> : null}

      <div className="actions">
        {!withheld ? (
          <button type="button" onClick={() => onCheck(choices)} disabled={busy || blocked}>
            入力を検査
          </button>
        ) : null}
        <button type="button" className="primary" onClick={() => canSend && onSubmit(choices)} disabled={!canSend}>
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
  kind,
  stage,
  options,
  waitingFor,
  picked,
  elsewhere,
  observation,
  names,
  onToggle,
  onMove,
}: {
  kind: string;
  stage: OptionStage;
  options: InputOption[];
  waitingFor: number[] | null;
  picked: string[];
  elsewhere: Set<string>;
  observation: Observation | null;
  names: Names;
  onToggle(id: string): void;
  onMove(index: number, delta: number): void;
}) {
  const single = stage.count.max === 1;
  const name = useId();
  const byId = new Map((stage.options ?? options).map((o) => [o.id, o]));
  const orderText = ORDER_TEXT[stage.order] ?? `順序: ${stage.order}`;
  const units = stage.total_units ? unitsOf(stage, picked) : null;
  // U7-4: 段の role で組み立てる（ワザの宣言の種類だけ。ほかの種類の同じ名前の role には使わない）
  const attackStage = ATTACK_KINDS.has(kind) && stage.role === "attack";
  const declaration = ATTACK_KINDS.has(kind) && stage.role === "declaration_options";
  const inUnits = stage.total_units && units !== null ? units >= stage.total_units.min && units <= stage.total_units.max : null;
  return (
    <fieldset className="stage">
      <legend>
        段 {stage.stage}
        {stage.role ? `: ${roleLabel(kind, stage.role)}` : ""}
        {stage.decision_kind ? ` （決定 ${stage.decision_kind}）` : ""}・選ぶ数 {stage.count.min}〜{stage.count.max}
        {stage.total_units ? " 枚" : ""}
      </legend>
      {stage.note ? <p className="small">{stage.note}</p> : null}
      {stage.decision_kind && DECISION_TEXT[stage.decision_kind] ? <p className="small">{DECISION_TEXT[stage.decision_kind]}</p> : null}
      {stage.bench ? (
        <p className="small">
          ベンチ: {stage.bench.count}/{stage.bench.limit}（今の数と上限。出せるかどうかはエンジンが候補で示します）
        </p>
      ) : null}
      {stage.total_units && units !== null ? (
        <div className="units" role="status" aria-label="エネルギーの個数">
          <p className="small">
            必要なエネルギーの個数（total_units）: <strong>{stage.total_units.min === stage.total_units.max ? stage.total_units.min : `${stage.total_units.min}〜${stage.total_units.max}`}</strong> 個 ／
            選んでいる合計: <strong>{units}</strong> 個（{picked.length} 枚）
            {inUnits ? "・個数は範囲内" : "・個数が範囲外"}
          </p>
          <p className="small muted">
            個数はカードの枚数ではありません（1 枚で 2 個を出すカードがあります）。個数が範囲内でも、余る個数・読み方で変わる数などはエンジンの検査が決めます。
          </p>
        </div>
      ) : null}
      {stage.confused ? <p className="small warn">こんらん: 受理のあとにコインを投げます（にげるのに失敗することがあります）。</p> : null}
      {stage.decline ? <p className="small">辞退できます（何も選ばずに送れます）。</p> : null}
      {orderText && stage.count.max > 1 ? <p className="small">{orderText}</p> : null}
      {declaration && (stage.options ?? []).length === 0 ? (
        // 宣言といっしょに選べるものが 1 つもない（count 0〜0）: 余分な入力を求めない
        <p className="small muted">宣言といっしょに選べるものはありません（ワザだけを送ります）。</p>
      ) : waitingFor !== null ? (
        <p className="callout info small">
          {stage.path_stages
            ? `段 ${waitingFor.join("・")} を選ぶと、その組でエンジンが示したものだけを選べます（組はエンジンの options_by_path）。`
            : `段 ${waitingFor.join("・")} を選ぶと、その選択と組になるものだけを選べます（組はエンジンの options_by_choice）。`}
        </p>
      ) : stage.path_stages && options.length === 0 ? (
        <p className="callout info small">今の段 {stage.path_stages.join("・")} の組では、この段に選べるものがありません（エンジンの options_by_path に組がない）。選ばずに送れます。</p>
      ) : declaration && options.length === 0 ? (
        <p className="small muted">このワザといっしょに選べるものはありません（0 個のまま送れます）。</p>
      ) : options.length === 0 ? (
        <p className="callout info">
          選べるものがありません（エンジンの応答のまま表示しています）。
          {stage.count.min === 0 ? " 0 個のまま送れます。" : " 最小数を満たせないため送れません。"}
        </p>
      ) : null}
      <ul className="options" role="list">
        {single && stage.count.min === 0 && waitingFor === null ? (
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
                {typeof option.card_id === "string" ? (
                  <CardFace cardId={option.card_id} name={names(option.card_id) ?? option.card_id} size="s" decorative />
                ) : option.face_down ? (
                  <CardBack label="裏向きのポケモン" size="s" /> // 本人のうらのポケモン: カード ID・名前を渡さない
                ) : null}
                <span className="option-text">
                  <span>{optionLabel(option, stage, observation, names)}</span>
                  <code className="muted small">{option.id}</code>
                  {typeof option.card === "number" ? <code className="muted small">#{option.card}</code> : null}
                  {option.units !== undefined ? <span className="small">{option.units} 個</span> : null}
                  {option.special ? <span className="small">特殊エネルギー</span> : null}
                  {checked && !single ? <span className="order-no">{picked.indexOf(option.id) + 1}番目</span> : null}
                  {attackStage ? <AttackDetails option={option} observation={observation} /> : null}
                </span>
              </label>
              <span className="option-meta">
                <ProcessabilityBadge value={option.processability} />
                {option.placement && option.placement !== "eligible" ? <code className="small">placement: {option.placement}</code> : null}
                {option.convention ? <code className="small">規約 {option.convention}</code> : null}
                {option.reasons?.length ? <span className="small muted">理由: {reasonsText(option.reasons)}</span> : null}
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

/**
 * U7-5f: 表示だけの候補（check_face_up_deck）。エンジンが返した owner・position だけを表示する（カード ID・uid・名前・表面の画像を補わない）。
 * position は 0 がいちばん上（内部の値）で、人向けには「上から position+1 枚目」と書く。check・submit を呼ばない（ボタンを出さない）。
 */
function DisplayOnlyInputs({
  candidate,
  stages,
  actor,
  headingId,
  onCancel,
}: {
  candidate: Candidate;
  stages: InputStage[];
  actor: PlayerIndex | "host" | null;
  headingId: string;
  onCancel(): void;
}) {
  const [only] = stages as OptionStage[];
  return (
    <section className="panel decision display-only" aria-labelledby={headingId}>
      <h3 id={headingId}>
        表示だけ: {labelOf(KIND_LABELS, candidate.kind)} <code className="muted">{candidate.kind}</code>
      </h3>
      <div className="badges">
        <ProcessabilityBadge value={candidate.processability} withDescription />
      </div>
      <p className="callout warn small" role="status">
        この候補は表示だけで、送れません。エンジンの記録で裁定が決まらない要求（未裁定・FU2）のためで、ゲーム上の禁止ではありません。この GUI は検査・送信を呼びません。
      </p>
      <p className="small">
        エンジンが示した、相手の山札のおもてのカードの位置です（位置は公開のおもての枚数だけから決まります）。どのカードかは表示しません（カード ID・名前・画像は受け取っていません）。
      </p>
      <ul className="options face-up-positions" aria-label="おもての山札の位置">
        {(only?.options ?? []).map((op) => (
          <li key={op.id}>
            <span>
              {actor === op.owner ? "自分" : `相手（${playerLabel(op.owner as PlayerIndex)}）`}の山札・上から {(op.position as number) + 1} 枚目
            </span>{" "}
            <code className="muted small">
              owner: {op.owner}・position: {op.position}（0 がいちばん上）
            </code>{" "}
            <ProcessabilityBadge value={op.processability} />
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" onClick={onCancel}>
          閉じる
        </button>
      </div>
    </section>
  );
}
