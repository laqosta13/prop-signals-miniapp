import { useMskDayCountdown } from "../../hooks/useMskDayCountdown";
import { useThemedCopy } from "../../hooks/useThemedCopy";
import {
  dailyLimitBlockedMessage,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../../utils/dailyStopLimit";
import { formatPoolChipPct, stakePoolBlockedMessage } from "../../utils/stakePool";

type Props = {
  active: boolean;
  loading?: boolean;
  trackerConfigured?: boolean;
  dailyRemaining?: number;
  dailyTradesRemaining: number;
  dailyTradesLimit?: number;
  stakePoolBurnedPct?: number;
  stakePoolUsedPct?: number;
  stakePoolRemainingPct?: number;
  dailyStopReservedRankPct?: number;
  dailyBlocked?: boolean;
  dailyBlockReason?: "stop" | "trades" | null;
  stakePoolBlocked?: boolean;
  rankEntryLocked?: boolean;
  rankMaxStakePct?: number;
  maxStakePct?: number;
};

export function SignalFormLimitsBar({
  active,
  loading = false,
  trackerConfigured = true,
  dailyRemaining,
  dailyTradesRemaining,
  dailyTradesLimit = SIGNAL_DAILY_TRADE_LIMIT,
  stakePoolBurnedPct = 0,
  stakePoolUsedPct,
  stakePoolRemainingPct,
  dailyStopReservedRankPct = 0,
  dailyBlocked = false,
  dailyBlockReason = null,
  stakePoolBlocked = false,
  rankEntryLocked = false,
  rankMaxStakePct = 0,
  maxStakePct = 0,
}: Props) {
  const copy = useThemedCopy();
  const { label: resetIn } = useMskDayCountdown(active && !loading);

  if (loading) {
    return (
      <aside className="signal-form__limits signal-form__limits--loading" aria-busy="true">
        {copy.signalLimits}
      </aside>
    );
  }

  const poolFree = stakePoolRemainingPct ?? 100;
  const inMarket = stakePoolUsedPct ?? 0;

  return (
    <aside className="signal-form__limits" aria-label="Лимиты дня">
      {!trackerConfigured ? (
        <p className="signal-form__limits-note meta">{copy.signalNoTrackerHint}</p>
      ) : null}
      <div className="signal-form__chips">
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">{copy.signalTrades}</span>
          <span className="signal-form__chip-v">
            {dailyTradesRemaining}
            <span className="signal-form__chip-dim">/{dailyTradesLimit}</span>
          </span>
        </div>
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">{copy.signalStopChip}</span>
          <span className="signal-form__chip-v">
            {formatPoolChipPct(dailyRemaining ?? 0)}
            <span className="signal-form__chip-dim">/{SIGNAL_DAILY_STOP_LIMIT_PCT}%</span>
          </span>
          {dailyStopReservedRankPct > 0 ? (
            <span className="signal-form__chip-sub">−{formatPoolChipPct(dailyStopReservedRankPct)}%</span>
          ) : null}
        </div>
        <div className="signal-form__chip signal-form__chip--wide">
          <span className="signal-form__chip-k">{copy.signalInMarket}</span>
          <span className="signal-form__chip-v">
            {formatPoolChipPct(inMarket)}
            <span className="signal-form__chip-dim">%</span>
          </span>
          <span className="signal-form__chip-sub">
            доступно {formatPoolChipPct(maxStakePct)}%
            {stakePoolBurnedPct > 0 ? ` (−${formatPoolChipPct(stakePoolBurnedPct)}% сгорело)` : ""}
          </span>
        </div>
      </div>
      {active && resetIn ? (
        <p className="signal-form__reset">
          Сброс <time className="signal-form__reset-clock">{resetIn}</time> МСК
        </p>
      ) : null}
      {dailyBlocked ? (
        <p className="signal-form__alert signal-form__alert--err" role="alert">
          {dailyLimitBlockedMessage(dailyBlockReason)}
        </p>
      ) : null}
      {stakePoolBlocked ? (
        <p className="signal-form__alert signal-form__alert--err" role="alert">
          {stakePoolBlockedMessage(maxStakePct, poolFree, {
            rankEntryLocked,
            rankMaxStakePct,
          })}
        </p>
      ) : null}
    </aside>
  );
}
