import { evenSliderMarks } from "../utils/sliderMarks";
import { roundStopPct } from "../utils/dailyStopLimit";

const DEFAULT_STEP = 0.01;

type Props = {
  value: number;
  onChange: (value: number) => void;
  max: number;
  min?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  hint?: string;
  formatValue?: (n: number) => string;
  formatMark?: (n: number) => string;
  className?: string;
  ariaLabel?: string;
  markSegments?: number;
};

export function FormRangeSlider({
  value,
  onChange,
  max,
  min = 0,
  step = DEFAULT_STEP,
  disabled = false,
  label,
  hint,
  formatValue = (n) => String(roundStopPct(n)),
  formatMark = formatValue,
  className = "",
  ariaLabel,
  markSegments = 4,
}: Props) {
  const cap = Math.max(min, max);
  const marks = evenSliderMarks(cap, min, markSegments);
  const current = Math.min(cap, Math.max(min, value));
  const span = cap - min;
  const barPct = span > 0 ? ((current - min) / span) * 100 : 0;
  const off = disabled || cap <= min;

  const setValue = (n: number) => {
    if (off) return;
    const clamped = Math.min(cap, Math.max(min, roundStopPct(n)));
    onChange(clamped);
  };

  return (
    <div className={`risk-slider form-range-slider${off ? " form-range-slider--off" : ""} ${className}`.trim()}>
      <div className="risk-slider__head">
        <div className="risk-slider__label-wrap">
          <span className="risk-slider__label">{label}</span>
          {hint ? <span className="risk-slider__hint">{hint}</span> : null}
        </div>
        <strong className="risk-slider__value">{formatValue(current)}%</strong>
      </div>
      <input
        type="range"
        className="risk-slider__input"
        min={min}
        max={cap}
        step={step}
        value={current}
        disabled={off}
        style={{ "--risk-pct": `${Math.min(100, Math.max(0, barPct))}%` } as React.CSSProperties}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        onInput={(e) => setValue(parseFloat((e.target as HTMLInputElement).value))}
        aria-valuemin={min}
        aria-valuemax={cap}
        aria-valuenow={current}
        aria-label={ariaLabel ?? label}
      />
      {marks.length > 0 ? (
        <div
          className="risk-slider__marks risk-slider__marks--grid"
          style={{ gridTemplateColumns: `repeat(${marks.length}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {marks.map((m) => (
            <button
              key={m}
              type="button"
              className={`risk-slider__mark${Math.abs(current - m) < step / 2 ? " on" : ""}`}
              disabled={off}
              onClick={() => setValue(m)}
            >
              {formatMark(m)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
