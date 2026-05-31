import {
  STOP_OFFSET_MIN_PCT,
  STOP_OFFSET_STEP,
  clampStopOffsetPct,
  formatRiskPct,
  parseRiskPctValue,
} from "../utils/signalLevels";
import { SIGNAL_DAILY_STOP_LIMIT_PCT } from "../utils/dailyStopLimit";

const ACCOUNT_MARKS = [0.5, 1, 1.5, 2] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Остаток дневного лимита стопа (% счёта). Если задан — бегунок в % счёта, max = remaining. */
  dailyRemainingPct?: number;
  dailyLossPct?: number;
  blocked?: boolean;
};

export function StopOffsetSlider({
  value,
  onChange,
  dailyRemainingPct,
  dailyLossPct = 0,
  blocked = false,
}: Props) {
  const accountMode = dailyRemainingPct !== undefined;
  const maxPct = accountMode ? Math.max(0, dailyRemainingPct) : 5;
  const minPct = accountMode ? 0.1 : STOP_OFFSET_MIN_PCT;
  const currentRaw = parseRiskPctValue(value);
  const current = accountMode
    ? Math.min(maxPct, Math.max(minPct, currentRaw))
    : clampStopOffsetPct(currentRaw);
  const barPct = maxPct > minPct ? ((current - minPct) / (maxPct - minPct)) * 100 : 0;

  const marks = accountMode
    ? ACCOUNT_MARKS.filter((m) => m <= maxPct + 0.001)
    : ([0.5, 1, 1.5, 2, 3, 5] as const).filter((m) => m <= maxPct);

  const setPercent = (n: number) => {
    if (blocked || maxPct < minPct) return;
    const clamped = accountMode
      ? Math.min(maxPct, Math.max(minPct, Math.round(n * 10) / 10))
      : clampStopOffsetPct(n);
    onChange(formatRiskPct(clamped));
  };

  const disabled = blocked || maxPct < minPct;

  return (
    <div className={`risk-slider stop-offset-slider${disabled ? " stop-offset-slider--blocked" : ""}`}>
      <div className="risk-slider__head">
        <span className="field-label risk-slider__label">
          {accountMode ? "Риск до стопа, % счёта" : "До стопа, %"}
        </span>
        <strong className="risk-slider__value">{formatRiskPct(current)}%</strong>
      </div>
      {accountMode && (
        <p className="stop-offset-slider__budget meta">
          Лимит дня {SIGNAL_DAILY_STOP_LIMIT_PCT}% · потери {formatRiskPct(dailyLossPct)}% · остаток{" "}
          <strong>{formatRiskPct(maxPct)}%</strong>
        </p>
      )}
      {disabled ? (
        <p className="stop-offset-slider__blocked err">Дневной лимит стопа исчерпан — новые сигналы сегодня недоступны</p>
      ) : (
        <>
          <input
            type="range"
            className="risk-slider__input"
            min={minPct}
            max={maxPct}
            step={STOP_OFFSET_STEP}
            value={current}
            style={{ "--risk-pct": `${barPct}%` } as React.CSSProperties}
            onChange={(e) => setPercent(parseFloat(e.target.value))}
            aria-valuemin={minPct}
            aria-valuemax={maxPct}
            aria-valuenow={current}
            aria-label={accountMode ? "Риск до стопа в процентах счёта" : "Процент до стопа"}
          />
          {marks.length > 0 && (
            <div className="risk-slider__marks stop-offset-slider__marks" aria-hidden>
              {marks.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`risk-slider__mark${Math.abs(current - m) < STOP_OFFSET_STEP / 2 ? " on" : ""}`}
                  onClick={() => setPercent(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
