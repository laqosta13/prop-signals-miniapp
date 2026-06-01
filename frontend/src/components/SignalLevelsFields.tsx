import { StopOffsetSlider } from "./StopOffsetSlider";
import { priceStopToAccountRiskPct, ACCOUNT_STOP_MIN_STEP } from "../utils/dailyStopLimit";
import { formatRiskPct, parseRiskPctValue } from "../utils/signalLevels";
import { formatPriceRiskFromAccountStop } from "../utils/signalFormLimits";

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
      if (!Number.isFinite(accountPct) || accountPct < ACCOUNT_STOP_MIN_STEP) return;
      onRiskPctChange(formatPriceRiskFromAccountStop(accountPct, stakePct, leverage));
      return;
    }
    onRiskPctChange(value);
  };

  return (
    <div className="signal-form__levels">
      <div className="signal-form__level signal-form__level--entry">
        <label className="signal-form__level-label">Вход</label>
        <input
          className="signal-form__level-input"
          value={entry}
          onChange={(e) => onEntryChange(e.target.value)}
          placeholder={priceLoading ? "…" : entryPlaceholder}
          disabled={priceLoading}
        />
      </div>
      <div className="signal-form__level signal-form__level--stop">
        <label className="signal-form__level-label">
          Стоп
          {accountMode ? <span className="signal-form__level-badge">бегунок</span> : null}
        </label>
        <input
          className="signal-form__level-input"
          value={stop}
          readOnly={accountMode}
          aria-readonly={accountMode}
          onChange={accountMode ? undefined : (e) => onStopChange(e.target.value)}
          placeholder="—"
        />
      </div>
      <div className="signal-form__level signal-form__level--target">
        <label className="signal-form__level-label">Цель</label>
        <input
          className="signal-form__level-input"
          value={target}
          onChange={(e) => onTargetChange(e.target.value)}
          placeholder="—"
        />
      </div>
      <div className="signal-form__levels-slider">
        <StopOffsetSlider
          value={sliderValue}
          onChange={handleSliderChange}
          dailyRemainingPct={accountMode ? dailyRemainingPct : undefined}
          dailyLossPct={dailyLossPct}
          blocked={dailyStopBlocked}
          showBudget={false}
        />
      </div>
    </div>
  );
}
