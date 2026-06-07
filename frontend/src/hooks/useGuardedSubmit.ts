import { useCallback, useRef } from "react";

/** Синхронная защита от повторной отправки формы (до обновления React state). */
export function useGuardedSubmit() {
  const inFlightRef = useRef(false);

  const tryAcquire = useCallback(() => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    return true;
  }, []);

  const release = useCallback(() => {
    inFlightRef.current = false;
  }, []);

  return { tryAcquire, release };
}
