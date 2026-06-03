import { useEffect, useState } from "react";
import { fetchMyTracker } from "../api";

export type TrackerSnapshot = {
  balance: number;
  accountSize: number;
  dailyLossPct: number;
  dailyLossUsd: number;
  maxDailyLossPct: number;
  dailyTradesCount: number;
  dailyTradesLimit: number;
  currentRankId: number;
  currentRankName: string;
  rankMaxStakePct: number;
  rankMaxLeverage: number;
  dailyStopReservedRankPct: number;
  dailyStopRemainingRankPct: number;
  stakePoolUsedPct: number;
  stakePoolRemainingPct: number;
  maxStakePct: number;
};

export function useAdminTrackerSnapshot(enabled: boolean, excludeSignalId?: number) {
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMyTracker(excludeSignalId)
      .then((d) => {
        if (!cancelled) {
          setSnapshot({
            balance: d.balance,
            accountSize: d.account_size,
            dailyLossPct: d.daily_loss_pct,
            dailyLossUsd: d.daily_loss_usd ?? 0,
            maxDailyLossPct: d.max_daily_loss_pct,
            dailyTradesCount: d.daily_trades_count,
            dailyTradesLimit: d.daily_trades_limit,
            currentRankId: d.current_rank_id,
            currentRankName: d.current_rank_name,
            rankMaxStakePct: d.rank_max_stake_pct,
            rankMaxLeverage: d.rank_max_leverage ?? 1,
            dailyStopReservedRankPct: d.daily_stop_reserved_rank_pct ?? 0,
            dailyStopRemainingRankPct: d.daily_stop_remaining_rank_pct ?? 2,
            stakePoolUsedPct: d.stake_pool_used_pct,
            stakePoolRemainingPct: d.stake_pool_remaining_pct,
            maxStakePct: d.max_stake_pct,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, excludeSignalId]);

  return { snapshot, loading };
}
