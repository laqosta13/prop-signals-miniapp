import { useCallback, useEffect, useRef, useState } from "react";
import type { Signal } from "../api";
import {
  isOutcomeRevealEligible,
  loadPlayedOutcomeIds,
  parseMemberSinceMs,
  signalClosedAtMs,
} from "../utils/outcomeRevealStorage";

function pickRevealSignal(
  signals: Signal[],
  played: Set<number>,
  memberSinceMs: number | null,
): Signal | null {
  const candidates = signals.filter((s) =>
    isOutcomeRevealEligible(s.status, s.id, s.closed_at, s.created_at, played, memberSinceMs),
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => signalClosedAtMs(b.closed_at, b.created_at) - signalClosedAtMs(a.closed_at, a.created_at));
  return candidates[0] ?? null;
}

export function useOutcomeReveal(
  signals: Signal[],
  loading: boolean,
  userId: number | null,
  memberSince: string | null | undefined,
) {
  const [revealSignal, setRevealSignal] = useState<Signal | null>(null);
  const scheduledIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading || userId == null || revealSignal != null) return;

    const memberSinceMs = parseMemberSinceMs(memberSince);
    const played = loadPlayedOutcomeIds(userId);
    const next = pickRevealSignal(signals, played, memberSinceMs);
    if (!next) return;
    if (scheduledIdRef.current === next.id) return;

    scheduledIdRef.current = next.id;
    const t = window.setTimeout(() => {
      scheduledIdRef.current = null;
      setRevealSignal(next);
    }, 380);

    return () => {
      clearTimeout(t);
      if (scheduledIdRef.current === next.id) scheduledIdRef.current = null;
    };
  }, [loading, userId, signals, memberSince, revealSignal]);

  const clearReveal = useCallback(() => setRevealSignal(null), []);

  return { revealSignal, clearReveal };
}
