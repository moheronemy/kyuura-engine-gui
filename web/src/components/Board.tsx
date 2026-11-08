// 盤面（観測の表示）。観測に含まれる値だけを書き、含まれない値を補わない。
// カード画像（非公式のカード風の画像）は、観測にカード ID があるカードだけ表面を描き、枚数だけが公開されたもの・
// 裏向きのものは裏面にする（カード ID・名前を裏面の部品へ渡さない）。HP・ダメージ・状態などの今の値は、画像の印刷の値ではなく
// 観測の値を文字で表示する。画像が描けないときも、同じ文字の表示で確かめられる。
import { useState } from "react";
import type { CardRef, FieldPokemon, FieldSlot, Observation, PlayerIndex, PlayerObservation } from "../api/types";
import { CardBack, CardBackRow, CardFace } from "../cards/CardImages";
import { ENERGY_LABELS, labelOf, playerLabel } from "../labels";

type Names = (cardId: string) => string | undefined;

function isField(slot: FieldSlot | null): slot is FieldPokemon {
  return slot != null && !("face_down" in slot);
}

function nameOf(card: CardRef, names: Names): string {
  return card.name_ja ?? names(card.card_id) ?? "（カード名表にない）";
}

function CardName({ card, names }: { card: CardRef; names: Names }) {
  return (
    <span className="card-name">
      {nameOf(card, names)} <code className="muted small">{card.card_id}</code>
    </span>
  );
}

/** 表のカード 1 枚（画像と、名前・ID の文字）。 */
function FaceCard({ card, names, size = "m" }: { card: CardRef; names: Names; size?: "s" | "m" | "l" }) {
  return (
    <figure className="card-tile">
      <CardFace cardId={card.card_id} name={nameOf(card, names)} size={size} />
      <figcaption>
        <CardName card={card} names={names} />
      </figcaption>
    </figure>
  );
}

