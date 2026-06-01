import { useCallback } from "react";
import { parseLeverage, parseRiskPercent } from "../utils/signalForm";
import {
  inferAccountStopFromPriceRisk,
  preserveAccountStopOnPositionChange,
} from "../utils/signalFormAccountStop";

type Params = {
  risk: string;
  setRisk: (v: string) => void;
  leverage: string;
  setLeverage: (v: string) => void;
  stakePct: number;
  lev: number;
  riskPct: string;
  balanceUsd: number;
  onRiskPctChange: (priceRiskLabel: string) => void;
};

/** Смена доли входа / плеча — сохраняем % риска счёта, пересчитываем % цены от номинала. */
export function useSignalPositionControls({
  risk,
  setRisk,
  leverage,
  setLeverage,
  stakePct,
  lev,
  riskPct,
  balanceUsd,
  onRiskPctChange,
}: Params) {
  const onStakeChange = useCallback(
    (nextRisk: string) => {
      const account = inferAccountStopFromPriceRisk(riskPct, balanceUsd, stakePct, lev);
      setRisk(nextRisk);
      const newStake = parseRiskPercent(nextRisk);
      if (account == null || newStake <= 0 || balanceUsd <= 0) {
        onRiskPctChange(riskPct);
        return;
      }
      const nextPrice = preserveAccountStopOnPositionChange({
        accountStopPct: account,
        balanceUsd,
        nextStakePct: newStake,
        nextLeverage: lev,
      });
      if (nextPrice) onRiskPctChange(nextPrice);
    },
    [riskPct, balanceUsd, stakePct, lev, setRisk, onRiskPctChange],
  );

  const onLeverageChange = useCallback(
    (nextLev: string, nextRiskFromPicker?: string) => {
      const prevLev = parseLeverage(leverage);
      const nextLevNum = parseLeverage(nextLev);
      const nextStake = nextRiskFromPicker != null ? parseRiskPercent(nextRiskFromPicker) : stakePct;
      const account = inferAccountStopFromPriceRisk(riskPct, balanceUsd, stakePct, prevLev);

      setLeverage(nextLev);
      if (nextRiskFromPicker != null) setRisk(nextRiskFromPicker);

      if (account != null && nextStake > 0 && balanceUsd > 0) {
        const nextPrice = preserveAccountStopOnPositionChange({
          accountStopPct: account,
          balanceUsd,
          nextStakePct: nextStake,
          nextLeverage: nextLevNum,
        });
        if (nextPrice) onRiskPctChange(nextPrice);
        return;
      }
      onRiskPctChange(riskPct);
    },
    [leverage, stakePct, riskPct, balanceUsd, setLeverage, setRisk, onRiskPctChange],
  );

  return { onStakeChange, onLeverageChange };
}
