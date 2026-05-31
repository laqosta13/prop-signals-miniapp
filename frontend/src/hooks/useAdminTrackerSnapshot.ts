import { useEffect, useState } from "react";
import { fetchMyTracker } from "../api";

export type TrackerSnapshot = {
  balance: number;
  accountSize: number;
  dailyLossPct: number;
  maxDailyLossPct: number;
  dailyTradesCount: number;
  dailyTradesLimit: number;
};

export function useAdminTrackerSnapshot(enabled: boolean) {
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
    void fetchMyTracker()
      .then((d) => {
        if (!cancelled) {
          setSnapshot({
            balance: d.balance,
            accountSize: d.account_size,
            dailyLossPct: d.daily_loss_pct,
            maxDailyLossPct: d.max_daily_loss_pct,
            dailyTradesCount: d.daily_trades_count,
            dailyTradesLimit: d.daily_trades_limit,
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
  }, [enabled]);

  return { snapshot, loading };
}
