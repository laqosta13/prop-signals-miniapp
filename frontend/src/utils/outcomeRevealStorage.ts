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

export function parseMemberSinceMs(memberSince: string | null | undefined): number | null {
  if (!memberSince) return null;
  const ms = new Date(memberSince).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function signalClosedAtMs(closedAt: string | null | undefined, createdAt: string): number {
  const raw = closedAt || createdAt;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Анимация только для win/lose, закрытых после регистрации пользователя в приложении. */
export function isOutcomeRevealEligible(
  status: string,
  signalId: number,
  closedAt: string | null | undefined,
  createdAt: string,
  played: Set<number>,
  memberSinceMs: number | null,
): boolean {
  if (status !== "win" && status !== "lose") return false;
  if (played.has(signalId)) return false;
  if (memberSinceMs == null) return true;
  return signalClosedAtMs(closedAt, createdAt) >= memberSinceMs;
}
