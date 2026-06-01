import { useCallback, useEffect, useRef, type RefObject } from "react";
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

type Args = {
  open: boolean;
  symbol: string;
  leverage: string;
  riskPct: string;
  trackerSnap: TrackerSnapshot | null;
  trackerLoading: boolean;
  directionRef: RefObject<"long" | "short">;
  applyMarketPrice: (price: number, dir: "long" | "short", priceRiskPct?: number) => void;
  setRisk: (v: string) => void;
  setPriceLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
};

export function useSignalMarketPriceInit({
  open,
  symbol,
  leverage,
  riskPct,
  trackerSnap,
  trackerLoading,
  directionRef,
  applyMarketPrice,
  setRisk,
  setPriceLoading,
  setError,
}: Args) {
  const initKeyRef = useRef<string | null>(null);
  const riskPctRef = useRef(riskPct);
  riskPctRef.current = riskPct;

  const loadMarketPrice = useCallback(
    async (sym: string, stake?: number, withTracker = true) => {
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
          stake ?? defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct);
        const accountStop = accountStopPctFromTracker(trackerSnap.dailyLossPct);
        const priceRisk =
          accountStop != null
            ? parseRiskPctValue(formatPriceRiskFromAccountStop(accountStop, stakePct, lev))
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

  // Курс Bybit сразу; после трекера — пересчёт уровней по лимитам
  useEffect(() => {
    if (!open || trackerSnap) return;
    const bareKey = `${symbol}|bare`;
    if (initKeyRef.current === bareKey) return;
    initKeyRef.current = bareKey;
    const t = window.setTimeout(() => void loadMarketPrice(symbol, undefined, false), 150);
    return () => clearTimeout(t);
  }, [open, symbol, trackerSnap, loadMarketPrice]);

  // Полные уровни после трекера (лимиты + stake)
  useEffect(() => {
    if (!open || trackerLoading || !trackerSnap) return;

    const key = `${symbol}|${trackerSnap.dailyLossPct}|${trackerSnap.maxStakePct}|${trackerSnap.stakePoolRemainingPct}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const stakeDefault = defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct);
    setRisk(formatStakeForForm(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct));
    const t = window.setTimeout(() => void loadMarketPrice(symbol, stakeDefault, true), 150);
    return () => clearTimeout(t);
  }, [open, symbol, trackerLoading, trackerSnap, setRisk, loadMarketPrice]);

  const resetInitKey = useCallback(() => {
    initKeyRef.current = null;
  }, []);

  return { resetInitKey };
}
