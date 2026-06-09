import type { Trader } from "../api";
import { isVolnovoiTrader } from "./volnovoi";

export function traderClosedDealsCount(trader: { wins: number; losses: number }): number {
  return (trader.wins ?? 0) + (trader.losses ?? 0);
}

/** Ранг на карточке: volnovoi — онлайн; трейдеры — только после закрытых сделок. */
export function shouldShowTraderRankBadge(trader: Trader): boolean {
  if (isVolnovoiTrader(trader)) {
    return trader.trader_rank != null;
  }
  return trader.trader_rank != null && traderClosedDealsCount(trader) > 0;
}

export function traderRankAvatarId(trader: Trader): number | undefined {
  if (!shouldShowTraderRankBadge(trader)) return undefined;
  return trader.trader_rank?.current_rank_id;
}
