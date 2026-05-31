import { formatRiskPercent, parseRiskPercent } from "../utils/signalForm";

const MARKS = [0, 25, 50, 75, 100] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

export function RiskPercentSlider({ value, onChange, label = "Сумма входа %" }: Props) {
  const current = parseRiskPercent(value);

  const setPercent = (n: number) => onChange(formatRiskPercent(n));

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
        max={100}
        step={1}
        value={current}
        style={{ "--risk-pct": `${current}%` } as React.CSSProperties}
        onChange={(e) => setPercent(parseFloat(e.target.value))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={current}
      />
      <div className="risk-slider__marks" aria-hidden>
        {MARKS.map((m) => (
          <button
            key={m}
            type="button"
            className={`risk-slider__mark${current === m ? " on" : ""}`}
            onClick={() => setPercent(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
