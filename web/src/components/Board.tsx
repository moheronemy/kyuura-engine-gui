// 盤面（観測の表示）。カード画像を使わないテキスト中心の表示。観測に含まれる値だけを書き、含まれない値を補わない。
import type { CardRef, FieldPokemon, FieldSlot, Observation, PlayerIndex, PlayerObservation } from "../api/types";
import { ENERGY_LABELS, labelOf, playerLabel } from "../labels";

type Names = (cardId: string) => string | undefined;

function isField(slot: FieldSlot | null): slot is FieldPokemon {
  return slot != null && !("face_down" in slot);
}

function CardName({ card, names }: { card: CardRef; names: Names }) {
  return (
    <span className="card-name">
      {card.name_ja ?? names(card.card_id) ?? "（カード名表にない）"} <code className="muted small">{card.card_id}</code>
    </span>
  );
}

function PokemonCard({ slot, names, place }: { slot: FieldSlot; names: Names; place: string }) {
  if (!isField(slot)) {
    return (
      <div className="pokemon face-down" aria-label={`${place}: 裏向きのポケモン`}>
        <div className="pokemon-head">裏向きのポケモン</div>
        <p className="small muted">最初の番の前で、この閲覧者には見えません。</p>
      </div>
    );
  }
  const remaining = slot.hp - slot.damage;
  return (
    <article className="pokemon" aria-label={`${place}: ${slot.name_ja}`}>
      <div className="pokemon-head">
        <strong>{slot.name_ja}</strong> <code className="muted small">{slot.card_id}</code>
      </div>
      <dl className="stats">
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
    </article>
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
      <div className="field-row">
        <div className="slot active-slot">
          <h4>バトル場</h4>
          {player.active ? <PokemonCard slot={player.active} names={names} place="バトル場" /> : <p className="muted">なし</p>}
        </div>
        <div className="slot bench-slot">
          <h4>ベンチ（{player.bench.length}）</h4>
          {player.bench.length ? (
            <div className="bench">
              {player.bench.map((b, i) => (
                <PokemonCard key={i} slot={b} names={names} place={`ベンチ${i + 1}`} />
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
      <details>
        <summary>トラッシュ（{player.discard.length}）</summary>
        {player.discard.length ? (
          <ul className="card-list">
            {player.discard.map((c, i) => (
              <li key={`${c.card}-${i}`}>
                <CardName card={c} names={names} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">なし</p>
        )}
      </details>
      <div className="hand">
        <h4>手札（{player.hand.count}）</h4>
        {player.hand.cards ? (
          <ul className="card-list" aria-label={`${playerLabel(player.player)}の手札`}>
            {player.hand.cards.map((c, i) => (
              <li key={`${c.card}-${i}`}>
                <CardName card={c} names={names} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">この閲覧者には中身が見えません（枚数だけ）。</p>
        )}
      </div>
    </section>
  );
}

export function Board({ observation, viewer, names }: { observation: Observation; viewer: PlayerIndex | null; names: Names }) {
  const bottom: PlayerIndex = viewer ?? 0;
  const top: PlayerIndex = bottom === 0 ? 1 : 0;
  const players = observation.players;
  return (
    <div className="board">
      <PlayerArea player={players[top]} names={names} mine={false} isCurrent={observation.current_player === top} />
      <div className="board-middle">
        <span>スタジアム: {observation.stadium ? `${names(observation.stadium.card_id) ?? observation.stadium.card_id}（${playerLabel(observation.stadium.owner)}）` : "なし"}</span>
        {observation.trainer_in_use ? (
          <span>使用中のトレーナー: {names(observation.trainer_in_use.card_id) ?? observation.trainer_in_use.card_id}</span>
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
