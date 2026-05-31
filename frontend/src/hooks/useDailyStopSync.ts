import { useEffect } from "react";
import {
  accountRiskToPriceStopPct,
  dailyStopRemainingPct,
  priceStopToAccountRiskPct,
} from "../utils/dailyStopLimit";
import { formatRiskPct, parseRiskPctValue } from "../utils/signalLevels";

export function useDailyStopSync(opts: {
  enabled: boolean;
  riskPct: string;
  onRiskPctChange: (value: string) => void;
  dailyLossPct: number | undefined;
  stakePct: number;
  leverage: number;
}) {
  const { enabled, riskPct, onRiskPctChange, dailyLossPct, stakePct, leverage } = opts;
  const dailyRemaining =
    dailyLossPct !== undefined ? dailyStopRemainingPct(dailyLossPct) : undefined;
  const blocked = dailyRemaining !== undefined && dailyRemaining < 0.1;

  useEffect(() => {
    if (!enabled || dailyRemaining === undefined || dailyRemaining < 0.1) return;
    const account = priceStopToAccountRiskPct(parseRiskPctValue(riskPct), stakePct, leverage);
    if (account > dailyRemaining + 0.01) {
      const pricePct = accountRiskToPriceStopPct(dailyRemaining, stakePct, leverage);
      if (pricePct > 0) {
        onRiskPctChange(formatRiskPct(Math.max(0.1, pricePct)));
      }
    }
  }, [enabled, dailyRemaining, stakePct, leverage, riskPct, onRiskPctChange]);

  return {
    dailyRemaining,
    dailyLossPct: dailyLossPct ?? 0,
    blocked,
  };
}

export function preserveAccountStopOnLeverageChange(opts: {
  riskPct: string;
  prevStakePct: number;
  prevLeverage: number;
  nextStakePct: number;
  nextLeverage: number;
  dailyRemaining: number;
}): string | null {
  const account = priceStopToAccountRiskPct(
    parseRiskPctValue(opts.riskPct),
    opts.prevStakePct,
    opts.prevLeverage,
  );
  const clamped = Math.min(account, Math.max(0, opts.dailyRemaining));
  if (clamped < 0.1) return null;
  const pricePct = accountRiskToPriceStopPct(clamped, opts.nextStakePct, opts.nextLeverage);
  return pricePct > 0 ? formatRiskPct(Math.max(0.1, pricePct)) : null;
}
