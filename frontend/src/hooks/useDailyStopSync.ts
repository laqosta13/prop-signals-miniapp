import { useEffect } from "react";
import {
  accountRiskPctFromPriceStop,
  maxPriceStopPctFromAccountRemaining,
} from "../utils/signalFormLimits";
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
    const account = accountRiskPctFromPriceStop(
      parseRiskPctValue(riskPct),
      balanceUsd,
      stakePct,
      leverage,
    );
    if (account > dailyRemaining + 0.005) {
      const pricePct = maxPriceStopPctFromAccountRemaining(
        dailyRemaining,
        balanceUsd,
        stakePct,
        leverage,
      );
      if (pricePct > 0) {
        onRiskPctChange(formatRiskPct(Math.max(STOP_OFFSET_MIN_PCT, pricePct)));
      }
    }
  }, [enabled, dailyRemaining, balanceUsd, stakePct, leverage, riskPct, onRiskPctChange]);

  return {
    dailyRemaining,
    dailyLossPct: dailyLossPct ?? 0,
    blocked,
  };
}
