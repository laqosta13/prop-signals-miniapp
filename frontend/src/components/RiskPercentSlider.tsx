import { roundStopPct } from "../utils/dailyStopLimit";
import { riskSliderMarkStyle } from "../utils/riskSliderMarks";
import { formatRiskPercent, parseRiskPercent } from "../utils/signalForm";
import { stakeSliderMarks } from "../utils/stakePool";

const STAKE_SLIDER_STEP = 0.01;

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  max?: number;
  disabled?: boolean;
};

export function RiskPercentSlider({
  value,
  onChange,
  label = "Доля входа",
  hint,
  max = 100,
  disabled = false,
}: Props) {
  const cap = Math.max(0, Math.min(100, max));
  const marks = stakeSliderMarks(cap);
  const current = Math.min(parseRiskPercent(value), cap);

  const setPercent = (n: number) => {
    const clamped = Math.min(cap, Math.max(0, roundStopPct(n)));
    onChange(formatRiskPercent(clamped));
  };

  return (
    <div className="risk-slider">
      <div className="risk-slider__head">
        <div className="risk-slider__label-wrap">
          <span className="risk-slider__label">{label}</span>
          {hint ? <span className="risk-slider__hint">{hint}</span> : null}
        </div>
        <strong className="risk-slider__value">{formatRiskPercent(current)}%</strong>
      </div>
      <input
        type="range"
        className="risk-slider__input"
        min={0}
        max={cap}
        step={STAKE_SLIDER_STEP}
        value={current}
        disabled={disabled || cap <= 0}
        style={{ "--risk-pct": cap > 0 ? `${(current / cap) * 100}%` : "0%" } as React.CSSProperties}
        onChange={(e) => setPercent(parseFloat(e.target.value))}
        onInput={(e) => setPercent(parseFloat((e.target as HTMLInputElement).value))}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={current}
      />
      <div className="risk-slider__marks" aria-hidden>
        {marks.map((m) => (
          <button
            key={m}
            type="button"
            className={`risk-slider__mark${Math.abs(current - m) < STAKE_SLIDER_STEP / 2 ? " on" : ""}`}
            style={riskSliderMarkStyle(m, cap)}
            disabled={disabled || cap <= 0}
            onClick={() => setPercent(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
