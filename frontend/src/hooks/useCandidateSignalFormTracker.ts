import { useEffect, useMemo, useState } from "react";
import { fetchCultCandidateFormSnapshot, type CultCandidateFormSnapshot } from "../api";
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

export function useCandidateSignalFormTracker(
  enabled: boolean,
  stake: StakeSync,
  leverageSync: LeverageSync,
  excludeSignalId?: number,
) {
  const [trackerSnap, setTrackerSnap] = useState<CultCandidateFormSnapshot | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTrackerSnap(null);
      setTrackerLoading(false);
      return;
    }
    let cancelled = false;
    setTrackerLoading(true);
    void fetchCultCandidateFormSnapshot(excludeSignalId)
      .then((d) => {
        if (!cancelled) setTrackerSnap(d);
      })
      .catch(() => {
        if (!cancelled) setTrackerSnap(null);
      })
      .finally(() => {
        if (!cancelled) setTrackerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, excludeSignalId]);

  const maxStakePct = trackerSnap?.max_stake_pct ?? 100;
  const rankMaxLeverage = trackerSnap?.rank_max_leverage ?? 1;
  const stakePoolBlocked = enabled && !trackerLoading && maxStakePct <= 0;
  const stakePct = parseRiskPercent(stake.risk);
  const lev = Math.min(parseLeverage(leverageSync.leverage), rankMaxLeverage);

  useEffect(() => {
    if (!enabled || trackerLoading || trackerSnap == null) return;
    if (parseRiskPercent(stake.risk) > trackerSnap.max_stake_pct) {
      stake.setRisk(formatRiskPercent(Math.max(0, trackerSnap.max_stake_pct)));
    }
  }, [enabled, trackerLoading, trackerSnap, stake.risk, stake.setRisk]);

  useEffect(() => {
    if (!enabled || trackerLoading || trackerSnap == null) return;
    if (parseLeverage(leverageSync.leverage) > trackerSnap.rank_max_leverage) {
      leverageSync.setLeverage(String(trackerSnap.rank_max_leverage));
    }
  }, [enabled, trackerLoading, trackerSnap, leverageSync.leverage, leverageSync.setLeverage]);

  const balanceUsd =
    trackerSnap && trackerSnap.balance > 0 ? trackerSnap.balance : (trackerSnap?.account_size ?? 0);

  const rankMaxStakePct = trackerSnap?.rank_max_stake_pct ?? 0;
  const dailyLossUsd = trackerSnap?.daily_loss_usd ?? 0;

  const rankNominal = useMemo(
    () => rankNominalUsd(balanceUsd, rankMaxStakePct, lev),
    [balanceUsd, rankMaxStakePct, lev],
  );

  const rankNominalForDailyStop = useMemo(
    () => rankNominalForDailyStopLimit(balanceUsd, rankMaxStakePct),
    [balanceUsd, rankMaxStakePct],
  );

  const dailyRemainingRank = useMemo(() => {
    if (trackerSnap?.daily_stop_remaining_rank_pct != null) {
      return trackerSnap.daily_stop_remaining_rank_pct;
    }
    return dailyStopRemainingRankPct(dailyLossUsd, rankNominalForDailyStop);
  }, [trackerSnap?.daily_stop_remaining_rank_pct, dailyLossUsd, rankNominalForDailyStop]);

  const dailyStopBlocked = dailyRemainingRank < ACCOUNT_STOP_MIN_STEP;

  const dailyTradesCount = trackerSnap?.daily_trades_count ?? 0;
  const dailyTradesLimit = trackerSnap?.daily_trades_limit ?? SIGNAL_DAILY_TRADE_LIMIT;
  const dailyLimit = dailyTradingBlocked({
    dailyLossUsd,
    rankNominalUsd: rankNominalForDailyStop,
    dailyTradesCount,
    dailyTradesLimit,
    dailyStopRemainingRankPct: trackerSnap?.daily_stop_remaining_rank_pct,
  });

  return {
    trackerSnap,
    trackerLoading,
    maxStakePct,
    rankMaxLeverage,
    stakePoolBlocked,
    stakePct,
    lev,
    rankNominal,
    rankMaxStakePct,
    dailyLossUsd,
    dailyRemaining: dailyRemainingRank,
    dailyRemainingRank,
    dailyStopReservedRank: trackerSnap?.daily_stop_reserved_rank_pct ?? 0,
    dailyStopBlocked,
    dailyLimit,
    dailyTradesRemainingCount: dailyTradesRemaining(dailyTradesCount, dailyTradesLimit),
    dailyTradesLimit,
    balanceForNominal: (fallbackAccountSize = 0) => {
      const balance = trackerSnap?.balance ?? 0;
      return balance > 0 ? balance : trackerSnap?.account_size ?? fallbackAccountSize;
    },
    stakeUsd: (balance: number) => entryNominalUsd(balance, stakePct, lev),
    rankNominalForDailyStop,
  };
}
