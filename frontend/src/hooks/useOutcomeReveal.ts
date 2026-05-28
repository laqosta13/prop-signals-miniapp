import { useCallback, useEffect, useRef, useState } from "react";
import type { Signal } from "../api";
import {
  isOutcomeRevealEligible,
  isTerminalOutcomeStatus,
  loadPlayedOutcomeIds,
  parseMemberSinceMs,
  seedPlayedOutcomesForExistingFeed,
  signalClosedAtMs,
} from "../utils/outcomeRevealStorage";

function pickJustClosedSignals(
  signals: Signal[],
  prevStatus: Map<number, string>,
  played: Set<number>,
  memberSinceMs: number | null,
): Signal[] {
  const fresh: Signal[] = [];
  for (const s of signals) {
    const was = prevStatus.get(s.id);
    if (was == null || isTerminalOutcomeStatus(was) || !isTerminalOutcomeStatus(s.status)) continue;
    if (!isOutcomeRevealEligible(s.status, s.closed_at, played, memberSinceMs, s.id)) continue;
    fresh.push(s);
  }
  fresh.sort((a, b) => signalClosedAtMs(a.closed_at) - signalClosedAtMs(b.closed_at));
  return fresh;
}

export function useOutcomeReveal(
  signals: Signal[],
  loading: boolean,
  userId: number | null,
  memberSince: string | null | undefined,
  enabled: boolean,
) {
  const [revealSignal, setRevealSignal] = useState<Signal | null>(null);
  const prevStatusRef = useRef<Map<number, string>>(new Map());
  const hydratedRef = useRef(false);
  const queueRef = useRef<Signal[]>([]);

  const pumpQueue = useCallback(() => {
    const next = queueRef.current[0];
    if (next) setRevealSignal(next);
    else setRevealSignal(null);
  }, []);

  useEffect(() => {
    if (!enabled || loading || userId == null) return;

    const memberSinceMs = parseMemberSinceMs(memberSince);
    const played = loadPlayedOutcomeIds(userId);

    if (!hydratedRef.current) {
      for (const s of signals) {
        prevStatusRef.current.set(s.id, s.status);
      }
      if (memberSinceMs != null) {
        seedPlayedOutcomesForExistingFeed(userId, signals, memberSinceMs);
      }
      hydratedRef.current = true;
      return;
    }

    if (revealSignal != null) {
      for (const s of signals) {
        prevStatusRef.current.set(s.id, s.status);
      }
      return;
    }

    const fresh = pickJustClosedSignals(signals, prevStatusRef.current, played, memberSinceMs);
    for (const s of signals) {
      prevStatusRef.current.set(s.id, s.status);
    }
    if (!fresh.length) return;

    for (const s of fresh) {
      if (!queueRef.current.some((q) => q.id === s.id)) {
        queueRef.current.push(s);
      }
    }
    pumpQueue();
  }, [enabled, loading, userId, signals, memberSince, revealSignal, pumpQueue]);

  const clearReveal = useCallback(() => {
    queueRef.current.shift();
    pumpQueue();
  }, [pumpQueue]);

  useEffect(() => {
    if (userId == null) {
      hydratedRef.current = false;
      prevStatusRef.current.clear();
      queueRef.current = [];
      setRevealSignal(null);
    }
  }, [userId]);

  return { revealSignal, clearReveal };
}
