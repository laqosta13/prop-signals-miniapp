import type { Signal } from "../api";

/** Редактирование и удаление — только до срабатывания лимитного входа. */
export function canEditOrDeleteSignal(s: Signal): boolean {
  return s.status === "active" && !s.entry_filled_at && !!(s.entry_low || s.entry_high);
}

/** Дополнение — после входа в сделку (активный сигнал в работе). */
export function canSupplementSignal(s: Signal): boolean {
  if (s.status !== "active") return false;
  if (s.entry_filled_at) return true;
  return !s.entry_low && !s.entry_high;
}
