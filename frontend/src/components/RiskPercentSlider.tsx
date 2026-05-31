import { formatRiskPercent, parseRiskPercent } from "../utils/signalForm";
import { stakeSliderMarks } from "../utils/stakePool";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  max?: number;
  disabled?: boolean;
};

export function RiskPercentSlider({
  value,
  onChange,
  label = "Сумма входа %",
  max = 100,
  disabled = false,
}: Props) {
  const cap = Math.max(0, Math.min(100, max));
  const marks = stakeSliderMarks(cap);
  const current = Math.min(parseRiskPercent(value), cap);

  const setPercent = (n: number) => onChange(formatRiskPercent(Math.min(n, cap)));

  return (
    <div className="risk-slider">
      <div className="risk-slider__head">
        <span className="field-label risk-slider__label">{label}</span>
        <strong className="risk-slider__value">{formatRiskPercent(current)}%</strong>
      </div>
      <input
        type="range"
        className="risk-slider__input"
        min={0}
        max={cap}
        step={1}
        value={current}
        disabled={disabled || cap <= 0}
        style={{ "--risk-pct": cap > 0 ? `${(current / cap) * 100}%` : "0%" } as React.CSSProperties}
        onChange={(e) => setPercent(parseFloat(e.target.value))}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={current}
      />
      <div className="risk-slider__marks" aria-hidden>
        {marks.map((m) => (
          <button
            key={m}
            type="button"
            className={`risk-slider__mark${current === m ? " on" : ""}`}
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
