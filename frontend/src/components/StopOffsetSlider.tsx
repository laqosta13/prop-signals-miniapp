import { useEffect } from "react";
import {
  maxPriceStopPctFromDailyRemaining,
  priceStopSliderMarks,
  roundStopPct,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "../utils/dailyStopLimit";
import { riskSliderMarkStyle } from "../utils/riskSliderMarks";
import {
  STOP_OFFSET_MIN_PCT,
  STOP_OFFSET_STEP,
  clampStopOffsetPct,
  formatRiskPct,
  parseRiskPctValue,
} from "../utils/signalLevels";

type Props = {
  /** % движения цены (≈ % риска от номинала позиции). */
  value: string;
  onChange: (value: string) => void;
  dailyRemainingPct?: number;
  stakePct?: number;
  leverage?: number;
  dailyLossPct?: number;
  blocked?: boolean;
  showBudget?: boolean;
};

export function StopOffsetSlider({
  value,
  onChange,
  dailyRemainingPct,
  stakePct,
  leverage,
  dailyLossPct = 0,
  blocked = false,
  showBudget = true,
}: Props) {
  const accountMode =
    dailyRemainingPct !== undefined && stakePct !== undefined && leverage !== undefined;
  const maxPct = accountMode
    ? maxPriceStopPctFromDailyRemaining(dailyRemainingPct, stakePct, leverage)
    : 5;
  const minPct = STOP_OFFSET_MIN_PCT;
  const step = accountMode && maxPct <= 2 ? 0.01 : STOP_OFFSET_STEP;
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

  const marks = accountMode ? priceStopSliderMarks(maxPct) : ([0.5, 1, 1.5, 2, 3, 5] as const).filter((m) => m <= maxPct);

  useEffect(() => {
    if (!accountMode || maxPct < minPct) return;
    if (currentRaw > maxPct + 0.005) {
      onChange(formatRiskPct(maxPct));
    }
  }, [accountMode, maxPct, minPct, currentRaw, onChange]);

  const setPercent = (n: number) => {
    if (blocked || maxPct < minPct) return;
    const clamped = accountMode
      ? Math.min(maxPct, Math.max(minPct, roundStopPct(n)))
      : clampStopOffsetPct(n);
    if (accountMode && clamped < minPct) return;
    onChange(formatRiskPct(clamped));
  };

  const disabled = blocked || maxPct < minPct;

  return (
    <div className={`risk-slider stop-offset-slider${disabled ? " stop-offset-slider--blocked" : ""}`}>
      <div className="risk-slider__head">
        <div className="risk-slider__label-wrap">
          <span className="risk-slider__label">До стопа</span>
          {accountMode && maxPct > 0 ? (
            <span className="risk-slider__hint">макс. {formatRiskPct(maxPct)}% от номинала</span>
          ) : null}
        </div>
        <strong className="risk-slider__value">{formatRiskPct(current)}%</strong>
      </div>
      {accountMode && showBudget && (
        <p className="stop-offset-slider__budget meta">
          Лимит {SIGNAL_DAILY_STOP_LIMIT_PCT}% счёта · потери {formatRiskPct(dailyLossPct)}% · остаток{" "}
          <strong>{formatRiskPct(dailyRemainingPct!)}%</strong>
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
            style={{ "--risk-pct": `${Math.min(100, Math.max(0, barPct))}%` } as React.CSSProperties}
            onChange={(e) => setPercent(parseFloat(e.target.value))}
            onInput={(e) => setPercent(parseFloat((e.target as HTMLInputElement).value))}
            aria-valuemin={minPct}
            aria-valuemax={maxPct}
            aria-valuenow={current}
            aria-label="Процент риска от номинала позиции до стопа"
          />
          {marks.length > 0 && (
            <div className="risk-slider__marks" aria-hidden>
              {marks.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`risk-slider__mark${Math.abs(current - m) < step / 2 ? " on" : ""}`}
                  style={riskSliderMarkStyle(m, maxPct)}
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