function PokemonCard({ slot, names, place, size }: { slot: FieldSlot; names: Names; place: string; size: "m" | "l" }) {
  if (!isField(slot)) {
    return (
      <div className="pokemon face-down" aria-label={`${place}: 裏向きのポケモン`}>
        <CardBack label="裏向きのポケモン" size={size} />
        <div className="pokemon-body">
          <div className="pokemon-head">裏向きのポケモン</div>
          {/* 最初の番の前のポケモンと、マチスの秘策などでうらにしたカード。どのカードか（カード ID・名前）は補わない。おもてにしたあとは観測で表示する */}
          {slot.real ? (
            // 持ち主の観測にだけある本人の知識（相手・観戦者の観測にはない）。表の画像は描かず（場ではうらのまま）、文字だけで示す
            <p className="small">
              うらのカードです。あなたにだけ見えるカード: {nameOf(slot.real, names)} <code className="muted small">{slot.real.card_id}</code>（相手・観戦者には見えません）
            </p>
          ) : (
            <p className="small muted">うらのカードです。この閲覧者には、どのカードか見えません。</p>
          )}
          {typeof slot.damage === "number" && slot.damage > 0 ? <p className="small">ダメージ {slot.damage}（観測の値）</p> : null}
          {Array.isArray(slot.energy) && slot.energy.length ? <p className="small">ついているエネルギー {slot.energy.length} 枚（観測の値）</p> : null}
        </div>
      </div>
    );
  }
  const remaining = slot.hp - slot.damage;
  return (
    <article className="pokemon" aria-label={`${place}: ${slot.name_ja}`}>
      <figure className="pokemon-image">
        <CardFace cardId={slot.card_id} name={slot.name_ja} size={size} />
        <figcaption className="small muted">印刷の画像</figcaption>
      </figure>
      <div className="pokemon-body">
        <div className="pokemon-head">
          <strong>{slot.name_ja}</strong> <code className="muted small">{slot.card_id}</code>
        </div>
        <dl className="stats" aria-label="今の状態（観測の値）">
          <div>
            <dt>HP</dt>
            <dd>
              {remaining}/{slot.hp}
              {slot.printed_hp !== undefined && slot.printed_hp !== slot.hp ? <span className="small muted">（印刷 {slot.printed_hp}）</span> : null}
            </dd>
          </div>
          <div>
            <dt>ダメージ</dt>
            <dd>{slot.damage}</dd>
          </div>
          {slot.pokemon_type ? (
            <div>
              <dt>タイプ</dt>
              <dd>{labelOf(ENERGY_LABELS, slot.pokemon_type)}</dd>
            </div>
          ) : null}
          <div>
            <dt>弱点・抵抗力</dt>
            <dd>
              {slot.weakness ? labelOf(ENERGY_LABELS, slot.weakness) : "—"}・{slot.resistance ? `${labelOf(ENERGY_LABELS, slot.resistance)} -${slot.resistance_value ?? ""}` : "—"}
            </dd>
          </div>
        </dl>
        <p className="small">
          状態: {slot.special_conditions.length ? slot.special_conditions.join("・") : "なし"}
          {slot.persistent_effects?.length ? ` ／ 効果: ${slot.persistent_effects.join("・")}` : ""}
          {slot.markers?.length ? ` ／ マーカー ${slot.markers.length}` : ""}
        </p>
        <p className="small">
          エネルギー（{slot.energy.length}）:{" "}
          {slot.energy.length ? slot.energy.map((e, i) => <span key={`${e.card}-${i}`}>{i ? "・" : ""}{names(e.card_id) ?? e.card_id}</span>) : "なし"}
        </p>
        {slot.trainers.length ? <p className="small">ついているトレーナー: {slot.trainers.length} 枚</p> : null}
        {slot.attacks?.length ? (
          <p className="small muted">
            ワザ（表示のみ・現行 API では使えません）: {slot.attacks.map((a) => a.name_ja ?? "?").join("・")}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** 山札のいちばん上がおもてなら、観測にあるそのカードの id（全員に公開）。 */
function deckTop(deck: PlayerObservation["deck"]): string | null {
  const top = deck.face_up_top;
  if (typeof top === "object" && top !== null && "card_id" in top && typeof top.card_id === "string") return top.card_id;
  return null;
}

function Piles({ player, names }: { player: PlayerObservation; names: Names }) {
  const who = playerLabel(player.player);
  const top = deckTop(player.deck);
  const faceUp = new Map(player.prizes.face_up.map((c) => [c.position, c]));
  return (
    <div className="piles">
      <div className="pile">
        <span className="small">山札</span>
        {player.deck.count === 0 ? (
          <span className="small muted">なし</span>
        ) : top ? (
          <CardFace cardId={top} name={`${names(top) ?? top}（山札のいちばん上・おもて）`} size="s" />
        ) : (
          <CardBack label={`${who}・山札（裏向き ${player.deck.count} 枚）`} size="s" />
        )}
      </div>
      <div className="pile">
        <span className="small">サイド</span>
        {player.prizes.count === 0 ? <span className="small muted">なし</span> : null}
        <span className="prize-row">
          {Array.from({ length: player.prizes.count }, (_, position) => {
            const card = faceUp.get(position);
            // おもてのサイドは観測にカード ID がある（全員に公開）。それ以外は裏面で、どのカードかを渡さない
            return card ? (
              <CardFace key={position} cardId={card.card_id} name={`${nameOf(card, names)}（サイド ${position + 1}・おもて）`} size="s" />
            ) : (
              <CardBack key={position} label={`サイド ${position + 1}（裏向き）`} size="s" />
            );
          })}
        </span>
      </div>
    </div>
  );
}

function Discard({ cards, names }: { cards: CardRef[]; names: Names }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>トラッシュ（{cards.length}）</summary>
      {cards.length ? (
        <ul className="card-list">
          {cards.map((c, i) => (
            <li key={`${c.card}-${i}`}>
              {/* 開いたときだけ画像を描く（閉じている間に大量の Canvas を作らない） */}
              {open ? <FaceCard card={c} names={names} size="s" /> : <CardName card={c} names={names} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">なし</p>
      )}
    </details>
  );
}

function PlayerArea({ player, names, mine, isCurrent }: { player: PlayerObservation; names: Names; mine: boolean; isCurrent: boolean }) {
  const title = `${playerLabel(player.player)}${mine ? "（この閲覧者）" : ""}`;
  return (
    <section className={`player-area${mine ? " mine" : " opponent"}`} aria-label={title}>
      <h3>
        {title} {isCurrent ? <span className="tag">番</span> : null}
      </h3>
      <ul className="zones" aria-label="領域の枚数">
        <li>手札 {player.hand.count}</li>
        <li>山札 {player.deck.count}</li>
        <li>サイド {player.prizes.count}</li>
        <li>トラッシュ {player.discard.length}</li>
        {player.set_aside.length ? <li>置いておくカード {player.set_aside.reduce((n, g) => n + g.count, 0)}</li> : null}
      </ul>
      <Piles player={player} names={names} />
      <div className="field-row">
        <div className="slot active-slot">
          <h4>バトル場</h4>
          {player.active ? <PokemonCard slot={player.active} names={names} place="バトル場" size="l" /> : <p className="muted">なし</p>}
        </div>
        <div className="slot bench-slot">
          <h4>ベンチ（{player.bench.length}）</h4>
          {player.bench.length ? (
            <div className="bench">
              {player.bench.map((b, i) => (
                <PokemonCard key={i} slot={b} names={names} place={`ベンチ${i + 1}`} size="m" />
              ))}
            </div>
          ) : (
            <p className="muted">なし</p>
          )}
        </div>
      </div>
      {player.prizes.face_up.length ? (
        <p className="small">
          表のサイド: {player.prizes.face_up.map((c) => `${c.position + 1}: ${names(c.card_id) ?? c.card_id}`).join("・")}
        </p>
      ) : null}
      <Discard cards={player.discard} names={names} />
      <div className="hand">
        <h4>手札（{player.hand.count}）</h4>
        {player.hand.cards ? (
          <ul className="card-list hand-cards" aria-label={`${playerLabel(player.player)}の手札`}>
            {player.hand.cards.map((c, i) => (
              <li key={`${c.card}-${i}`}>
                <FaceCard card={c} names={names} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            {/* 枚数だけが公開されている。枚数に基づく裏面だけを描く（どのカードかを渡さない） */}
            <CardBackRow count={player.hand.count} label={`${playerLabel(player.player)}・手札`} />
            <p className="muted small">この閲覧者には中身が見えません（枚数だけ）。</p>
          </>
        )}
      </div>
    </section>
  );
}

export function Board({ observation, viewer, names }: { observation: Observation; viewer: PlayerIndex | null; names: Names }) {
  const bottom: PlayerIndex = viewer ?? 0;
  const top: PlayerIndex = bottom === 0 ? 1 : 0;
  const players = observation.players;
  const stadium = observation.stadium;
  const trainer = observation.trainer_in_use;
  return (
    <div className="board">
      <PlayerArea player={players[top]} names={names} mine={false} isCurrent={observation.current_player === top} />
      <div className="board-middle">
        <span className="middle-item">
          {stadium ? <CardFace cardId={stadium.card_id} name={nameOf(stadium, names)} size="s" /> : null}
          スタジアム: {stadium ? `${names(stadium.card_id) ?? stadium.card_id}（${playerLabel(stadium.owner)}）` : "なし"}
        </span>
        {trainer ? (
          <span className="middle-item">
            <CardFace cardId={trainer.card_id} name={nameOf(trainer, names)} size="s" />
            使用中のトレーナー: {names(trainer.card_id) ?? trainer.card_id}
          </span>
        ) : null}
        {observation.decision ? (
          <span>
            決定: <code>{observation.decision.kind}</code>（{playerLabel(observation.decision.player)}が決める
            {observation.decision.min_choices !== undefined ? `・選ぶ数 ${observation.decision.min_choices}〜${observation.decision.max_choices}` : ""}
            {observation.decision.option_count !== undefined ? `・選べるもの ${observation.decision.option_count}` : ""}）
          </span>
        ) : null}
      </div>
      <PlayerArea player={players[bottom]} names={names} mine={viewer === bottom} isCurrent={observation.current_player === bottom} />
    </div>
  );
}
