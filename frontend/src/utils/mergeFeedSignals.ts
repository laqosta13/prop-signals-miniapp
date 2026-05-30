import type { Signal } from "../api";
import { parseApiDate } from "../utils";

/** Не откатывать локально закрытый сигнал из-за устаревшего poll/refetch. */
export function mergeFeedSignals(prev: Signal[], next: Signal[]): Signal[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  return next.map((remote) => {
    const local = prevById.get(remote.id);
    if (!local) return remote;

    const localClosed = local.status === "win" || local.status === "lose";
    const remoteClosed = remote.status === "win" || remote.status === "lose";
    if (localClosed && !remoteClosed) return local;

    if (localClosed && remoteClosed && local.closed_at && remote.closed_at) {
      const localMs = parseApiDate(local.closed_at).getTime();
      const remoteMs = parseApiDate(remote.closed_at).getTime();
      if (Number.isFinite(localMs) && Number.isFinite(remoteMs) && localMs > remoteMs) {
        return local;
      }
    }

    return remote;
  });
}
