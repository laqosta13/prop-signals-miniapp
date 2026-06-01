import { useCallback } from "react";
import { parseLeverage, parseRiskPercent } from "../utils/signalForm";
import {
  priceRiskLabelFromAccountStop,
  preserveAccountStopOnLeverageChange,
  resolveAccountStopPct,
} from "../utils/signalFormAccountStop";

type Params = {
  risk: string;
  setRisk: (v: string) => void;
  leverage: string;
  setLeverage: (v: string) => void;
  stakePct: number;
  lev: number;
  riskPct: string;
  entry: string;
  dailyRemaining?: number;
  accountStopSel: number | null;
  setAccountStopSel: (v: number | null) => void;
  onRiskPctChange: (priceRiskLabel: string) => void;
};

export function useSignalPositionControls({
  risk,
  setRisk,
  leverage,
  setLeverage,
  stakePct,
  lev,
  riskPct,
  entry,
  dailyRemaining,
  accountStopSel,
  setAccountStopSel,
  onRiskPctChange,
}: Params) {
  const applyAccountStop = useCallback(
    (account: number, nextStake: number, nextLev: number) => {
      setAccountStopSel(account);
      onRiskPctChange(priceRiskLabelFromAccountStop(account, nextStake, nextLev));
    },
    [setAccountStopSel, onRiskPctChange],
  );

  const onStakeChange = useCallback(
    (nextRisk: string) => {
      const account = resolveAccountStopPct({
        accountStopSel,
        entry,
        dailyRemaining,
        riskPct,
        stakePct,
        leverage: lev,
      });
      setRisk(nextRisk);
      const newStake = parseRiskPercent(nextRisk);
      if (account != null && newStake > 0) applyAccountStop(account, newStake, lev);
    },
    [accountStopSel, entry, dailyRemaining, riskPct, stakePct, lev, setRisk, applyAccountStop],
  );

  const onLeverageChange = useCallback(
    (nextLev: string, nextRiskFromPicker?: string) => {
      const prevLev = parseLeverage(leverage);
      const nextLevNum = parseLeverage(nextLev);
      const nextStake = nextRiskFromPicker != null ? parseRiskPercent(nextRiskFromPicker) : stakePct;

      setLeverage(nextLev);
      if (nextRiskFromPicker != null) setRisk(nextRiskFromPicker);

      const account = resolveAccountStopPct({
        accountStopSel,
        entry,
        dailyRemaining,
        riskPct,
        stakePct,
        leverage: prevLev,
      });

      if (account != null && nextStake > 0) {
        applyAccountStop(account, nextStake, nextLevNum);
        return;
      }

      const nextPrice = preserveAccountStopOnLeverageChange({
        riskPct,
        prevStakePct: stakePct,
        prevLeverage: prevLev,
        nextStakePct: nextStake,
        nextLeverage: nextLevNum,
        dailyRemaining: dailyRemaining ?? 2,
      });
      if (nextPrice) onRiskPctChange(nextPrice);
    },
    [
      leverage,
      stakePct,
      riskPct,
      entry,
      dailyRemaining,
      accountStopSel,
      setLeverage,
      setRisk,
      applyAccountStop,
      onRiskPctChange,
    ],
  );

  return { onStakeChange, onLeverageChange };
}
