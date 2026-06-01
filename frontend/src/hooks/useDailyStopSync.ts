import { useEffect } from "react";
import {
  accountRiskToPriceStopPct,
  ACCOUNT_STOP_MIN_STEP,
  dailyStopRemainingPct,
  priceStopToAccountRiskPct,
} from "../utils/dailyStopLimit";
import { formatRiskPct, parseRiskPctValue, STOP_OFFSET_MIN_PCT } from "../utils/signalLevels";

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
  const blocked = dailyRemaining !== undefined && dailyRemaining < ACCOUNT_STOP_MIN_STEP;

  useEffect(() => {
    if (!enabled || dailyRemaining === undefined || dailyRemaining < ACCOUNT_STOP_MIN_STEP) return;
    const account = priceStopToAccountRiskPct(parseRiskPctValue(riskPct), stakePct, leverage);
    if (account > dailyRemaining + 0.005) {
      const pricePct = accountRiskToPriceStopPct(dailyRemaining, stakePct, leverage);
      if (pricePct > 0) {
        onRiskPctChange(formatRiskPct(Math.max(STOP_OFFSET_MIN_PCT, pricePct)));
      }
    }
  }, [enabled, dailyRemaining, stakePct, leverage, riskPct, onRiskPctChange]);

  return {
    dailyRemaining,
    dailyLossPct: dailyLossPct ?? 0,
    blocked,
  };
}
