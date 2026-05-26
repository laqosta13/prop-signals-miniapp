const KEY = "prop_outcome_reveal_v1";

export function loadPlayedOutcomeIds(userId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`${KEY}:${userId}`);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as number[];
    return new Set(ids.filter((n) => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

export function markOutcomeRevealPlayed(userId: number, signalId: number): void {
  const played = loadPlayedOutcomeIds(userId);
  played.add(signalId);
  localStorage.setItem(`${KEY}:${userId}`, JSON.stringify([...played]));
}
