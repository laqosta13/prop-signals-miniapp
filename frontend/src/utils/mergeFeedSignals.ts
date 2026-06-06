import type { Signal } from "../api";
import { parseApiDate } from "../utils";
import { sortFeedSignals } from "./sortFeedSignals";

function mergeClosedSignal(local: Signal, remote: Signal): Signal {
  return {
    ...remote,
    closed_at: remote.closed_at ?? local.closed_at,
    closed_exit_price: remote.closed_exit_price ?? local.closed_exit_price,
    realized_pnl: remote.realized_pnl ?? local.realized_pnl,
    close_reason: remote.close_reason ?? local.close_reason,
    entry_filled_at: remote.entry_filled_at ?? local.entry_filled_at,
    views_count: Math.max(remote.views_count ?? 0, local.views_count ?? 0),
    likes_count: Math.max(remote.likes_count ?? 0, local.likes_count ?? 0),
    liked_by_me: remote.liked_by_me ?? local.liked_by_me,
  };
}

/** Не откатывать локально закрытый сигнал из-за устаревшего poll/refetch. */
export function mergeFeedSignals(prev: Signal[], next: Signal[]): Signal[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const merged = next.map((remote) => {
    const local = prevById.get(remote.id);
    if (!local) return remote;

    const localClosed = local.status === "win" || local.status === "lose";
    const remoteClosed = remote.status === "win" || remote.status === "lose";
    if (localClosed && !remoteClosed) return local;

    if (localClosed && remoteClosed && local.closed_at && remote.closed_at) {
      const localMs = parseApiDate(local.closed_at).getTime();
      const remoteMs = parseApiDate(remote.closed_at).getTime();
      if (Number.isFinite(localMs) && Number.isFinite(remoteMs) && localMs > remoteMs) {
        return mergeClosedSignal(remote, local);
      }
    }

    if (remoteClosed) return mergeClosedSignal(local, remote);
    return {
      ...remote,
      views_count: Math.max(remote.views_count ?? 0, local.views_count ?? 0),
      likes_count: Math.max(remote.likes_count ?? 0, local.likes_count ?? 0),
      liked_by_me: remote.liked_by_me ?? local.liked_by_me,
    };
  });
  return sortFeedSignals(merged);
}
