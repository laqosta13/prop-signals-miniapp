import { useEffect } from "react";
import {
  ACCOUNT_STOP_MIN_STEP,
  maxPriceStopPctFromRankDailyBudget,
} from "../utils/dailyStopLimit";
import { formatRiskPct, parseRiskPctValue, STOP_OFFSET_MIN_PCT } from "../utils/signalLevels";

export function useDailyStopSync(opts: {
  enabled: boolean;
  riskPct: string;
  onRiskPctChange: (value: string) => void;
  dailyLossUsd: number;
  balanceUsd: number;
  rankMaxStakePct: number;
  stakePct: number;
  leverage: number;
  dailyRemainingRankPct: number;
}) {
  const {
    enabled,
    riskPct,
    onRiskPctChange,
    dailyLossUsd,
    balanceUsd,
    rankMaxStakePct,
    stakePct,
    leverage,
    dailyRemainingRankPct,
  } = opts;

  const blocked = dailyRemainingRankPct < ACCOUNT_STOP_MIN_STEP;

  useEffect(() => {
    if (!enabled || blocked || balanceUsd <= 0 || rankMaxStakePct <= 0 || stakePct <= 0) return;
    const price = parseRiskPctValue(riskPct);
    const maxPrice = maxPriceStopPctFromRankDailyBudget(
      dailyLossUsd,
      balanceUsd,
      rankMaxStakePct,
      stakePct,
      leverage,
    );
    if (maxPrice > STOP_OFFSET_MIN_PCT && price > maxPrice + 0.005) {
      onRiskPctChange(formatRiskPct(maxPrice));
    }
  }, [
    enabled,
    blocked,
    dailyLossUsd,
    balanceUsd,
    rankMaxStakePct,
    stakePct,
    leverage,
    riskPct,
    onRiskPctChange,
  ]);

  return {
    dailyRemaining: dailyRemainingRankPct,
    blocked,
  };
}
