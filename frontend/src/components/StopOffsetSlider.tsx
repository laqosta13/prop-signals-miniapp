import {
  STOP_OFFSET_MARKS,
  STOP_OFFSET_MAX_PCT,
  STOP_OFFSET_MIN_PCT,
  STOP_OFFSET_STEP,
  clampStopOffsetPct,
  formatRiskPct,
  parseRiskPctValue,
} from "../utils/signalLevels";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function StopOffsetSlider({ value, onChange }: Props) {
  const current = clampStopOffsetPct(parseRiskPctValue(value));
  const barPct = ((current - STOP_OFFSET_MIN_PCT) / (STOP_OFFSET_MAX_PCT - STOP_OFFSET_MIN_PCT)) * 100;

  const setPercent = (n: number) => onChange(formatRiskPct(clampStopOffsetPct(n)));

  return (
    <div className="risk-slider stop-offset-slider">
      <div className="risk-slider__head">
        <span className="field-label risk-slider__label">До стопа, %</span>
        <strong className="risk-slider__value">{formatRiskPct(current)}%</strong>
      </div>
      <input
        type="range"
        className="risk-slider__input"
        min={STOP_OFFSET_MIN_PCT}
        max={STOP_OFFSET_MAX_PCT}
        step={STOP_OFFSET_STEP}
        value={current}
        style={{ "--risk-pct": `${barPct}%` } as React.CSSProperties}
        onChange={(e) => setPercent(parseFloat(e.target.value))}
        aria-valuemin={STOP_OFFSET_MIN_PCT}
        aria-valuemax={STOP_OFFSET_MAX_PCT}
        aria-valuenow={current}
        aria-label="Процент до стопа"
      />
      <div className="risk-slider__marks stop-offset-slider__marks" aria-hidden>
        {STOP_OFFSET_MARKS.map((m) => (
          <button
            key={m}
            type="button"
            className={`risk-slider__mark${Math.abs(current - m) < STOP_OFFSET_STEP / 2 ? " on" : ""}`}
            onClick={() => setPercent(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
