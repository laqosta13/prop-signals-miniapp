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

/** Смена доли входа / плеча — % до стопа от цены не меняется, уровни пересчитываются. */
export function useSignalPositionControls({
  risk,
  setRisk,
  leverage,
  setLeverage,
  riskPct,
  onRiskPctChange,
}: Params) {
  const resyncLevels = useCallback(() => {
    onRiskPctChange(riskPct);
  }, [onRiskPctChange, riskPct]);

  const onStakeChange = useCallback(
    (nextRisk: string) => {
      setRisk(nextRisk);
      resyncLevels();
    },
    [setRisk, resyncLevels],
  );

  const onLeverageChange = useCallback(
    (nextLev: string, nextRiskFromPicker?: string) => {
      setLeverage(nextLev);
      if (nextRiskFromPicker != null) setRisk(nextRiskFromPicker);
      resyncLevels();
    },
    [setLeverage, setRisk, resyncLevels],
  );

  return { onStakeChange, onLeverageChange };
}
