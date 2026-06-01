import { useEffect } from "react";
import {
  ACCOUNT_STOP_MIN_STEP,
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
  balanceUsd: number;
  stakePct: number;
  leverage: number;
}) {
  const { enabled, riskPct, onRiskPctChange, dailyLossPct, stakePct, leverage } = opts;
  const dailyRemaining =
    dailyLossPct !== undefined ? dailyStopRemainingPct(dailyLossPct) : undefined;
  const blocked = dailyRemaining !== undefined && dailyRemaining < ACCOUNT_STOP_MIN_STEP;

  useEffect(() => {
    if (!enabled || dailyRemaining === undefined || dailyRemaining < ACCOUNT_STOP_MIN_STEP) return;
    if (stakePct <= 0) return;
    const account = priceStopToAccountRiskPct(parseRiskPctValue(riskPct), stakePct, leverage);
    if (account > dailyRemaining + 0.005) {
      onRiskPctChange(formatRiskPct(accountRiskToPriceStopPct(dailyRemaining, stakePct, leverage)));
    }
  }, [enabled, dailyRemaining, stakePct, leverage, riskPct, onRiskPctChange]);

  return {
    dailyRemaining,
    dailyLossPct: dailyLossPct ?? 0,
    blocked,
  };
}
