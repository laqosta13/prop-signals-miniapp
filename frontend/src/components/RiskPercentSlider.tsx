import { roundStopPct } from "../utils/dailyStopLimit";
import { formatRiskPercent, parseRiskPercent } from "../utils/signalForm";
import { FormRangeSlider } from "./FormRangeSlider";

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
  const current = Math.min(parseRiskPercent(value), cap);

  const setPercent = (n: number) => {
    const clamped = Math.min(cap, Math.max(0, roundStopPct(n)));
    onChange(formatRiskPercent(clamped));
  };

  return (
    <FormRangeSlider
      label={label}
      hint={hint ?? (cap < 100 ? `макс. ${formatRiskPercent(cap)}%` : undefined)}
      value={current}
      onChange={setPercent}
      min={0}
      max={cap}
      step={STAKE_SLIDER_STEP}
      disabled={disabled || cap <= 0}
      formatValue={(n) => formatRiskPercent(n)}
      formatMark={(n) => formatRiskPercent(n)}
      ariaLabel={label}
    />
  );
}
