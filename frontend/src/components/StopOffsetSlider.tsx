import {
  STOP_OFFSET_MIN_PCT,
  STOP_OFFSET_STEP,
  clampStopOffsetPct,
  formatRiskPct,
  parseRiskPctValue,
} from "../utils/signalLevels";
import {
  ACCOUNT_STOP_MIN_STEP,
  accountStopSliderMarks,
  accountStopSliderStep,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "../utils/dailyStopLimit";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Остаток дневного лимита стопа (% счёта). Бегунок 0…remaining на весь трек. */
  dailyRemainingPct?: number;
  dailyLossPct?: number;
  blocked?: boolean;
  /** Скрыть дублирующий текст лимита (показывается в панели лимитов формы). */
  showBudget?: boolean;
};

export function StopOffsetSlider({
  value,
  onChange,
  dailyRemainingPct,
  dailyLossPct = 0,
  blocked = false,
  showBudget = true,
}: Props) {
  const accountMode = dailyRemainingPct !== undefined;
  const maxPct = accountMode ? Math.max(0, dailyRemainingPct) : 5;
  const minPct = accountMode ? 0 : STOP_OFFSET_MIN_PCT;
  const step = accountMode ? accountStopSliderStep(maxPct) : STOP_OFFSET_STEP;
  const currentRaw = parseRiskPctValue(value);
  const current = accountMode
    ? Math.min(maxPct, Math.max(minPct, currentRaw))
    : clampStopOffsetPct(currentRaw);
  const barPct = accountMode
    ? maxPct > 0
      ? (current / maxPct) * 100
      : 0
    : maxPct > minPct
      ? ((current - minPct) / (maxPct - minPct)) * 100
      : 0;

  const marks = accountMode
    ? accountStopSliderMarks(maxPct)
    : ([0.5, 1, 1.5, 2, 3, 5] as const).filter((m) => m <= maxPct);

  const setPercent = (n: number) => {
    if (blocked || maxPct < ACCOUNT_STOP_MIN_STEP) return;
    const clamped = accountMode
      ? Math.min(maxPct, Math.max(0, Math.round(n / step) * step))
      : clampStopOffsetPct(n);
    if (accountMode && clamped < ACCOUNT_STOP_MIN_STEP) return;
    onChange(formatRiskPct(clamped));
  };

  const disabled = blocked || (accountMode ? maxPct < ACCOUNT_STOP_MIN_STEP : maxPct < minPct);

  return (
    <div className={`risk-slider stop-offset-slider${disabled ? " stop-offset-slider--blocked" : ""}`}>
      <div className="risk-slider__head">
        <span className="risk-slider__label">{accountMode ? "Риск до стопа" : "До стопа"}</span>
        <strong className="risk-slider__value">{formatRiskPct(current)}%</strong>
      </div>
      {accountMode && showBudget && (
        <p className="stop-offset-slider__budget meta">
          Лимит {SIGNAL_DAILY_STOP_LIMIT_PCT}% · потери {formatRiskPct(dailyLossPct)}% · остаток{" "}
          <strong>{formatRiskPct(maxPct)}%</strong>
        </p>
      )}
      {disabled ? (
        <p className="stop-offset-slider__blocked err">
          Дневной лимит {SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа исчерпан
        </p>
      ) : (
        <>
          <input
            type="range"
            className="risk-slider__input"
            min={minPct}
            max={maxPct}
            step={step}
            value={current}
            style={
              {
                "--risk-pct": `${Math.min(100, Math.max(0, barPct))}%`,
                "--stop-marks-count": String(Math.max(marks.length, 1)),
              } as React.CSSProperties
            }
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
                  className={`risk-slider__mark${Math.abs(current - m) < step / 2 ? " on" : ""}`}
                  onClick={() => setPercent(m)}
                >
                  {formatRiskPct(m)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
