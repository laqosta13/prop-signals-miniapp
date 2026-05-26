import { useCallback, useEffect, useRef, useState } from "react";
import type { Signal } from "../api";
import { loadPlayedOutcomeIds } from "../utils/outcomeRevealStorage";

function pickRevealSignal(signals: Signal[], played: Set<number>): Signal | null {
  const candidates = signals.filter((s) => (s.status === "win" || s.status === "lose") && !played.has(s.id));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const ta = new Date(a.closed_at || a.created_at).getTime();
    const tb = new Date(b.closed_at || b.created_at).getTime();
    return tb - ta;
  });
  return candidates[0] ?? null;
}

export function useOutcomeReveal(signals: Signal[], loading: boolean, userId: number | null) {
  const [revealSignal, setRevealSignal] = useState<Signal | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (loading || userId == null || checkedRef.current) return;
    const played = loadPlayedOutcomeIds(userId);
    const next = pickRevealSignal(signals, played);
    checkedRef.current = true;
    if (!next) return;
    const t = window.setTimeout(() => setRevealSignal(next), 380);
    return () => clearTimeout(t);
  }, [loading, userId, signals]);

  const clearReveal = useCallback(() => setRevealSignal(null), []);

  return { revealSignal, clearReveal };
}
