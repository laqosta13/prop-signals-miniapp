import { StopOffsetSlider } from "./StopOffsetSlider";
import { accountRiskToPriceStopPct, priceStopToAccountRiskPct } from "../utils/dailyStopLimit";
import { clampStopOffsetPct, formatRiskPct, parseRiskPctValue } from "../utils/signalLevels";

const LEVEL_HINTS = ["Цена с Bybit perp", "R:R 1:3"] as const;
const LEVEL_HINTS_DAILY = ["Цена с Bybit perp", "R:R 1:3 · лимит стопа 2%/день"] as const;

type Props = {
  entry: string;
  stop: string;
  target: string;
  riskPct: string;
  priceLoading?: boolean;
  onEntryChange: (value: string) => void;
  onStopChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onRiskPctChange: (value: string) => void;
  entryPlaceholder?: string;
  showPriceHint?: boolean;
  stakePct?: number;
  leverage?: number;
  dailyRemainingPct?: number;
  dailyLossPct?: number;
  dailyStopBlocked?: boolean;
};

export function SignalLevelsFields({
  entry,
  stop,
  target,
  riskPct,
  priceLoading = false,
  onEntryChange,
  onStopChange,
  onTargetChange,
  onRiskPctChange,
  entryPlaceholder = "0.00",
  showPriceHint = true,
  stakePct,
  leverage,
  dailyRemainingPct,
  dailyLossPct = 0,
  dailyStopBlocked = false,
}: Props) {
  const accountMode =
    dailyRemainingPct !== undefined && stakePct !== undefined && leverage !== undefined;

  const sliderValue = accountMode
    ? formatRiskPct(priceStopToAccountRiskPct(parseRiskPctValue(riskPct), stakePct, leverage))
    : riskPct;

  const handleSliderChange = (value: string) => {
    if (accountMode) {
      const accountPct = parseFloat(value.trim().replace(",", "."));
      if (!Number.isFinite(accountPct) || accountPct <= 0) return;
      const pricePct = accountRiskToPriceStopPct(accountPct, stakePct, leverage);
      onRiskPctChange(formatRiskPct(clampStopOffsetPct(pricePct)));
      return;
    }
    onRiskPctChange(value);
  };

  const hints = accountMode ? LEVEL_HINTS_DAILY : LEVEL_HINTS;

  return (
    <div className="levels-grid-form">
      <div>
        <label className="field-label">Вход</label>
        <input
          value={entry}
          onChange={(e) => onEntryChange(e.target.value)}
          placeholder={priceLoading ? "Загрузка…" : entryPlaceholder}
          disabled={priceLoading}
        />
      </div>
      <div>
        <label className="field-label">Стоп</label>
        <input value={stop} onChange={(e) => onStopChange(e.target.value)} placeholder="Цена" />
      </div>
      <div>
        <label className="field-label">Цель</label>
        <input value={target} onChange={(e) => onTargetChange(e.target.value)} placeholder="Цена" />
      </div>
      <div className="levels-grid-form__slider">
        <StopOffsetSlider
          value={sliderValue}
          onChange={handleSliderChange}
          dailyRemainingPct={accountMode ? dailyRemainingPct : undefined}
          dailyLossPct={dailyLossPct}
          blocked={dailyStopBlocked}
        />
      </div>
      {showPriceHint && (
        <ul className="levels-grid-form__hints">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
