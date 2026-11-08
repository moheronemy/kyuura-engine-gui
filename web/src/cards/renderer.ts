// kyuura-card-renderer の公開 API（パッケージの入口からの export だけ）を、画面の部品が使う形にまとめる。
// 部品のテストでは模擬の実装に差し替える（jsdom には Canvas 2D がない）。実際の renderer での確認は
// definitions の変換のテスト（realRenderer.test.ts）とブラウザでの確認（e2e/）。
import { cancelRenderToCanvas, fromEngineCard, renderToCanvas, type EngineCardRecord, type RenderableCard } from "kyuura-card-renderer";

export type { RenderableCard };

export interface CardRenderer {
  /** 公開カード定義 → 描ける内容（renderer の fromEngineCard）。 */
  toItem(record: EngineCardRecord): RenderableCard;
  /**
   * renderToCanvas と同じ約束: true は描いた、false は同じ Canvas へのあとの要求・キャンセルで無効になった（失敗ではない）、
   * reject は有効な要求の読み込み・描画の失敗。
   */
  render(canvas: HTMLCanvasElement, item: RenderableCard, scale: number): Promise<boolean>;
  /** 待機中の描画を無効にする（今のピクセルは消さない。消すのは呼び出し側）。 */
  cancel(canvas: HTMLCanvasElement): void;
  /** 共有の裏面の画像（1 回だけ描いて、どの裏向きのカードにも同じ画像を使う）。 */
  backImage(): Promise<string>;
}

const BACK_SCALE = 0.5;
let sharedBack: Promise<string> | null = null;

export const realRenderer: CardRenderer = {
  toItem: (record) => fromEngineCard(record),
  render: (canvas, item, scale) => renderToCanvas(canvas, item, scale),
  cancel: (canvas) => {
    cancelRenderToCanvas(canvas);
  },
  backImage() {
    // 裏面は静的な画像なので、専用の Canvas に 1 回だけ描いて URL にする。失敗しても作り直さない（無限の再試行をしない）
    sharedBack ??= (async () => {
      const canvas = document.createElement("canvas");
      const drawn = await renderToCanvas(canvas, { kind: "back" }, BACK_SCALE);
      if (!drawn) throw new Error("裏面の描画が無効になった");
      return canvas.toDataURL("image/png");
    })();
    return sharedBack;
  },
};
