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
  /** % движения цены от входа до стопа; цель = R:R 1:3. */
  onRiskPctChange: (value: string) => void;
  entryPlaceholder?: string;
  stakePct?: number;
  leverage?: number;
  dailyRemainingPct?: number;
  dailyLossUsd?: number;
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
  dailyLossUsd = 0,
  balanceUsd = 0,
  rankMaxStakePct = 0,
  dailyStopBlocked = false,
}: Props) {
  const accountMode =
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
        <label className="signal-form__level-label">
          Цель
          {accountMode ? <span className="signal-form__level-badge">1:3</span> : null}
        </label>
        <input
          className="signal-form__level-input"
          value={target}
          readOnly={accountMode}
          aria-readonly={accountMode}
          onChange={accountMode ? undefined : (e) => onTargetChange(e.target.value)}
          placeholder="—"
        />
      </div>
      <div className="signal-form__levels-slider">
        <StopOffsetSlider
          value={riskPct}
          onChange={onRiskPctChange}
          hasEntry={hasEntry}
          dailyRemainingPct={accountMode ? dailyRemainingPct : undefined}
          dailyLossUsd={accountMode ? dailyLossUsd : undefined}
          balanceUsd={accountMode ? balanceUsd : undefined}
          rankMaxStakePct={accountMode ? rankMaxStakePct : undefined}
          stakePct={accountMode ? stakePct : undefined}
          leverage={accountMode ? leverage : undefined}
          blocked={dailyStopBlocked || !hasEntry}
          showBudget={false}
        />
      </div>
    </div>
  );
}
