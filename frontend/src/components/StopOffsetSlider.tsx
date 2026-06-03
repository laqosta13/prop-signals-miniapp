import { useEffect } from "react";
import { maxPriceStopPctForStopSlider } from "../utils/dailyStopLimit";
import {
  STOP_OFFSET_MAX_PCT,
  STOP_OFFSET_MIN_PCT,
  STOP_OFFSET_SLIDER_CAP_PCT,
  STOP_OFFSET_STEP,
  clampStopOffsetPct,
  formatRiskPct,
  parseRiskPctValue,
} from "../utils/signalLevels";
import { FormRangeSlider } from "./FormRangeSlider";

type Props = {
  value: string;
  onChange: (value: string) => void;
  hasEntry?: boolean;
  dailyRemainingRankPct?: number;
  balanceUsd?: number;
  rankMaxStakePct?: number;
  stakePct?: number;
  leverage?: number;
  blocked?: boolean;
};

export function StopOffsetSlider({
  value,
  onChange,
  hasEntry = true,
  dailyRemainingRankPct,
  balanceUsd = 0,
  rankMaxStakePct = 0,
  stakePct = 0,
  leverage = 1,
  blocked = false,
}: Props) {
  const trackerMode =
    dailyRemainingRankPct !== undefined &&
    stakePct > 0 &&
    leverage >= 1 &&
    balanceUsd > 0 &&
    rankMaxStakePct > 0;

  const priceRaw = parseRiskPctValue(value);

  const dailyMaxPrice = trackerMode
    ? maxPriceStopPctForStopSlider(
        dailyRemainingRankPct!,
        balanceUsd,
        rankMaxStakePct,
        stakePct,
        leverage,
      )
    : 0;

  const maxPct = trackerMode
    ? Math.max(
        STOP_OFFSET_MIN_PCT,
        Math.min(STOP_OFFSET_SLIDER_CAP_PCT, dailyMaxPrice > STOP_OFFSET_MIN_PCT ? dailyMaxPrice : 0),
      )
    : STOP_OFFSET_MAX_PCT;

  const minPct = 0;
  const step = maxPct <= 2 ? 0.01 : STOP_OFFSET_STEP;
  const current = clampStopOffsetPct(priceRaw, maxPct);
  const disabled = blocked || !hasEntry || (trackerMode && maxPct < STOP_OFFSET_MIN_PCT);

  const fmtPct = (n: number) => (n <= 0 ? "0" : formatRiskPct(n));

  const setPricePct = (n: number) => {
    if (disabled) return;
    const clamped = n <= 0 ? STOP_OFFSET_MIN_PCT : clampStopOffsetPct(n, maxPct);
    onChange(formatRiskPct(clamped));
  };

  useEffect(() => {
    if (disabled) return;
    const clamped = clampStopOffsetPct(priceRaw, maxPct);
    if (Math.abs(clamped - priceRaw) > 0.005) {
      onChange(formatRiskPct(clamped));
    }
  }, [disabled, maxPct, priceRaw, onChange, leverage]);

  if (disabled) {
    return (
      <div className="risk-slider stop-offset-slider stop-offset-slider--blocked">
        <p className="stop-offset-slider__blocked err">
          {!hasEntry
            ? "Укажите цену входа"
            : `Дневной лимит ${SIGNAL_DAILY_STOP_LIMIT_PCT}% от номинала ранга исчерпан`}
        </p>
      </div>
    );
  }

  return (
    <FormRangeSlider
      className="stop-offset-slider"
      label="До стопа"
      value={current}
      onChange={setPricePct}
      min={minPct}
      max={maxPct}
      step={step}
      formatValue={fmtPct}
      formatMark={fmtPct}
      ariaLabel="Процент движения цены от входа до стопа"
    />
  );
}
