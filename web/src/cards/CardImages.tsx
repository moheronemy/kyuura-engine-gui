// カード画像（kyuura-card-renderer で、エンジンのカード定義から作る非公式のカード風の画像）の部品。
// 実際のカードの画像・公式の画像ではない。イラスト枠は白、エネルギーは仮の表示、ベイビィはたねの枠（renderer の制限）。
//
// 情報の境界:
// - 表面（CardFace）は、閲覧者の観測にカード ID があるカードだけに使う（呼び出し側が観測から渡す）
// - 裏面（CardBack・CardBackRow）はカード ID・名前を受け取らない（props・DOM 属性・ラベル・画像名に入れようがない）
// - 公開カード定義の表は対戦に依存しない全体の表で、権限の判定に使わない。描ける内容の使い回しはカード ID だけで決める
//
// 非同期の描画（CardCanvas）:
// - 描く内容ごとに別の Canvas を作る（呼び出し側が key を変える）。描けるまで Canvas は隠したまま
// - 内容の変更・部品の破棄（閲覧者の切り替えで画面ごと作り直すときを含む）では、effect の cleanup で
//   1. 待機中の描画をキャンセル（cancelRenderToCanvas）し、2. Canvas をすぐに隠してピクセルを消す
// - キャンセル後の false はエラーとして扱わない。古い要求の完了・失敗は、この effect の目印で無視する（新しい表示を変えない）
// - 描けなかったら文字の表示に戻し、自動で描き直さない（無限の再試行をしない）
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Transport } from "../api/transport";
import { loadCardDefinitions, type CardDefinitions } from "./definitions";
import { realRenderer, type CardRenderer, type RenderableCard } from "./renderer";

export type CardSize = "s" | "m" | "l";
const WIDTH: Record<CardSize, number> = { s: 56, m: 84, l: 112 };
const CARD_WIDTH = 400; // renderer のカード座標の幅（scale 1 のとき）

type DefinitionsState = { status: "loading" } | { status: "failed" } | { status: "ready"; definitions: CardDefinitions };

/** 表面に描ける内容（公開カード定義から作る。カード ID だけで決まる）。 */
type FaceItem =
  | { kind: "item"; item: RenderableCard }
  | { kind: "loading" } // 定義の表を取得中
  | { kind: "unavailable" } // 表を取得できなかった
  | { kind: "unknown" } // 表にないカード ID（形の正しくない ID を含む）
  | { kind: "invalid" }; // renderer が変換できなかった

interface CardImagesValue {
  renderer: CardRenderer;
  face(cardId: string): FaceItem;
}

const CardImagesContext = createContext<CardImagesValue | null>(null);

export function CardImagesProvider({ transport, renderer = realRenderer, children }: { transport: Transport; renderer?: CardRenderer; children: ReactNode }) {
  const [state, setState] = useState<DefinitionsState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    loadCardDefinitions(transport).then(
      (definitions) => alive && setState({ status: "ready", definitions }),
      () => alive && setState({ status: "failed" }), // 画像なし（文字の表示）。自動で取り直さない
    );
    return () => {
      alive = false;
    };
  }, [transport]);

  const value = useMemo<CardImagesValue>(() => {
    // 変換の結果の使い回し（定義の表の件数までの有限のキャッシュ。キーはカード ID だけ）。同じカードは同じ内容のオブジェクトにして、描き直しを避ける
    const items = new Map<string, FaceItem>();
    return {
      renderer,
      face(cardId) {
        if (state.status === "loading") return { kind: "loading" };
        if (state.status === "failed") return { kind: "unavailable" };
        const cached = items.get(cardId);
        if (cached) return cached;
        const record = state.definitions.get(cardId);
        let result: FaceItem;
        if (!record) result = { kind: "unknown" };
        else {
          try {
            result = { kind: "item", item: renderer.toItem(record) };
          } catch {
            result = { kind: "invalid" };
          }
        }
        if (record) items.set(cardId, result); // 未知の ID はためない（表にない ID でキャッシュを増やさない）
        return result;
      },
    };
  }, [state, renderer]);

  return <CardImagesContext.Provider value={value}>{children}</CardImagesContext.Provider>;
}

function useCardImages(): CardImagesValue | null {
  return useContext(CardImagesContext);
}

function scaleFor(size: CardSize): number {
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  return (WIDTH[size] * dpr) / CARD_WIDTH;
}

/** Canvas をすぐに隠して、今のピクセルを消す（キャンセルはピクセルを消さないので、こちらで消す）。 */
function erase(canvas: HTMLCanvasElement) {
  canvas.hidden = true;
  canvas.width = 0;
  canvas.height = 0;
}

type Phase = "loading" | "drawn" | "failed";

const FALLBACK_TEXT: Record<Exclude<FaceItem["kind"], "item"> | Phase, string> = {
  loading: "画像を準備中",
  drawn: "",
  failed: "画像を描けませんでした",
  unavailable: "画像なし（カード定義を取得できません）",
  unknown: "画像なし（カード定義にないカード）",
  invalid: "画像なし（カード定義を描けません）",
};

