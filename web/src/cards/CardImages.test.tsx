// カード画像の部品（模擬の描画）。非同期の描画・キャンセル・ピクセルの消去・失敗時の文字の表示・裏面。
// 実際の renderer での変換は realRenderer.test.ts、実際の描画はブラウザ（e2e/card-images.spec.ts）。
import { act, render, screen } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Transport } from "../api/transport";
import { CARD_DEFINITIONS, deferred, mockRenderer } from "../test/fixtures";
import { CardBack, CardBackRow, CardFace, CardImagesProvider } from "./CardImages";

const defsTransport = (value: unknown | Promise<unknown> = CARD_DEFINITIONS): Transport => ({ request: async () => value });
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

function setup(ui: ReactNode, opts: { transport?: Transport; mock?: ReturnType<typeof mockRenderer>; strict?: boolean } = {}) {
  const mock = opts.mock ?? mockRenderer();
  const transport = opts.transport ?? defsTransport();
  const wrap = (node: ReactNode) => {
    const tree = (
      <CardImagesProvider transport={transport} renderer={mock.renderer}>
        {node}
      </CardImagesProvider>
    );
    return opts.strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
  const view = render(wrap(ui));
  return { mock, rerender: (node: ReactNode) => view.rerender(wrap(node)), unmount: view.unmount };
}

const visibleCanvases = () => Array.from(document.querySelectorAll("canvas")).filter((c) => !c.hidden);
const lastCall = (mock: ReturnType<typeof mockRenderer>) => mock.calls.at(-1)!;

describe("表面: 読み込み中・描画・失敗", () => {
  it("定義の取得中は文字で「準備中」、描けたら Canvas を見せる（true）", async () => {
    const pending = deferred<unknown>();
    const { mock } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />, { transport: defsTransport(pending.promise) });
    expect(screen.getByText("画像を準備中")).toBeInTheDocument();
    expect(screen.getByText("エビワラー")).toBeInTheDocument();
    expect(mock.calls).toHaveLength(0);
    await act(async () => pending.resolve(CARD_DEFINITIONS));
    expect(mock.calls).toHaveLength(1);
    expect(lastCall(mock).cardId).toBe("PMCG1-058");
    expect(document.querySelector("canvas")?.hidden).toBe(true); // 描けるまで隠す
    await act(async () => lastCall(mock).resolve(true));
    expect(visibleCanvases()).toHaveLength(1);
    expect(screen.getByRole("img", { name: "エビワラーの印刷のカード画像（非公式のカード風の画像）" })).toBeInTheDocument();
    expect(screen.queryByText("画像を準備中")).toBeNull();
  });

  it("false（無効になった要求）はエラーにしない", async () => {
    const { mock } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    await act(async () => lastCall(mock).resolve(false));
    expect(screen.queryByText("画像を描けませんでした")).toBeNull();
    expect(screen.getByText("画像を準備中")).toBeInTheDocument();
    expect(visibleCanvases()).toHaveLength(0);
  });

  it("reject（有効な要求の失敗）は文字の表示に戻し、描き直さない", async () => {
    const { mock, rerender } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    await act(async () => lastCall(mock).reject(new Error("素材を読み込めない")));
    expect(screen.getByText("画像を描けませんでした")).toBeInTheDocument();
    expect(screen.getByText("エビワラー")).toBeInTheDocument();
    rerender(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    expect(mock.calls).toHaveLength(1); // 無限の再試行をしない
    expect(visibleCanvases()).toHaveLength(0);
  });

  it("同期の例外（Canvas 2D が使えないなど）も失敗の表示にする", async () => {
    const mock = mockRenderer();
    mock.renderer.render = () => {
      throw new Error("Canvas 2D が使えません");
    };
    setup(<CardFace cardId="PMCG1-058" name="エビワラー" />, { mock });
    await flush();
    expect(screen.getByText("画像を描けませんでした")).toBeInTheDocument();
  });

  it("未知のカード ID・形の正しくない ID・定義の取得失敗・変換できない定義", async () => {
    setup(
      <>
        <CardFace cardId="NOPE-999" name="未知" />
        <CardFace cardId="../etc/passwd" name="不正" />
      </>,
    );
    await flush();
    expect(screen.getAllByText("画像なし（カード定義にないカード）")).toHaveLength(2);

    document.body.innerHTML = "";
    setup(<CardFace cardId="PMCG1-058" name="エビワラー" />, { transport: { request: async () => Promise.reject(new Error("通信できない")) } });
    await flush();
    expect(screen.getByText("画像なし（カード定義を取得できません）")).toBeInTheDocument();

    document.body.innerHTML = "";
    const mock = mockRenderer({
      toItem: () => {
        throw new Error("変換できない");
      },
    });
    setup(<CardFace cardId="PMCG1-058" name="エビワラー" />, { mock });
    await flush();
    expect(screen.getByText("画像なし（カード定義を描けません）")).toBeInTheDocument();
    expect(mock.calls).toHaveLength(0);
  });

  it("同じカードは同じ内容のオブジェクトで描く（親の再描画で描き直さない）", async () => {
    const { mock, rerender } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    await act(async () => lastCall(mock).resolve(true));
    rerender(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    rerender(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    expect(mock.calls).toHaveLength(1);
    expect(mock.items.filter((id) => id === "PMCG1-058")).toHaveLength(1);
  });
});

describe("内容の変更・破棄でのキャンセルとピクセルの消去", () => {
  it("表面 A → 表面 B: A をキャンセルして消し、遅れた A の完了は B の表示を変えない", async () => {
    const { mock, rerender } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    const a = lastCall(mock);
    await act(async () => a.resolve(true));
    expect(a.canvas.hidden).toBe(false);
    a.canvas.width = 84; // 描かれた状態を模す
    rerender(<CardFace cardId="T-1" name="テスト" />);
    // 1. 待機中の描画をキャンセル 2. 古い画像をすぐに隠して消す（Canvas も外す）
    expect(mock.cancelled).toContain(a.canvas);
    expect(a.canvas.hidden).toBe(true);
    expect(a.canvas.width).toBe(0);
    expect(a.canvas.isConnected).toBe(false);
    await flush();
    const b = lastCall(mock);
    expect(b.cardId).toBe("T-1");
    expect(b.canvas).not.toBe(a.canvas); // 古い Canvas を使い回さない
    // 3. 新しい内容が描けるまで見せない
    expect(visibleCanvases()).toHaveLength(0);
    expect(screen.getByText("画像を準備中")).toBeInTheDocument();
    await act(async () => b.resolve(true));
    expect(screen.getByRole("img", { name: /^テストの印刷のカード画像/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /エビワラー/ })).toBeNull();
  });

  it("描画が終わる前に A → B にして、あとで A が終わっても（true・reject とも）表示しない", async () => {
    const { mock, rerender } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    const a = lastCall(mock);
    rerender(<CardFace cardId="T-1" name="テスト" />);
    await flush();
    const b = lastCall(mock);
    await act(async () => a.resolve(true)); // 遅れて完了（実際の renderer なら false。どちらでも表示しない）
    expect(visibleCanvases()).toHaveLength(0);
    expect(screen.queryByText("画像を描けませんでした")).toBeNull();
    await act(async () => b.resolve(true));
    expect(visibleCanvases()).toEqual([b.canvas]);
  });

  it("古い要求の失敗は新しい表示を変えない", async () => {
    const { mock, rerender } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    const a = lastCall(mock);
    rerender(<CardFace cardId="T-1" name="テスト" />);
    await flush();
    const b = lastCall(mock);
    await act(async () => b.resolve(true));
    await act(async () => a.reject(new Error("遅れた失敗")));
    expect(screen.queryByText("画像を描けませんでした")).toBeNull();
    expect(visibleCanvases()).toEqual([b.canvas]);
  });

  it("表面 → 裏面: 表面をキャンセルして消し、裏面にはカード ID・名前を渡さない", async () => {
    const { mock, rerender } = setup(<CardFace cardId="SECRET-1" name="ひみつのポケモン" />);
    await flush();
    const a = lastCall(mock);
    await act(async () => a.resolve(true));
    rerender(<CardBack label="裏向きのポケモン" />);
    expect(mock.cancelled).toContain(a.canvas);
    expect(a.canvas.width).toBe(0);
    expect(a.canvas.isConnected).toBe(false);
    await flush();
    expect(document.querySelectorAll("canvas")).toHaveLength(0);
    expect(screen.getByRole("img", { name: "裏向きのポケモン" })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/SECRET-1|ひみつ/);
    await act(async () => a.resolve(true)); // 遅れた完了
    expect(document.body.innerHTML).not.toMatch(/SECRET-1|ひみつ/);
  });

  it("部品の破棄でキャンセルして消す", async () => {
    const { mock, unmount } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />);
    await flush();
    const a = lastCall(mock);
    await act(async () => a.resolve(true));
    unmount();
    expect(mock.cancelled).toContain(a.canvas);
    expect(a.canvas.width).toBe(0);
    expect(a.canvas.hidden).toBe(true);
  });

  it("StrictMode（effect の 2 回の実行）でも、最初の要求はキャンセルされ、最後の要求だけが表示される", async () => {
    const { mock } = setup(<CardFace cardId="PMCG1-058" name="エビワラー" />, { strict: true });
    await flush();
    expect(mock.calls.length).toBeGreaterThanOrEqual(2);
    const [first, ...rest] = mock.calls;
    const last = rest.at(-1)!;
    expect(mock.cancelled).toContain(first!.canvas);
    await act(async () => first!.resolve(true)); // キャンセル済みの要求の完了
    expect(visibleCanvases()).toHaveLength(0);
    await act(async () => last.resolve(true));
    expect(visibleCanvases()).toHaveLength(1);
    expect(screen.queryByText("画像を描けませんでした")).toBeNull();
  });
});

describe("裏面", () => {
  it("共有の裏面の画像を使い、枚数に基づいて並べる（最大 8 枚＋残りの数）", async () => {
    const { mock } = setup(<CardBackRow count={12} label="プレイヤー1・手札" />);
    await flush();
    const row = screen.getByRole("img", { name: "プレイヤー1・手札（裏向き 12 枚）" });
    expect(row.querySelectorAll("img")).toHaveLength(8);
    expect(row).toHaveTextContent("＋4");
    expect(new Set(Array.from(row.querySelectorAll("img")).map((i) => i.getAttribute("src")))).toEqual(new Set(["data:image/png;base64,QkFDSw=="]));
    expect(document.querySelectorAll("canvas")).toHaveLength(0); // 裏面ごとに Canvas を作らない
    expect(mock.calls).toHaveLength(0);
  });

  it("裏面の画像を描けなければ文字の「裏」にする", async () => {
    setup(<CardBack label="裏向きのポケモン" />, { mock: mockRenderer({ back: Promise.reject(new Error("素材なし")) }) });
    await flush();
    expect(screen.getByRole("img", { name: "裏向きのポケモン" })).toHaveTextContent("裏");
  });
});
