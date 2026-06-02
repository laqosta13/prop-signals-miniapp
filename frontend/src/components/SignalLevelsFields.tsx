import { StopOffsetSlider } from "./StopOffsetSlider";
import { parseEntryPrice } from "../utils/signalLevels";

type Props = {
  entry: string;
  stop: string;
  target: string;
  riskPct: string;
  direction: "long" | "short";
  priceLoading?: boolean;
  onEntryChange: (value: string) => void;
  onStopChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onRiskPctChange: (value: string) => void;
  entryPlaceholder?: string;
  stakePct?: number;
  leverage?: number;
  dailyRemainingPct?: number;
  balanceUsd?: number;
  rankMaxStakePct?: number;
  dailyStopBlocked?: boolean;
};

export function SignalLevelsFields({
  entry,
  direction,
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
  balanceUsd = 0,
  rankMaxStakePct = 0,
  dailyStopBlocked = false,
}: Props) {
  const trackerMode =
    dailyRemainingPct !== undefined &&
    stakePct !== undefined &&
    leverage !== undefined &&
    balanceUsd > 0 &&
    rankMaxStakePct > 0;
  const hasEntry = parseEntryPrice(entry) !== null;

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
          inputMode="decimal"
        />
      </div>
      <div className="signal-form__level signal-form__level--stop">
        <label className="signal-form__level-label">Стоп</label>
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
        <label className="signal-form__level-label">Цель 1:3</label>
        <input
          className="signal-form__level-input"
          value={target}
          readOnly={trackerMode}
          aria-readonly={trackerMode}
          onChange={trackerMode ? undefined : (e) => onTargetChange(e.target.value)}
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
