import { useCallback, useEffect, useRef, type RefObject } from "react";
import { fetchMarketPrice } from "../api";
import type { TrackerSnapshot } from "./useAdminTrackerSnapshot";
import { parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { parseRiskPctValue } from "../utils/signalLevels";
import {
  accountStopPctFromTracker,
  defaultStakePct,
  formatPriceRiskForForm,
  formatStakeForForm,
} from "../utils/signalFormLimits";

type Args = {
  open: boolean;
  symbol: string;
  risk: string;
  leverage: string;
  riskPct: string;
  trackerSnap: TrackerSnapshot | null;
  trackerLoading: boolean;
  directionRef: RefObject<"long" | "short">;
  applyMarketPrice: (price: number, dir: "long" | "short", priceRiskPct?: number) => void;
  setRisk: (v: string) => void;
  setPriceLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  skipTrackerInit?: boolean;
};

export function useSignalMarketPriceInit({
  open,
  symbol,
  risk,
  leverage,
  riskPct,
  trackerSnap,
  trackerLoading,
  directionRef,
  applyMarketPrice,
  setRisk,
  setPriceLoading,
  setError,
  skipTrackerInit = false,
}: Args) {
  const trackerInitRef = useRef<string | null>(null);
  const riskPctRef = useRef(riskPct);
  riskPctRef.current = riskPct;

  const loadMarketPrice = useCallback(
    async (sym: string, stakeOverride?: number, withTracker = true) => {
      const normalized = sym.trim().toUpperCase();
      if (!normalized) return;
      setPriceLoading(true);
      try {
        const { price } = await fetchMarketPrice(normalized);
        const dir = directionRef.current ?? "long";
        const lev = parseLeverage(leverage);

        if (!withTracker || !trackerSnap) {
          applyMarketPrice(price, dir);
          setError(null);
          return;
        }

        const stakePct =
          stakeOverride ??
          defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct);
        const balance = trackerSnap.balance > 0 ? trackerSnap.balance : trackerSnap.accountSize;
        const accountStop = accountStopPctFromTracker(trackerSnap.dailyLossPct);
        const priceRisk =
          accountStop != null
            ? parseRiskPctValue(
                formatPriceRiskForForm(trackerSnap.dailyLossPct, balance, stakePct, lev),
              )
            : parseRiskPctValue(riskPctRef.current);
        applyMarketPrice(price, dir, priceRisk);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить курс");
      } finally {
        setPriceLoading(false);
      }
    },
    [trackerSnap, leverage, applyMarketPrice, directionRef, setPriceLoading, setError],
  );

  useEffect(() => {
    if (skipTrackerInit || !open || trackerLoading || !trackerSnap) return;
    const tKey = `${trackerSnap.dailyLossPct}|${trackerSnap.maxStakePct}|${trackerSnap.stakePoolRemainingPct}`;
    if (trackerInitRef.current === tKey) return;
    trackerInitRef.current = tKey;

    const stakeDefault = defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct);
    setRisk(formatStakeForForm(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct));
    const t = window.setTimeout(() => void loadMarketPrice(symbol, stakeDefault, true), 150);
    return () => clearTimeout(t);
  }, [open, symbol, skipTrackerInit, trackerLoading, trackerSnap, setRisk, loadMarketPrice]);

  useEffect(() => {
    if (!open || !symbol.trim()) return;
    const t = window.setTimeout(() => {
      if (trackerSnap && !trackerLoading) {
        void loadMarketPrice(symbol, parseRiskPercent(risk), true);
        return;
      }
      if (!trackerSnap && !trackerLoading) {
        void loadMarketPrice(symbol, undefined, false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [open, symbol, trackerSnap, trackerLoading, risk, loadMarketPrice]);

  const resetInitKey = useCallback(() => {
    trackerInitRef.current = null;
  }, []);

  return { resetInitKey };
}
