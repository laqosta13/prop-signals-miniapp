const KEY = "prop_outcome_reveal_v1";
const SEED_KEY = "prop_outcome_reveal_seeded_v1";

function parseApiDateMs(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = raw.trim();
  const hasTz = /(?:[zZ]|[+\-]\d{2}:\d{2})$/.test(s);
  const ms = new Date(hasTz ? s : `${s}Z`).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function isTerminalOutcomeStatus(status: string): boolean {
  return status === "win" || status === "lose";
}

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

export function hasOutcomeRevealSeeded(userId: number): boolean {
  try {
    return localStorage.getItem(`${SEED_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

function markOutcomeRevealSeeded(userId: number): void {
  localStorage.setItem(`${SEED_KEY}:${userId}`, "1");
}

/** При первом заходе помечаем уже закрытые сигналы — без анимации на истории. */
export function seedPlayedOutcomesForExistingFeed(
  userId: number,
  signals: { id: number; status: string; closed_at: string | null; created_at: string }[],
  memberSinceMs: number,
): void {
  if (hasOutcomeRevealSeeded(userId)) return;
  const played = loadPlayedOutcomeIds(userId);
  let changed = false;
  for (const s of signals) {
    if (isOutcomeRevealEligible(s.status, s.closed_at, played, memberSinceMs, s.id)) {
      played.add(s.id);
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(`${KEY}:${userId}`, JSON.stringify([...played]));
  }
  markOutcomeRevealSeeded(userId);
}

export function parseMemberSinceMs(memberSince: string | null | undefined): number | null {
  if (!memberSince) return null;
  const ms = parseApiDateMs(memberSince);
  return ms > 0 ? ms : null;
}

export function signalClosedAtMs(closedAt: string | null | undefined): number {
  if (!closedAt) return 0;
  const ms = parseApiDateMs(closedAt);
  return ms > 0 ? ms : 0;
}

/** Анимация только для win/lose, закрытых после регистрации пользователя. */
export function isOutcomeRevealEligible(
  status: string,
  closedAt: string | null | undefined,
  played: Set<number>,
  memberSinceMs: number | null,
  signalId: number,
): boolean {
  if (!isTerminalOutcomeStatus(status)) return false;
  if (played.has(signalId)) return false;
  if (memberSinceMs == null) return false;
  const closedMs = signalClosedAtMs(closedAt);
  if (!closedMs) return false;
  return closedMs >= memberSinceMs;
}
