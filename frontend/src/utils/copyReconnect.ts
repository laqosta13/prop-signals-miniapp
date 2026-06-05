export function copyReconnectBlocked(until: string | null | undefined): boolean {
  if (!until) return false;
  const ts = Date.parse(until);
  return Number.isFinite(ts) && ts > Date.now();
}
