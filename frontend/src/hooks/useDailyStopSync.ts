import { useEffect } from "react";
import { maxPriceStopPctForForm } from "../utils/signalFormLimits";
import { ACCOUNT_STOP_MIN_STEP } from "../utils/dailyStopLimit";
import { dailyStopRemainingPct } from "../utils/dailyStopLimit";
import { formatRiskPct, parseRiskPctValue, STOP_OFFSET_MIN_PCT } from "../utils/signalLevels";

export function useDailyStopSync(opts: {
  enabled: boolean;
  riskPct: string;
  onRiskPctChange: (value: string) => void;
  dailyLossPct: number | undefined;
  balanceUsd: number;
  stakePct: number;
  leverage: number;
}) {
  const { enabled, riskPct, onRiskPctChange, dailyLossPct, balanceUsd, stakePct, leverage } = opts;
  const dailyRemaining =
    dailyLossPct !== undefined ? dailyStopRemainingPct(dailyLossPct) : undefined;
  const blocked = dailyRemaining !== undefined && dailyRemaining < ACCOUNT_STOP_MIN_STEP;

  useEffect(() => {
    if (!enabled || dailyRemaining === undefined || dailyRemaining < ACCOUNT_STOP_MIN_STEP) return;
    if (balanceUsd <= 0 || stakePct <= 0) return;
    const price = parseRiskPctValue(riskPct);
    const maxPrice = maxPriceStopPctForForm(dailyLossPct, balanceUsd, stakePct, leverage);
    if (maxPrice > 0 && price > maxPrice + 0.005) {
      onRiskPctChange(formatRiskPct(Math.max(STOP_OFFSET_MIN_PCT, maxPrice)));
    }
  }, [enabled, dailyRemaining, dailyLossPct, balanceUsd, stakePct, leverage, riskPct, onRiskPctChange]);

  return {
    dailyRemaining,
    dailyLossPct: dailyLossPct ?? 0,
    blocked,
  };
}
