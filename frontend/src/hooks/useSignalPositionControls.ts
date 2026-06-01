import { useCallback } from "react";
import { parseLeverage, parseRiskPercent } from "../utils/signalForm";

type Params = {
  risk: string;
  setRisk: (v: string) => void;
  leverage: string;
  setLeverage: (v: string) => void;
  riskPct: string;
  onRiskPctChange: (priceRiskLabel: string) => void;
};

/** Смена доли входа / плеча — сохраняем % движения цены от входа до стопа. */
export function useSignalPositionControls({
  risk,
  setRisk,
  leverage,
  setLeverage,
  riskPct,
  onRiskPctChange,
}: Params) {
  const onStakeChange = useCallback(
    (nextRisk: string) => {
      setRisk(nextRisk);
      onRiskPctChange(riskPct);
    },
    [riskPct, setRisk, onRiskPctChange],
  );

  const onLeverageChange = useCallback(
    (nextLev: string, nextRiskFromPicker?: string) => {
      setLeverage(nextLev);
      if (nextRiskFromPicker != null) setRisk(nextRiskFromPicker);
      onRiskPctChange(riskPct);
    },
    [riskPct, setLeverage, setRisk, onRiskPctChange],
  );

  return { onStakeChange, onLeverageChange };
}
