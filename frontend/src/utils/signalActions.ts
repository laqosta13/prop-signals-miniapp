import type { Signal } from "../api";

export function isSignalAuthor(s: Signal, myId: number | null | undefined): boolean {
  return myId != null && s.author_telegram_id === myId;
}

/** Редактирование и удаление — только свои сигналы, до срабатывания лимитного входа. */
export function canEditOrDeleteSignal(s: Signal, myId: number | null | undefined, isAdmin: boolean): boolean {
  return isAdmin && isSignalAuthor(s, myId) && s.status === "active" && !s.entry_filled_at && !!(s.entry_low || s.entry_high);
}

/** Дополнение — только свои сигналы, после входа в сделку. */
export function canSupplementSignal(s: Signal, myId: number | null | undefined, isAdmin: boolean): boolean {
  return canCloseAtMarketSignal(s, myId, isAdmin);
}

/** Закрытие по рынку — только свои активные сигналы после входа. */
export function canCloseAtMarketSignal(s: Signal, myId: number | null | undefined, isAdmin: boolean): boolean {
  if (!isAdmin || !isSignalAuthor(s, myId)) return false;
  if (s.status !== "active") return false;
  if (s.entry_filled_at) return true;
  return !s.entry_low && !s.entry_high;
}

/** Подписка или админ — доступ к активным сигналам и лайкам/просмотрам. */
export function canViewActiveSignals(subscriptionActive: boolean, isAdmin: boolean): boolean {
  return subscriptionActive || isAdmin;
}

/** Лента: без подписки — только win/lose (двойная защита поверх API /signals/preview). */
export function visibleFeedSignals(signals: Signal[], subscriptionActive: boolean, isAdmin: boolean): Signal[] {
  if (canViewActiveSignals(subscriptionActive, isAdmin)) return signals;
  return signals.filter((s) => s.status === "win" || s.status === "lose");
}
