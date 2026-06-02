import { useCallback, useEffect, useRef, type RefObject } from "react";
import { fetchMarketPrice } from "../api";
import type { TrackerSnapshot } from "./useAdminTrackerSnapshot";
import { parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { parseRiskPctValue } from "../utils/signalLevels";
import {
  defaultStakePct,
  formatDefaultPriceRiskForForm,
  formatStakeForForm,
  type RankDailyStopContext,
} from "../utils/signalFormLimits";

type Args = {
  open: boolean;
  symbol: string;
  /** Доля входа % — только для пересчёта при смене тикера. */
  stakePctLabel: string;
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
  stakePctLabel,
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
  const lastSymbolRef = useRef("");
  const riskPctRef = useRef(riskPct);
  riskPctRef.current = riskPct;

  const loadMarketPrice = useCallback(
    async (sym: string, opts: { stakePct?: number; priceRiskPct?: number; withTracker?: boolean }) => {
      const normalized = sym.trim().toUpperCase();
      if (!normalized) return;
      setPriceLoading(true);
      try {
        const { price } = await fetchMarketPrice(normalized);
        const dir = directionRef.current ?? "long";
        const withTracker = opts.withTracker ?? false;

        if (!withTracker || !trackerSnap) {
          const risk = opts.priceRiskPct ?? parseRiskPctValue(riskPctRef.current);
          applyMarketPrice(price, dir, risk);
          setError(null);
          return;
        }

        const lev = parseLeverage(leverage);
        const stakePct =
          opts.stakePct ??
          defaultStakePct(trackerSnap.maxStakePct);
        const balance = trackerSnap.balance > 0 ? trackerSnap.balance : trackerSnap.accountSize;

        const rankStopCtx: RankDailyStopContext = {
          dailyLossUsd: trackerSnap.dailyLossUsd,
          balanceUsd: balance,
          rankMaxStakePct: trackerSnap.rankMaxStakePct,
          stakePct,
          leverage: lev,
        };
        const priceRisk =
          opts.priceRiskPct ?? parseRiskPctValue(formatDefaultPriceRiskForForm(rankStopCtx));

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

  // Первичная инициализация: доля входа + вход по Bybit + стоп 0.7% (в пределах лимита).
  useEffect(() => {
    if (skipTrackerInit || !open || trackerLoading || !trackerSnap) return;
    const tKey = `${trackerSnap.dailyLossUsd}|${trackerSnap.rankMaxStakePct}|${trackerSnap.maxStakePct}|${trackerSnap.stakePoolRemainingPct}`;
    if (trackerInitRef.current === tKey) return;
    trackerInitRef.current = tKey;

    const stakeDefault = defaultStakePct(trackerSnap.maxStakePct);
    setRisk(formatStakeForForm(trackerSnap.maxStakePct));
    lastSymbolRef.current = symbol.trim().toUpperCase();
    const t = window.setTimeout(
      () => void loadMarketPrice(symbol, { stakePct: stakeDefault, withTracker: true }),
      150,
    );
    return () => clearTimeout(t);
  }, [open, symbol, skipTrackerInit, trackerLoading, trackerSnap, setRisk, loadMarketPrice]);

  // Смена тикера: только цена входа, % стопа не сбрасываем.
  useEffect(() => {
    if (!open || !symbol.trim()) return;
    const sym = symbol.trim().toUpperCase();
    if (sym === lastSymbolRef.current) return;
    lastSymbolRef.current = sym;

    const t = window.setTimeout(() => {
      const keepRisk = parseRiskPctValue(riskPctRef.current);
      if (trackerSnap && !trackerLoading) {
        void loadMarketPrice(symbol, {
          stakePct: parseRiskPercent(stakePctLabel),
          priceRiskPct: keepRisk,
          withTracker: true,
        });
        return;
      }
      if (!trackerSnap && !trackerLoading) {
        void loadMarketPrice(symbol, { priceRiskPct: keepRisk, withTracker: false });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [open, symbol, stakePctLabel, trackerSnap, trackerLoading, loadMarketPrice]);

  const resetInitKey = useCallback(() => {
    trackerInitRef.current = null;
    lastSymbolRef.current = "";
  }, []);

  return { resetInitKey };
}
