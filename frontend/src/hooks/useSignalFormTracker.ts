import { useEffect, useMemo } from "react";
import { useAdminTrackerSnapshot } from "./useAdminTrackerSnapshot";
import { useDailyStopSync } from "./useDailyStopSync";
import { dailyStopRemainingRankPct, dailyTradingBlocked, dailyTradesRemaining, rankNominalUsd, SIGNAL_DAILY_TRADE_LIMIT } from "../utils/dailyStopLimit";
import { entryNominalUsd, formatRiskPercent, parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { dailyStopRemainingForForm, type RankDailyStopContext } from "../utils/signalFormLimits";

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

  const rankMaxStakePct = trackerSnap?.rankMaxStakePct ?? 0;
  const dailyLossUsd = trackerSnap?.dailyLossUsd ?? 0;

  const rankNominal = useMemo(
    () => rankNominalUsd(balanceUsd, rankMaxStakePct, lev),
    [balanceUsd, rankMaxStakePct, lev],
  );

  const dailyRemainingRank = useMemo(
    () => dailyStopRemainingRankPct(dailyLossUsd, rankNominal),
    [dailyLossUsd, rankNominal],
  );

  const rankStopCtx: RankDailyStopContext = useMemo(
    () => ({
      dailyLossUsd,
      balanceUsd,
      rankMaxStakePct,
      stakePct,
      leverage: lev,
    }),
    [dailyLossUsd, balanceUsd, rankMaxStakePct, stakePct, lev],
  );

  const { dailyRemaining, blocked: dailyStopBlocked } = useDailyStopSync({
    enabled: enabled && !trackerLoading,
    riskPct: levels.riskPct,
    onRiskPctChange: levels.onRiskPctChange,
    dailyLossUsd,
    balanceUsd,
    rankMaxStakePct,
    stakePct,
    leverage: lev,
    dailyRemainingRankPct: dailyRemainingRank,
  });

  const dailyTradesCount = trackerSnap?.dailyTradesCount ?? 0;
  const dailyTradesLimit = trackerSnap?.dailyTradesLimit ?? SIGNAL_DAILY_TRADE_LIMIT;
  const dailyLimit = dailyTradingBlocked({
    dailyLossUsd,
    rankNominalUsd: rankNominal,
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
    rankNominal,
    rankMaxStakePct,
    dailyLossUsd,
    dailyRemaining,
    dailyRemainingRank,
    dailyStopBlocked,
    dailyLimit,
    dailyTradesRemainingCount: dailyTradesRemaining(dailyTradesCount, dailyTradesLimit),
    dailyTradesLimit,
    rankStopCtx,
    dailyStopRemainingForForm: () => dailyStopRemainingForForm(rankStopCtx),
    balanceForNominal: (fallbackAccountSize = 0) => {
      const balance = trackerSnap?.balance ?? 0;
      return balance > 0 ? balance : trackerSnap?.accountSize ?? fallbackAccountSize;
    },
    stakeUsd: (balance: number) => entryNominalUsd(balance, stakePct, lev),
  };
}
