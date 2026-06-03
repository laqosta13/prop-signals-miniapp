import { LeveragePicker } from "../LeveragePicker";
import { RiskPercentSlider } from "../RiskPercentSlider";

type Props = {
  leverage: string;
  onLeverageChange: (leverage: string) => void;
  risk: string;
  onRiskChange: (value: string) => void;
  maxStakePct: number;
  maxLeverage?: number;
  disabled?: boolean;
  balanceUsd: number;
  stakeUsd: number;
  stakePct: number;
  lev: number;
};

export function SignalFormPositionCard({
  leverage,
  onLeverageChange,
  risk,
  onRiskChange,
  maxStakePct,
  maxLeverage = 5,
  disabled = false,
  balanceUsd,
  stakeUsd,
  stakePct,
  lev,
}: Props) {
  const hasBalance = balanceUsd > 0;

  return (
    <div className="signal-form__position">
      <div className="signal-form__position-stats">
        <div className="signal-form__stat">
          <span className="signal-form__stat-k">Баланс</span>
          <span className="signal-form__stat-v" title={hasBalance ? `$${balanceUsd}` : undefined}>
            {hasBalance ? `$${Math.round(balanceUsd).toLocaleString("en-US")}` : "—"}
          </span>
        </div>
        <div className="signal-form__stat signal-form__stat--accent">
          <span className="signal-form__stat-k">Номинал</span>
          <span className="signal-form__stat-v" title={hasBalance ? `$${stakeUsd}` : undefined}>
            {hasBalance
              ? `$${stakeUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : "—"}
          </span>
        </div>
        <div className="signal-form__stat">
          <span className="signal-form__stat-k">Вход</span>
          <span className="signal-form__stat-v signal-form__stat-v--dim">
            {stakePct}%×{lev}x
          </span>
        </div>
      </div>

      <div className="signal-form__position-row">
        <span className="signal-form__inline-label">Плечо</span>
        <LeveragePicker
          leverage={leverage}
          onLeverageChange={onLeverageChange}
          maxLeverage={maxLeverage}
        />
      </div>

      <RiskPercentSlider
        value={risk}
        onChange={onRiskChange}
        max={maxStakePct}
        disabled={disabled}
        label="Доля входа"
      />
    </div>
  );
}
