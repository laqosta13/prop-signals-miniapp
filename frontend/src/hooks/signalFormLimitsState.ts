import { useEffect, useMemo } from "react";
import type { TrackerSnapshot } from "./useAdminTrackerSnapshot";
import {
  ACCOUNT_STOP_MIN_STEP,
  dailyStopRemainingRankPct,
  dailyTradingBlocked,
  dailyTradesRemaining,
  rankNominalForDailyStopLimit,
  rankNominalUsd,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../utils/dailyStopLimit";
import { entryNominalUsd, formatRiskPercent, parseLeverage, parseRiskPercent } from "../utils/signalForm";

type StakeSync = {
  risk: string;
  setRisk: (value: string) => void;
};

type LeverageSync = {
  leverage: string;
  setLeverage: (value: string) => void;
};

export function useSignalFormLimitsState(
  enabled: boolean,
  trackerSnap: TrackerSnapshot | null,
  trackerLoading: boolean,
  stake: StakeSync,
  leverageSync: LeverageSync,
  excludeSignalId?: number,
) {
  const trackerConfigured = trackerSnap?.trackerConfigured ?? false;
  const maxStakePct = trackerSnap?.maxStakePct ?? 100;
  const rankMaxLeverage = trackerSnap?.rankMaxLeverage ?? 1;
  const rankEntryLocked = trackerSnap?.rankEntryLocked ?? false;
  const rankEntryBlocksNew = rankEntryLocked && excludeSignalId == null;
  const stakePoolBlocked =
    enabled && !trackerLoading && trackerSnap != null && (rankEntryBlocksNew || maxStakePct <= 0);
  const stakePct = parseRiskPercent(stake.risk);
  const lev = Math.min(parseLeverage(leverageSync.leverage), rankMaxLeverage);

  useEffect(() => {
    if (!enabled || trackerLoading || trackerSnap == null) return;
    if (parseRiskPercent(stake.risk) > trackerSnap.maxStakePct) {
      stake.setRisk(formatRiskPercent(Math.max(0, trackerSnap.maxStakePct)));
    }
  }, [enabled, trackerLoading, trackerSnap, stake.risk, stake.setRisk]);

  useEffect(() => {
    if (!enabled || trackerLoading || trackerSnap == null) return;
    if (parseLeverage(leverageSync.leverage) > trackerSnap.rankMaxLeverage) {
      leverageSync.setLeverage(String(trackerSnap.rankMaxLeverage));
    }
  }, [enabled, trackerLoading, trackerSnap, leverageSync.leverage, leverageSync.setLeverage]);

  const balanceUsd =
    trackerSnap && trackerSnap.balance > 0 ? trackerSnap.balance : (trackerSnap?.accountSize ?? 0);

  const rankMaxStakePct = trackerSnap?.rankMaxStakePct ?? 0;
  const dailyLossUsd = trackerSnap?.dailyLossUsd ?? 0;

  const rankNominal = useMemo(
    () => rankNominalUsd(balanceUsd, rankMaxStakePct, lev),
    [balanceUsd, rankMaxStakePct, lev],
  );

  const rankNominalForDailyStop = useMemo(
    () => rankNominalForDailyStopLimit(balanceUsd, rankMaxStakePct),
    [balanceUsd, rankMaxStakePct],
  );

  const dailyRemainingRank = useMemo(() => {
    if (trackerSnap?.dailyStopRemainingRankPct != null) {
      return trackerSnap.dailyStopRemainingRankPct;
    }
    return dailyStopRemainingRankPct(dailyLossUsd, rankNominalForDailyStop);
  }, [trackerSnap?.dailyStopRemainingRankPct, dailyLossUsd, rankNominalForDailyStop]);

  const dailyTradesCount = trackerSnap?.dailyTradesCount ?? 0;
  const dailyTradesLimit = trackerSnap?.dailyTradesLimit ?? SIGNAL_DAILY_TRADE_LIMIT;
  const dailyLimit = dailyTradingBlocked({
    dailyLossUsd,
    rankNominalUsd: rankNominalForDailyStop,
    dailyTradesCount,
    dailyTradesLimit,
    dailyStopRemainingRankPct: trackerSnap?.dailyStopRemainingRankPct,
  });
  const dailyStopBlocked = dailyRemainingRank < ACCOUNT_STOP_MIN_STEP;

  return {
    trackerSnap,
    trackerConfigured,
    trackerLoading,
    maxStakePct,
    rankMaxLeverage,
    stakePoolBlocked,
    rankEntryLocked,
    rankEntryBlocksNew,
    stakePct,
    lev,
    rankNominal,
    rankMaxStakePct,
    dailyLossUsd,
    dailyRemaining: dailyRemainingRank,
    dailyRemainingRank,
    dailyStopReservedRank: trackerSnap?.dailyStopReservedRankPct ?? 0,
    dailyStopBlocked,
    dailyLimit,
    dailyTradesRemainingCount: dailyTradesRemaining(dailyTradesCount, dailyTradesLimit),
    dailyTradesLimit,
    balanceForNominal: (fallbackAccountSize = 0) => {
      const balance = trackerSnap?.balance ?? 0;
      return balance > 0 ? balance : trackerSnap?.accountSize ?? fallbackAccountSize;
    },
    stakeUsd: (balance: number) => entryNominalUsd(balance, stakePct, lev),
    rankNominalForDailyStop,
  };
}
