import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { fetchMarketPrice } from "../api";
import type { TrackerSnapshot } from "./useAdminTrackerSnapshot";
import { parseLeverage } from "../utils/signalForm";
import { parseRiskPctValue } from "../utils/signalLevels";
import {
  accountStopPctFromTracker,
  defaultStakePct,
  formatPriceRiskFromAccountStop,
  formatStakeForForm,
} from "../utils/signalFormLimits";

type LevelsApi = {
  riskPct: string;
  applyMarketPrice: (price: number, dir: "long" | "short", priceRiskPct?: number) => void;
};

type Args = {
  open: boolean;
  symbol: string;
  leverage: string;
  trackerSnap: TrackerSnapshot | null;
  trackerLoading: boolean;
  directionRef: MutableRefObject<"long" | "short">;
  levels: LevelsApi;
  setRisk: (v: string) => void;
  setAccountStopSel: (v: number | null) => void;
  setPriceLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
};

export function useSignalMarketPriceInit({
  open,
  symbol,
  leverage,
  trackerSnap,
  trackerLoading,
  directionRef,
  levels,
  setRisk,
  setAccountStopSel,
  setPriceLoading,
  setError,
}: Args) {
  const initKeyRef = useRef<string | null>(null);

  const loadMarketPrice = useCallback(
    async (sym: string, stake?: number) => {
      const normalized = sym.trim().toUpperCase();
      if (!normalized || !trackerSnap) return;
      setPriceLoading(true);
      try {
        const { price } = await fetchMarketPrice(normalized);
        const stakePct =
          stake ?? defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct);
        const lev = parseLeverage(leverage);
        const accountStop = accountStopPctFromTracker(trackerSnap.dailyLossPct);
        if (accountStop != null) setAccountStopSel(accountStop);
        const priceRisk =
          accountStop != null
            ? parseRiskPctValue(formatPriceRiskFromAccountStop(accountStop, stakePct, lev))
            : parseRiskPctValue(levels.riskPct);
        levels.applyMarketPrice(price, directionRef.current, priceRisk);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить курс");
      } finally {
        setPriceLoading(false);
      }
    },
    [
      trackerSnap,
      leverage,
      levels,
      directionRef,
      setAccountStopSel,
      setPriceLoading,
      setError,
    ],
  );

  useEffect(() => {
    if (!open) {
      initKeyRef.current = null;
      return;
    }
    if (trackerLoading || !trackerSnap) return;

    const key = `${symbol}|${trackerSnap.dailyLossPct}|${trackerSnap.maxStakePct}|${trackerSnap.stakePoolRemainingPct}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const stakeDefault = defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct);
    setRisk(formatStakeForForm(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct));
    const t = window.setTimeout(() => void loadMarketPrice(symbol, stakeDefault), 150);
    return () => clearTimeout(t);
  }, [open, symbol, trackerLoading, trackerSnap, setRisk, loadMarketPrice]);

  return {
    resetInitKey: () => {
      initKeyRef.current = null;
    },
  };
}
