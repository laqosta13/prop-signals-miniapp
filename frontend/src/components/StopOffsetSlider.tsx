import { useEffect } from "react";
import {
  formatAccountStopPct,
  maxPriceStopPctFromDailyRemaining,
  priceStopSliderMarks,
  priceStopToAccountRiskPct,
  roundStopPct,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "../utils/dailyStopLimit";
import { riskSliderMarkStyle } from "../utils/riskSliderMarks";
import {
  STOP_OFFSET_MAX_PCT,
  STOP_OFFSET_MIN_PCT,
  STOP_OFFSET_SLIDER_CAP_PCT,
  STOP_OFFSET_STEP,
  clampStopOffsetPct,
  formatRiskPct,
  parseRiskPctValue,
} from "../utils/signalLevels";

type Props = {
  /** % движения цены от входа до стопа. */
  value: string;
  onChange: (value: string) => void;
  hasEntry?: boolean;
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
  hasEntry = true,
  dailyRemainingPct,
  stakePct,
  leverage,
  dailyLossPct = 0,
  blocked = false,
  showBudget = true,
}: Props) {
  const trackerMode =
    dailyRemainingPct !== undefined && stakePct !== undefined && leverage !== undefined;

  const priceRaw = parseRiskPctValue(value);
  const dailyMaxPrice = trackerMode
    ? maxPriceStopPctFromDailyRemaining(dailyRemainingPct, stakePct, leverage)
    : 0;
  const maxPct = trackerMode
    ? Math.max(
        STOP_OFFSET_MIN_PCT,
        Math.min(
          STOP_OFFSET_SLIDER_CAP_PCT,
          dailyMaxPrice > STOP_OFFSET_MIN_PCT ? dailyMaxPrice : STOP_OFFSET_MAX_PCT,
        ),
      )
    : STOP_OFFSET_MAX_PCT;
  const minPct = STOP_OFFSET_MIN_PCT;
  const step = maxPct <= 2 ? 0.01 : STOP_OFFSET_STEP;
  const current = clampStopOffsetPct(priceRaw, maxPct);
  const barPct = maxPct > minPct ? ((current - minPct) / (maxPct - minPct)) * 100 : 0;
  const marks = priceStopSliderMarks(maxPct);
  const disabled = blocked || !hasEntry || maxPct < minPct;

  const accountAtCurrent =
    trackerMode && stakePct > 0
      ? priceStopToAccountRiskPct(current, stakePct, leverage)
      : null;

  useEffect(() => {
    if (!trackerMode || disabled) return;
    if (priceRaw > maxPct + 0.005) {
      onChange(formatRiskPct(maxPct));
    }
  }, [trackerMode, disabled, maxPct, priceRaw, onChange]);

  const setPricePct = (n: number) => {
    if (disabled) return;
    onChange(formatRiskPct(clampStopOffsetPct(roundStopPct(n), maxPct)));
  };

  return (
    <div className={`risk-slider stop-offset-slider${disabled ? " stop-offset-slider--blocked" : ""}`}>
      <div className="risk-slider__head">
        <div className="risk-slider__label-wrap">
          <span className="risk-slider__label">До стопа</span>
          {maxPct > 0 ? (
            <span className="risk-slider__hint">
              % от цены входа · макс. {formatRiskPct(maxPct)}%
              {accountAtCurrent != null && accountAtCurrent > 0
                ? ` · ≈ ${formatAccountStopPct(accountAtCurrent)}% счёта`
                : ""}
            </span>
          ) : null}
        </div>
        <strong className="risk-slider__value">{formatRiskPct(current)}%</strong>
      </div>
      {trackerMode && showBudget && (
        <p className="stop-offset-slider__budget meta">
          Лимит {SIGNAL_DAILY_STOP_LIMIT_PCT}% счёта · потери {formatAccountStopPct(dailyLossPct)}% · остаток{" "}
          <strong>{formatAccountStopPct(dailyRemainingPct)}%</strong>
        </p>
      )}
      {disabled ? (
        <p className="stop-offset-slider__blocked err">
          {!hasEntry
            ? "Укажите цену входа"
            : `Дневной лимит ${SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа исчерпан`}
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
            onChange={(e) => setPricePct(parseFloat(e.target.value))}
            onInput={(e) => setPricePct(parseFloat((e.target as HTMLInputElement).value))}
            aria-valuemin={minPct}
            aria-valuemax={maxPct}
            aria-valuenow={current}
            aria-label="Процент движения цены от входа до стопа"
          />
          {marks.length > 0 && (
            <div className="risk-slider__marks" aria-hidden>
              {marks.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`risk-slider__mark${Math.abs(current - m) < step / 2 ? " on" : ""}`}
                  style={riskSliderMarkStyle(m, maxPct)}
                  onClick={() => setPricePct(m)}
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
