import { useMskDayCountdown } from "../../hooks/useMskDayCountdown";
import {
  dailyLimitBlockedMessage,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../../utils/dailyStopLimit";
import { formatRiskPct } from "../../utils/signalLevels";
import { stakePoolBlockedMessage } from "../../utils/stakePool";

type Props = {
  active: boolean;
  loading?: boolean;
  dailyRemaining?: number;
  dailyTradesRemaining: number;
  dailyTradesLimit?: number;
  stakePoolRemainingPct?: number;
  rankMaxStakePct?: number;
  rankName?: string;
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
  stakePoolRemainingPct,
  rankMaxStakePct,
  rankName,
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

  const tradeLimit = dailyTradesLimit;

  return (
    <aside className="signal-form__limits" aria-label="Дневные лимиты">
      <div className="signal-form__chips">
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">Сделки</span>
          <span className="signal-form__chip-v">
            {dailyTradesRemaining}
            <span className="signal-form__chip-dim">/{tradeLimit}</span>
          </span>
        </div>
        <div className="signal-form__chip">
          <span className="signal-form__chip-k">Стоп</span>
          <span className="signal-form__chip-v">
            {formatRiskPct(dailyRemaining ?? 0)}%
            <span className="signal-form__chip-dim">/{SIGNAL_DAILY_STOP_LIMIT_PCT}%</span>
          </span>
        </div>
        {stakePoolRemainingPct != null && (
          <div className="signal-form__chip">
            <span className="signal-form__chip-k">Пул</span>
            <span className="signal-form__chip-v">{formatRiskPct(stakePoolRemainingPct)}%</span>
          </div>
        )}
        {rankName != null && rankMaxStakePct != null && (
          <div className="signal-form__chip signal-form__chip--wide">
            <span className="signal-form__chip-k">{rankName}</span>
            <span className="signal-form__chip-v">до {formatRiskPct(rankMaxStakePct)}%</span>
          </div>
        )}
      </div>
      {active && resetIn ? (
        <p className="signal-form__reset">
          Обновление через <time className="signal-form__reset-clock">{resetIn}</time> МСК
        </p>
      ) : null}
      {dailyBlocked ? (
        <p className="signal-form__alert signal-form__alert--err" role="alert">
          {dailyLimitBlockedMessage(dailyBlockReason)}
        </p>
      ) : null}
      {stakePoolBlocked ? (
        <p className="signal-form__alert signal-form__alert--err" role="alert">
          {stakePoolBlockedMessage(maxStakePct, stakePoolRemainingPct ?? 0)}
        </p>
      ) : null}
    </aside>
  );
}