function Fallback({ name, state }: { name: string; state: keyof typeof FALLBACK_TEXT }) {
  return (
    <span className="card-fallback" data-state={state}>
      <span className="card-fallback-name">{name}</span>
      <span className="card-fallback-note">{FALLBACK_TEXT[state]}</span>
    </span>
  );
}

function CardCanvas({ item, size, label, name, renderer }: { item: RenderableCard; size: CardSize; label: string; name: string; renderer: CardRenderer }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const scale = useMemo(() => scaleFor(size), [size]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    let current = true; // この effect の要求の目印（cleanup のあとに終わった要求は画面を変えない）
    setPhase("loading");
    let request: Promise<boolean>;
    try {
      request = renderer.render(canvas, item, scale);
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      (drawn) => {
        // false はあとの要求・キャンセルで無効になったもの（失敗ではない）。表示を変えない
        if (!current || !drawn) return;
        canvas.hidden = false;
        setPhase("drawn");
      },
      () => {
        if (!current) return; // 無効になったあとの失敗は表示しない
        erase(canvas);
        setPhase("failed");
      },
    );
    return () => {
      current = false;
      renderer.cancel(canvas);
      erase(canvas);
    };
  }, [item, scale, renderer]);

  return (
    <>
      <canvas ref={ref} className="card-canvas" hidden={phase !== "drawn"} role="img" aria-label={label} />
      {phase === "drawn" ? null : <Fallback name={name} state={phase} />}
    </>
  );
}

/**
 * 公開されたカードの表面（印刷の画像）。cardId は閲覧者の観測にあるものだけを渡す。
 * name は観測・カード名の表の名前（画像が描けないときの文字の表示と、読み上げに使う）。
 * 今の HP・ダメージなどの対戦中の状態は描かない（呼び出し側が文字で並べて表示する）。
 */
export function CardFace({ cardId, name, size = "m", decorative = false }: { cardId: string; name: string; size?: CardSize; decorative?: boolean }) {
  const images = useCardImages();
  const face = images ? images.face(cardId) : ({ kind: "unavailable" } as const);
  // decorative: すぐ隣に同じ名前の文字があるとき（決定の選択肢など）。読み上げを重ねない
  return (
    <span className={`card-image size-${size}`} aria-hidden={decorative ? "true" : undefined}>
      {face.kind === "item" && images ? (
        <CardCanvas key={cardId} item={face.item} size={size} name={name} label={`${name}の印刷のカード画像（非公式のカード風の画像）`} renderer={images.renderer} />
      ) : (
        <Fallback name={name} state={face.kind === "item" ? "unavailable" : face.kind} />
      )}
    </span>
  );
}

type BackState = { status: "loading" } | { status: "ready"; url: string } | { status: "failed" };

/** 共有の裏面の画像（1 回だけ描いたものを使う。カードの情報を含まない）。 */
function useBackImage(): BackState {
  const images = useCardImages();
  const [state, setState] = useState<BackState>({ status: "loading" });
  useEffect(() => {
    if (!images) {
      setState({ status: "failed" });
      return undefined;
    }
    let alive = true;
    images.renderer.backImage().then(
      (url) => alive && setState({ status: "ready", url }),
      () => alive && setState({ status: "failed" }),
    );
    return () => {
      alive = false;
    };
  }, [images]);
  return state;
}

function BackPicture({ back, size }: { back: BackState; size: CardSize }) {
  return (
    <span className={`card-image card-back size-${size}`} aria-hidden="true">
      {back.status === "ready" ? <img src={back.url} alt="" draggable={false} /> : <span className="card-fallback" data-state={back.status}>裏</span>}
    </span>
  );
}

/** 裏向きのカード 1 枚（カード ID・名前を受け取らない）。label は場所の説明（例「裏向きのポケモン」）。 */
export function CardBack({ label, size = "m" }: { label: string; size?: CardSize }) {
  const back = useBackImage();
  return (
    <span className="card-back-one" role="img" aria-label={label}>
      <BackPicture back={back} size={size} />
    </span>
  );
}

/** 枚数だけが公開された領域（相手の手札など）の裏面。枚数分を最大 max 枚まで並べ、残りは数で書く。 */
export function CardBackRow({ count, label, size = "s", max = 8 }: { count: number; label: string; size?: CardSize; max?: number }) {
  const back = useBackImage();
  const shown = Math.max(0, Math.min(count, max));
  return (
    <span className="card-back-row" role="img" aria-label={`${label}（裏向き ${count} 枚）`}>
      {Array.from({ length: shown }, (_, i) => (
        <BackPicture key={i} back={back} size={size} />
      ))}
      {count > shown ? (
        <span className="small muted" aria-hidden="true">
          ＋{count - shown}
        </span>
      ) : null}
    </span>
  );
}
