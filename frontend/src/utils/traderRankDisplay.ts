import type { Trader } from "../api";

export function traderClosedDealsCount(trader: { wins: number; losses: number }): number {
  return (trader.wins ?? 0) + (trader.losses ?? 0);
}

/** Ранг на карточке: volnovoi — по результатам; трейдеры — «В рынке» с нуля. */
export function shouldShowTraderRankBadge(trader: Trader): boolean {
  return trader.trader_rank != null;
}

export function traderRankAvatarId(trader: Trader): number | undefined {
  if (!shouldShowTraderRankBadge(trader)) return undefined;
  return trader.trader_rank?.current_rank_id;
}
