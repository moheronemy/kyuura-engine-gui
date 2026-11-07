// 同じ対戦への送信を 1 つずつにする最小の制御（二重クリック・並行送信の防止）。
// 閲覧者の画面とホストの画面で 1 つの門を共有する。接続層も対戦ごとの鍵で直列化するが、画面の側でも重ねて送らない。
import { useCallback, useMemo, useRef, useState } from "react";

export interface SubmitGate {
  busy: boolean;
  /** 門が空いていれば fn を実行する。使用中なら実行せず null。 */
  run<T>(fn: () => Promise<T>): Promise<T | null>;
}

export function useSubmitGate(): SubmitGate {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return useMemo(() => ({ busy, run }), [busy, run]);
}
