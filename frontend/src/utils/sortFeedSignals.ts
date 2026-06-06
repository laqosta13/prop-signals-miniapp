import type { Signal } from "../api";
import { parseApiDate } from "../utils";

function signalSortKey(s: Signal): number {
  return s.number ?? s.id;
}

/** Активные сверху (#N ↓, затем время); закрытые — по номеру и дате публикации. */
export function sortFeedSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    const aActive = a.status === "active";
    const bActive = b.status === "active";
    if (aActive !== bActive) return aActive ? -1 : 1;

    const numDiff = signalSortKey(b) - signalSortKey(a);
    if (numDiff !== 0) return numDiff;

    const aMs = parseApiDate(a.created_at).getTime();
    const bMs = parseApiDate(b.created_at).getTime();
    if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) return bMs - aMs;
    return b.id - a.id;
  });
}

export function splitFeedSignals(signals: Signal[]): { active: Signal[]; closed: Signal[] } {
  const active: Signal[] = [];
  const closed: Signal[] = [];
  for (const s of sortFeedSignals(signals)) {
    if (s.status === "active") active.push(s);
    else closed.push(s);
  }
  return { active, closed };
}
