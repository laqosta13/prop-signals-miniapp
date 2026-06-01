import { useEffect } from "react";
import {
  accountRiskToPriceStopPct,
  ACCOUNT_STOP_MIN_STEP,
  dailyStopRemainingPct,
  priceStopToAccountRiskPct,
} from "../utils/dailyStopLimit";
import { formatRiskPct, parseRiskPctValue } from "../utils/signalLevels";

export { preserveAccountStopOnLeverageChange } from "../utils/signalFormAccountStop";

export function useDailyStopSync(opts: {
  enabled: boolean;
  riskPct: string;
  onRiskPctChange: (value: string) => void;
  dailyLossPct: number | undefined;
  stakePct: number;
  leverage: number;
  onAccountStopClamped?: (accountPct: number) => void;
}) {
  const { enabled, riskPct, onRiskPctChange, dailyLossPct, stakePct, leverage, onAccountStopClamped } =
    opts;
  const dailyRemaining =
    dailyLossPct !== undefined ? dailyStopRemainingPct(dailyLossPct) : undefined;
  const blocked = dailyRemaining !== undefined && dailyRemaining < ACCOUNT_STOP_MIN_STEP;

  useEffect(() => {
    if (!enabled || dailyRemaining === undefined || dailyRemaining < ACCOUNT_STOP_MIN_STEP) return;
    const account = priceStopToAccountRiskPct(parseRiskPctValue(riskPct), stakePct, leverage);
    if (account > dailyRemaining + 0.005) {
      const pricePct = accountRiskToPriceStopPct(dailyRemaining, stakePct, leverage);
      if (pricePct > 0) {
        onAccountStopClamped?.(dailyRemaining);
        onRiskPctChange(formatRiskPct(Math.max(ACCOUNT_STOP_MIN_STEP, pricePct)));
      }
    }
  }, [enabled, dailyRemaining, stakePct, leverage, riskPct, onRiskPctChange, onAccountStopClamped]);

  return {
    dailyRemaining,
    dailyLossPct: dailyLossPct ?? 0,
    blocked,
  };
}
