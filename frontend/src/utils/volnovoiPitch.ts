import type { Trader } from "../api";
import { formatUsd } from "../utils";
import { VOLNOVOI_CAPITAL_USD } from "./volnovoi";

export type VolnovoiPitch = {
  badgeLabel: string;
  headline: string;
  profitLine: string;
  depositLine: string;
  positive: boolean;
};

export function volnovoiCopyPitch(trader: Pick<Trader, "total_pnl_usd" | "rating_percent">): VolnovoiPitch {
  const pnl = trader.total_pnl_usd ?? 0;
  const pct = trader.rating_percent ?? 0;
  const positive = pnl >= 0;
  const pnlText = `${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}`;
  const pctText = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  const capital = VOLNOVOI_CAPITAL_USD.toLocaleString("en-US");

  return {
    badgeLabel: positive ? pnlText : "Копируй",
    headline: "Ваш профит",
    profitLine: `${pnlText} (${pctText})`,
    depositLine: `Если копируете volnovoi с депозитом $${capital}`,
    positive,
  };
}
