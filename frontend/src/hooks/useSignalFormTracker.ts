import { useEffect } from "react";
import { useAdminTrackerSnapshot } from "./useAdminTrackerSnapshot";
import { useDailyStopSync } from "./useDailyStopSync";
import { entryNominalUsd, formatRiskPercent, parseLeverage, parseRiskPercent } from "../utils/signalForm";
import {
  dailyTradingBlocked,
  dailyTradesRemaining,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../utils/dailyStopLimit";

type LevelsSync = {
  riskPct: string;
  onRiskPctChange: (value: string) => void;
};

type StakeSync = {
  risk: string;
  setRisk: (value: string) => void;
};

export function useSignalFormTracker(
  enabled: boolean,
  levels: LevelsSync,
  stake: StakeSync,
  leverage: string,
  excludeSignalId?: number,
) {
  const { snapshot: trackerSnap, loading: trackerLoading } = useAdminTrackerSnapshot(
    enabled,
    excludeSignalId,
  );

  const maxStakePct = trackerSnap?.maxStakePct ?? 100;
  const stakePoolBlocked = enabled && !trackerLoading && maxStakePct <= 0;
  const stakePct = parseRiskPercent(stake.risk);
  const lev = parseLeverage(leverage);

  useEffect(() => {
    if (!enabled || trackerLoading || trackerSnap == null) return;
    if (parseRiskPercent(stake.risk) > trackerSnap.maxStakePct) {
      stake.setRisk(formatRiskPercent(Math.max(0, trackerSnap.maxStakePct)));
    }
  }, [enabled, trackerLoading, trackerSnap, stake.risk, stake.setRisk]);

  const balanceUsd =
    trackerSnap && trackerSnap.balance > 0 ? trackerSnap.balance : (trackerSnap?.accountSize ?? 0);

  const { dailyRemaining, dailyLossPct, blocked: dailyStopBlocked } = useDailyStopSync({
    enabled: enabled && !trackerLoading,
    riskPct: levels.riskPct,
    onRiskPctChange: levels.onRiskPctChange,
    dailyLossPct: trackerSnap?.dailyLossPct,
    balanceUsd,
    stakePct,
    leverage: lev,
  });

  const dailyTradesCount = trackerSnap?.dailyTradesCount ?? 0;
  const dailyTradesLimit = trackerSnap?.dailyTradesLimit ?? SIGNAL_DAILY_TRADE_LIMIT;
  const dailyLimit = dailyTradingBlocked({
    dailyLossPct,
    dailyTradesCount,
    dailyTradesLimit,
  });

  return {
    trackerSnap,
    trackerLoading,
    maxStakePct,
    stakePoolBlocked,
    stakePct,
    lev,
    dailyRemaining,
    dailyLossPct,
    dailyStopBlocked,
    dailyLimit,
    dailyTradesRemainingCount: dailyTradesRemaining(dailyTradesCount, dailyTradesLimit),
    dailyTradesLimit,
    balanceForNominal: (fallbackAccountSize = 0) => {
      const balance = trackerSnap?.balance ?? 0;
      return balance > 0 ? balance : trackerSnap?.accountSize ?? fallbackAccountSize;
    },
    stakeUsd: (balance: number) => entryNominalUsd(balance, stakePct, lev),
  };
}
