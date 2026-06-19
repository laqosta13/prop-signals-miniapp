import type { Trader } from "../api";

/** Сводный аккаунт volnovoi в ТОПе — все сделки админов. */
export const VOLNOVOI_TELEGRAM_ID = 0;
export const VOLNOVOI_CAPITAL_USD = 100_000;
export const VOLNOVOI_AVATAR_URL = "/avatars/volnovoi.png";

export function isVolnovoiTrader(trader: Pick<Trader, "telegram_id" | "is_aggregate">): boolean {
  return trader.is_aggregate === true || trader.telegram_id === VOLNOVOI_TELEGRAM_ID;
}
