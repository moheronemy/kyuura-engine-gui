// 画面の全体。対戦を作ると、閲覧者（プレイヤー0・プレイヤー1・観戦者）の画面と、別枠のローカルホストの画面を出す。
//
// ローカル確認用: 一台の端末で両プレイヤーを切り替えるためのもの。切り替えは本人確認・認証ではなく、
// 公開サーバーの権限制御に流用しない。入口の識別子は接続層が作ったローカル用の関連付けで、強固な認証ではない。
import { useCallback, useEffect, useMemo, useState } from "react";
import { endpointClient, fetchTransport, loadCatalog, type Transport } from "./api/transport";
import type { MatchInfo, PlayerIndex, SeatKey } from "./api/types";
import { ENGINE } from "./api/contract";
import { EndpointConsole } from "./components/EndpointConsole";
import { ScopeNote } from "./components/Panels";
import { StartScreen } from "./components/StartScreen";
import { useSubmitGate } from "./state/submitGate";

const SEATS: { key: SeatKey; label: string; viewer: PlayerIndex | null }[] = [
  { key: "player0", label: "プレイヤー0", viewer: 0 },
  { key: "player1", label: "プレイヤー1", viewer: 1 },
  { key: "spectator", label: "観戦者", viewer: null },
];

export function App({ transport = fetchTransport }: { transport?: Transport }) {
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [screen, setScreen] = useState<"start" | "game">("start");
  const [seat, setSeat] = useState<SeatKey>("player0");
  const [catalog, setCatalog] = useState<Map<string, string>>(new Map());
  const [signal, setSignal] = useState(0);
  const gate = useSubmitGate();

  useEffect(() => {
    let alive = true;
    loadCatalog(transport)
      .then((cards) => alive && setCatalog(new Map(cards.map((c) => [c.id, c.name_ja]))))
      .catch(() => undefined); // カード名がなくても ID で表示できる
    return () => {
      alive = false;
    };
  }, [transport]);

  const names = useCallback((id: string) => catalog.get(id), [catalog]);
  const bump = useCallback(() => setSignal((n) => n + 1), []);

  const seatInfo = SEATS.find((s) => s.key === seat) ?? SEATS[0]!;
  const seatClient = useMemo(
    () => (match ? endpointClient(transport, { route: "seat", token: match.seats[seat].token }) : null),
    [match, seat, transport],
  );
  const hostClient = useMemo(() => (match ? endpointClient(transport, { route: "host", token: match.host.token }) : null), [match, transport]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>kyuura ローカル対戦確認</h1>
        <p className="local-banner" role="note">
          ローカル確認用の画面です。認証済みのオンライン対戦ではありません。プレイヤーの切り替えは同じ端末での確認のためで、本人確認ではありません。
        </p>
        <p className="small muted">
          エンジン kyuura-engine {ENGINE.version}（<code>{ENGINE.commit.slice(0, 7)}</code>）・契約 kyuura-client-api 形式 1
        </p>
      </header>

      {screen === "start" || !match ? (
        <>
          {match ? (
            <p>
              <button type="button" onClick={() => setScreen("game")}>
                今の対戦に戻る
              </button>
            </p>
          ) : null}
          <StartScreen
            transport={transport}
            names={names}
            onStarted={(m) => {
              setMatch(m);
              setSeat("player0");
              setScreen("game");
            }}
          />
          <ScopeNote />
        </>
      ) : (
        <main className="game">
          <div className="game-bar">
            <div className="origin small">
              {match.origin.label}
              {match.origin.description ? `: ${match.origin.description}` : ""}
            </div>
            <button type="button" onClick={() => setScreen("start")}>
              新しい対戦…
            </button>
          </div>

          <section className="viewer-area" aria-labelledby="viewer-heading">
            <div className="seat-switcher" role="radiogroup" aria-labelledby="viewer-heading">
              <h2 id="viewer-heading">表示する閲覧者（ローカルの切り替え）</h2>
              {SEATS.map((s) => (
                <label key={s.key} className={`seat-option${seat === s.key ? " selected" : ""}`}>
                  <input type="radio" name="seat" value={s.key} checked={seat === s.key} onChange={() => setSeat(s.key)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            {seatClient ? (
              <EndpointConsole
                key={`${match.match_id}:${seat}`}
                client={seatClient}
                kind={seatInfo.viewer === null ? "spectator" : "player"}
                viewer={seatInfo.viewer}
                gate={gate}
                names={names}
                refreshSignal={signal}
                onMutated={bump}
                operationPrefix={`gui-${seat}`}
                showBoard
              />
            ) : null}
          </section>

          <section className="host-area" aria-labelledby="host-heading">
            <h2 id="host-heading">ローカルホストの操作（別枠）</h2>
            <p className="small">
              ジャンケンの結果（エンジンの外で行った結果）とサドン・デスの開始だけを扱います。プレイヤーの操作とは別の入口です。観測は観戦者と同じ範囲です。
            </p>
            {hostClient ? (
              <EndpointConsole
                key={`${match.match_id}:host`}
                client={hostClient}
                kind="host"
                viewer={null}
                gate={gate}
                names={names}
                refreshSignal={signal}
                onMutated={bump}
                operationPrefix="gui-host"
                showBoard={false}
              />
            ) : null}
          </section>
          <ScopeNote />
        </main>
      )}
    </div>
  );
}
