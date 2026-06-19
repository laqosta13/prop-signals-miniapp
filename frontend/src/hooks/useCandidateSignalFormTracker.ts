import { useEffect, useMemo, useState } from "react";
import { fetchCultCandidateFormSnapshot } from "../api";
import type { TrackerSnapshot } from "./useAdminTrackerSnapshot";
import { useSignalFormLimitsState } from "./signalFormLimitsState";

type StakeSync = {
  risk: string;
  setRisk: (value: string) => void;
};

type LeverageSync = {
  leverage: string;
  setLeverage: (value: string) => void;
};

function cultSnapshotToTrackerSnapshot(
  snap: Awaited<ReturnType<typeof fetchCultCandidateFormSnapshot>>,
): TrackerSnapshot {
  return {
    trackerConfigured: false,
    balance: snap.balance,
    accountSize: snap.account_size,
    dailyLossPct: 0,
    dailyLossUsd: snap.daily_loss_usd ?? 0,
    maxDailyLossPct: 5,
    dailyTradesCount: snap.daily_trades_count,
    dailyTradesLimit: snap.daily_trades_limit,
    currentRankId: snap.current_rank_id,
    currentRankName: snap.current_rank_name,
    rankMaxStakePct: snap.rank_max_stake_pct,
    rankMaxLeverage: snap.rank_max_leverage ?? 1,
    dailyStopReservedRankPct: snap.daily_stop_reserved_rank_pct ?? 0,
    dailyStopRemainingRankPct: snap.daily_stop_remaining_rank_pct ?? 2,
    stakePoolBurnedPct: snap.stake_pool_burned_pct ?? 0,
    stakePoolCapacityPct: snap.stake_pool_capacity_pct ?? 100,
    stakePoolUsedPct: snap.stake_pool_used_pct,
    stakePoolRemainingPct: snap.stake_pool_remaining_pct,
    rankEntryLocked: snap.rank_entry_locked ?? false,
    maxStakePct: snap.max_stake_pct,
  };
}

export function useCandidateSignalFormTracker(
  enabled: boolean,
  stake: StakeSync,
  leverageSync: LeverageSync,
  excludeSignalId?: number,
) {
  const [trackerSnap, setTrackerSnap] = useState<TrackerSnapshot | null>(null);
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
        if (!cancelled) setTrackerSnap(cultSnapshotToTrackerSnapshot(d));
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

  const limits = useSignalFormLimitsState(
    enabled,
    trackerSnap,
    trackerLoading,
    stake,
    leverageSync,
    excludeSignalId,
  );

  return useMemo(
    () => ({
      ...limits,
      trackerSnapshot: trackerSnap,
      trackerSnap: trackerSnap
        ? {
            balance: trackerSnap.balance,
            account_size: trackerSnap.accountSize,
            daily_loss_usd: trackerSnap.dailyLossUsd,
            daily_trades_count: trackerSnap.dailyTradesCount,
            daily_trades_limit: trackerSnap.dailyTradesLimit,
            current_rank_id: trackerSnap.currentRankId,
            current_rank_name: trackerSnap.currentRankName,
            rank_max_stake_pct: trackerSnap.rankMaxStakePct,
            rank_max_leverage: trackerSnap.rankMaxLeverage,
            daily_stop_reserved_rank_pct: trackerSnap.dailyStopReservedRankPct,
            daily_stop_remaining_rank_pct: trackerSnap.dailyStopRemainingRankPct,
            stake_pool_burned_pct: trackerSnap.stakePoolBurnedPct,
            stake_pool_capacity_pct: trackerSnap.stakePoolCapacityPct,
            stake_pool_used_pct: trackerSnap.stakePoolUsedPct,
            stake_pool_remaining_pct: trackerSnap.stakePoolRemainingPct,
            rank_entry_locked: trackerSnap.rankEntryLocked,
            max_stake_pct: trackerSnap.maxStakePct,
          }
        : null,
    }),
    [limits, trackerSnap],
  );
}
