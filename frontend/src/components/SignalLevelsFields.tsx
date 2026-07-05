import { useThemedCopy } from "../hooks/useThemedCopy";
import { StopOffsetSlider } from "./StopOffsetSlider";
import { parseEntryPrice } from "../utils/signalLevels";
import { maxPriceStopPctForRemainingRank } from "../utils/dailyStopLimit";

type Props = {
  entry: string;
  stop: string;
  target: string;
  riskPct: string;
  direction: "long" | "short";
  rrRatio: number | null;
  priceLoading?: boolean;
  onEntryChange: (value: string) => void;
  onStopChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onRiskPctChange: (value: string) => void;
  onRrRatioChange: (ratio: number | null, rankMaxPricePct?: number) => void;
  entryPlaceholder?: string;
  stakePct?: number;
  leverage?: number;
  dailyRemainingPct?: number;
  balanceUsd?: number;
  rankMaxStakePct?: number;
  dailyStopBlocked?: boolean;
};

const RR_OPTIONS: { label: string; value: number | null }[] = [
  { label: "1:2", value: 2 },
  { label: "1:3", value: 3 },
  { label: "1:∞", value: null },
];

export function SignalLevelsFields({
  entry,
  direction: _direction,
  stop,
  target,
  riskPct,
  rrRatio,
  priceLoading = false,
  onEntryChange,
  onStopChange,
  onTargetChange,
  onRiskPctChange,
  onRrRatioChange,
  entryPlaceholder = "0.00",
  stakePct,
  leverage,
  dailyRemainingPct,
  balanceUsd = 0,
  rankMaxStakePct = 0,
  dailyStopBlocked = false,
}: Props) {
  const copy = useThemedCopy();
  const trackerMode =
    dailyRemainingPct !== undefined &&
    stakePct !== undefined &&
    leverage !== undefined &&
    balanceUsd > 0 &&
    rankMaxStakePct > 0;
  const hasEntry = parseEntryPrice(entry) !== null;
  const targetReadOnly = rrRatio !== null;

  const handleRrClick = (value: number | null) => {
    if (trackerMode && value !== null && dailyRemainingPct !== undefined && leverage !== undefined) {
      const maxPct = maxPriceStopPctForRemainingRank(dailyRemainingPct, leverage);
      if (maxPct > 0) {
        onRrRatioChange(value, maxPct);
        return;
      }
    }
    onRrRatioChange(value);
  };

  return (
    <div className="signal-form__levels">
      <div className="signal-form__rr-row">
        <div className="signal-form__rr-picker" role="group" aria-label="Соотношение риск/прибыль">
          {RR_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`signal-form__rr-btn${rrRatio === opt.value ? " signal-form__rr-btn--active" : ""}`}
              onClick={() => handleRrClick(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="signal-form__level signal-form__level--entry">
        <label className="signal-form__level-label">{copy.signalEntry}</label>
        <input
          className="signal-form__level-input"
          value={entry}
          onChange={(e) => onEntryChange(e.target.value)}
          placeholder={priceLoading ? "…" : entryPlaceholder}
          disabled={priceLoading}
          inputMode="decimal"
        />
      </div>
      <div className="signal-form__level signal-form__level--stop">
        <label className="signal-form__level-label">{copy.signalStop}</label>
        <input
          className="signal-form__level-input"
          value={stop}
          readOnly={trackerMode}
          aria-readonly={trackerMode}
          onChange={trackerMode ? undefined : (e) => onStopChange(e.target.value)}
          placeholder="—"
          inputMode="decimal"
        />
      </div>
      <div className="signal-form__level signal-form__level--target">
        <label className="signal-form__level-label">{copy.signalTarget}</label>
        <input
          className="signal-form__level-input"
          value={target}
          readOnly={targetReadOnly}
          aria-readonly={targetReadOnly}
          onChange={targetReadOnly ? undefined : (e) => onTargetChange(e.target.value)}
          placeholder="—"
          inputMode="decimal"
        />
      </div>
      <div className="signal-form__levels-slider">
        <StopOffsetSlider
          value={riskPct}
          onChange={onRiskPctChange}
          hasEntry={hasEntry}
          dailyRemainingRankPct={trackerMode ? dailyRemainingPct : undefined}
          balanceUsd={trackerMode ? balanceUsd : undefined}
          rankMaxStakePct={trackerMode ? rankMaxStakePct : undefined}
          stakePct={trackerMode ? stakePct : undefined}
          leverage={trackerMode ? leverage : undefined}
          blocked={dailyStopBlocked || !hasEntry}
        />
      </div>
    </div>
  );
}
