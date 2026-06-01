import { useEffect } from "react";
import {
  accountRiskToPriceStopPct,
  accountStopSliderMarks,
  accountStopSliderStep,
  ACCOUNT_STOP_MIN_STEP,
  formatAccountStopPct,
  maxPriceStopPctFromDailyRemaining,
  priceStopToAccountRiskPct,
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
  /** % движения цены от входа до стопа (для пересчёта стопа/цели). */
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
  const accountMode =
    dailyRemainingPct !== undefined && stakePct !== undefined && leverage !== undefined;

  const priceRaw = parseRiskPctValue(value);

  const maxAccount = accountMode ? roundStopPct(Math.max(0, dailyRemainingPct)) : 0;
  const minAccount = ACCOUNT_STOP_MIN_STEP;
  const inferredAccount =
    accountMode && stakePct !== undefined && leverage !== undefined
      ? priceStopToAccountRiskPct(priceRaw, stakePct, leverage)
      : 0;
  const currentAccount = accountMode
    ? roundStopPct(
        Math.min(
          maxAccount,
          Math.max(minAccount, inferredAccount > 0 ? inferredAccount : minAccount),
        ),
      )
    : 0;

  useEffect(() => {
    if (!accountMode || blocked || maxAccount < minAccount) return;
    if (stakePct === undefined || leverage === undefined || dailyRemainingPct === undefined) return;
    const maxPrice = maxPriceStopPctFromDailyRemaining(dailyRemainingPct, stakePct, leverage);
    if (maxPrice > 0 && priceRaw > maxPrice + 0.005) {
      onChange(formatRiskPct(maxPrice));
    }
  }, [
    accountMode,
    blocked,
    maxAccount,
    minAccount,
    dailyRemainingPct,
    stakePct,
    leverage,
    priceRaw,
    onChange,
  ]);

  if (accountMode && stakePct !== undefined && leverage !== undefined && dailyRemainingPct !== undefined) {
    const step = accountStopSliderStep(maxAccount);
    const barPct = maxAccount > 0 ? (currentAccount / maxAccount) * 100 : 0;
    const marks = accountStopSliderMarks(dailyRemainingPct);
    const disabled = blocked || !hasEntry || maxAccount < minAccount;

    const setAccountPct = (account: number) => {
      if (disabled) return;
      const clamped = roundStopPct(Math.min(maxAccount, Math.max(minAccount, account)));
      const price = accountRiskToPriceStopPct(clamped, stakePct, leverage);
      onChange(formatRiskPct(Math.max(STOP_OFFSET_MIN_PCT, price)));
    };

    return (
      <div className={`risk-slider stop-offset-slider${disabled ? " stop-offset-slider--blocked" : ""}`}>
        <div className="risk-slider__head">
          <div className="risk-slider__label-wrap">
            <span className="risk-slider__label">Риск до стопа</span>
            {maxAccount > 0 ? (
              <span className="risk-slider__hint">
                макс. {formatAccountStopPct(maxAccount)}% счёта · стоп от цены входа
              </span>
            ) : null}
          </div>
          <strong className="risk-slider__value">{formatAccountStopPct(currentAccount)}%</strong>
        </div>
        {showBudget && (
          <p className="stop-offset-slider__budget meta">
            Лимит {SIGNAL_DAILY_STOP_LIMIT_PCT}% счёта · потери {formatAccountStopPct(dailyLossPct)}% · остаток{" "}
            <strong>{formatAccountStopPct(dailyRemainingPct)}%</strong>
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
              min={minAccount}
              max={maxAccount}
              step={step}
              value={currentAccount}
              style={{ "--risk-pct": `${Math.min(100, Math.max(0, barPct))}%` } as React.CSSProperties}
              onChange={(e) => setAccountPct(parseFloat(e.target.value))}
              onInput={(e) => setAccountPct(parseFloat((e.target as HTMLInputElement).value))}
              aria-valuemin={minAccount}
              aria-valuemax={maxAccount}
              aria-valuenow={currentAccount}
              aria-label="Риск до стопа в процентах от счёта"
            />
            {marks.length > 0 && (
              <div className="risk-slider__marks" aria-hidden>
                {marks.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`risk-slider__mark${Math.abs(currentAccount - m) < step / 2 ? " on" : ""}`}
                    style={riskSliderMarkStyle(m, maxAccount)}
                    onClick={() => setAccountPct(m)}
                  >
                    {formatAccountStopPct(m)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const maxPct = 5;
  const minPct = STOP_OFFSET_MIN_PCT;
  const step = STOP_OFFSET_STEP;
  const current = clampStopOffsetPct(priceRaw);
  const barPct = maxPct > minPct ? ((current - minPct) / (maxPct - minPct)) * 100 : 0;
  const marks = ([0.5, 1, 1.5, 2, 3, 5] as const).filter((m) => m <= maxPct);
  const disabled = blocked || maxPct < minPct;

  const setPercent = (n: number) => {
    if (disabled) return;
    onChange(formatRiskPct(clampStopOffsetPct(n)));
  };

  return (
    <div className={`risk-slider stop-offset-slider${disabled ? " stop-offset-slider--blocked" : ""}`}>
      <div className="risk-slider__head">
        <div className="risk-slider__label-wrap">
          <span className="risk-slider__label">До стопа</span>
        </div>
        <strong className="risk-slider__value">{formatRiskPct(current)}%</strong>
      </div>
      {disabled ? null : (
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
            aria-label="Процент риска до стопа"
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
