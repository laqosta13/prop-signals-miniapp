import { useMskDayCountdown } from "../../hooks/useMskDayCountdown";
import {
  dailyLimitBlockedMessage,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../../utils/dailyStopLimit";
import { formatPoolChipPct, STAKE_POOL_TOTAL_PCT, stakePoolBlockedMessage } from "../../utils/stakePool";

type Props = {
  active: boolean;
  loading?: boolean;
  dailyRemaining?: number;
  dailyTradesRemaining: number;
  dailyTradesLimit?: number;
  stakePoolUsedPct?: number;
  stakePoolRemainingPct?: number;
  dailyBlocked?: boolean;
  dailyBlockReason?: "stop" | "trades" | null;
  stakePoolBlocked?: boolean;
  maxStakePct?: number;
};

export function SignalFormLimitsBar({
  active,
  loading = false,
  dailyRemaining,
  dailyTradesRemaining,
  dailyTradesLimit = SIGNAL_DAILY_TRADE_LIMIT,
  stakePoolUsedPct,
  stakePoolRemainingPct,
  dailyBlocked = false,
  dailyBlockReason = null,
  stakePoolBlocked = false,
  maxStakePct = 0,
}: Props) {
  const { label: resetIn } = useMskDayCountdown(active && !loading);

  if (loading) {
    return (
      <aside className="signal-form__limits signal-form__limits--loading" aria-busy="true">
        Лимиты…
      </aside>
    );
  }

  const poolFree = stakePoolRemainingPct ?? STAKE_POOL_TOTAL_PCT;
  const inMarket = stakePoolUsedPct ?? 0;

  return (
    <aside className="signal-form__limits" aria-label="Лимиты дня">
      <div className="signal-form__chips">
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">Сделки</span>
          <span className="signal-form__chip-v">
            {dailyTradesRemaining}
            <span className="signal-form__chip-dim">/{dailyTradesLimit}</span>
          </span>
        </div>
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">Стоп дня</span>
          <span className="signal-form__chip-v">
            {formatPoolChipPct(dailyRemaining ?? 0)}
            <span className="signal-form__chip-dim">/{SIGNAL_DAILY_STOP_LIMIT_PCT}%</span>
          </span>
        </div>
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">Пул</span>
          <span className="signal-form__chip-v">
            {formatPoolChipPct(poolFree)}
            <span className="signal-form__chip-dim">/{STAKE_POOL_TOTAL_PCT}%</span>
          </span>
        </div>
        <div className="signal-form__chip signal-form__chip--wide">
          <span className="signal-form__chip-k">В рынке</span>
          <span className="signal-form__chip-v">
            {formatPoolChipPct(inMarket)}
            <span className="signal-form__chip-dim">% входа</span>
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
          {stakePoolBlockedMessage(maxStakePct, poolFree)}
        </p>
      ) : null}
    </aside>
  );
}
