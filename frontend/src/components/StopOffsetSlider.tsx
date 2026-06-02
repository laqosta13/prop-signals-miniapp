import {
  maxPriceStopPctFromDailyRemaining,
  priceStopToAccountRiskPct,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "../utils/dailyStopLimit";
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

  // Потолок шкалы от лимита ранга, не от текущей доли входа — иначе бегунок стопа едет при смене входа.
  const dailyMaxPrice = trackerMode
    ? maxPriceStopPctFromDailyRemaining(
        dailyRemainingRankPct!,
        balanceUsd,
        rankMaxStakePct,
        rankMaxStakePct,
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

  const accountAtStop =
    trackerMode && stakePct > 0 ? priceStopToAccountRiskPct(current, stakePct, leverage) : null;

  const hint = trackerMode
    ? `от входа · день ${formatRiskPct(dailyRemainingRankPct!)}/${SIGNAL_DAILY_STOP_LIMIT_PCT}% ном.${
        accountAtStop != null && accountAtStop > 0 ? ` · ≈${formatRiskPct(accountAtStop)}% счёта` : ""
      }`
    : "от цены входа";

  const fmtPct = (n: number) => (n <= 0 ? "0" : formatRiskPct(n));

  const setPricePct = (n: number) => {
    if (disabled) return;
    const clamped = n <= 0 ? STOP_OFFSET_MIN_PCT : clampStopOffsetPct(n, maxPct);
    onChange(formatRiskPct(clamped));
  };

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
      hint={hint}
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
