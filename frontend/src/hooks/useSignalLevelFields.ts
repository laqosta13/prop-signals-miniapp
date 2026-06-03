import { useCallback, useEffect, useRef, useState } from "react";
import { maxPriceStopPctForStopSlider, priceStopPctPreservingAccountRisk } from "../utils/dailyStopLimit";
import {
  DEFAULT_STOP_RISK_PCT,
  STOP_OFFSET_SLIDER_CAP_PCT,
  clampStopOffsetPct,
  formatRiskPct,
  levelsFromEntryAndRisk,
  parseEntryPrice,
  parseRiskPctValue,
  riskPctFromEntryStop,
  stopTargetFromEntryAndRisk,
} from "../utils/signalLevels";

export type ResyncStopForLeverageOpts = {
  prevLeverage: number;
  newLeverage: number;
  stakePct: number;
  dailyRemainingRankPct: number;
  balanceUsd: number;
  rankMaxStakePct: number;
};

export function useSignalLevelFields(initialDirection: "long" | "short" = "long") {
  const [direction, setDirectionState] = useState<"long" | "short">(initialDirection);
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [riskPct, setRiskPct] = useState(String(DEFAULT_STOP_RISK_PCT));

  const syncStopTarget = useCallback((entryVal: string, dir: "long" | "short", riskRaw: string) => {
    const next = stopTargetFromEntryAndRisk(entryVal, dir, parseRiskPctValue(riskRaw));
    if (!next) return;
    setStop(next.stop);
    setTarget(next.target);
  }, []);

  const applyMarketPrice = useCallback(
    (price: number, dir: "long" | "short", priceRiskPct?: number) => {
      const risk = priceRiskPct ?? DEFAULT_STOP_RISK_PCT;
      const levels = levelsFromEntryAndRisk(price, dir, risk);
      setEntry(levels.entry);
      setStop(levels.stop);
      setTarget(levels.target);
      setRiskPct(formatRiskPct(risk));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setDirectionState("long");
    setEntry("");
    setStop("");
    setTarget("");
    setRiskPct(String(DEFAULT_STOP_RISK_PCT));
  }, []);

  const resetLevels = useCallback(() => {
    setEntry("");
    setStop("");
    setTarget("");
    setRiskPct(String(DEFAULT_STOP_RISK_PCT));
  }, []);

  const onEntryChange = useCallback(
    (value: string) => {
      setEntry(value);
      syncStopTarget(value, direction, riskPct);
    },
    [direction, riskPct, syncStopTarget],
  );

  const onRiskPctChange = useCallback(
    (value: string) => {
      setRiskPct(value);
      const pct = parseRiskPctValue(value);
      const next = stopTargetFromEntryAndRisk(entry, direction, pct);
      if (!next) return;
      setStop(next.stop);
      setTarget(next.target);
    },
    [direction, entry],
  );

  const riskPctRef = useRef(riskPct);
  riskPctRef.current = riskPct;

  /** При смене входа или направления — стоп/цель заново от цены входа. */
  useEffect(() => {
    const next = stopTargetFromEntryAndRisk(entry, direction, parseRiskPctValue(riskPctRef.current));
    if (!next) return;
    setStop(next.stop);
    setTarget(next.target);
  }, [entry, direction]);

  const onStopChange = useCallback(
    (value: string) => {
      setStop(value);
      const inferred = riskPctFromEntryStop(entry, value, direction);
      if (inferred === null) return;
      const pctLabel = formatRiskPct(clampStopOffsetPct(inferred));
      setRiskPct(pctLabel);
      const next = stopTargetFromEntryAndRisk(entry, direction, clampStopOffsetPct(inferred));
      if (next) setTarget(next.target);
    },
    [direction, entry],
  );

  const onTargetChange = useCallback((value: string) => {
    setTarget(value);
  }, []);

  const setDirection = useCallback(
    (dir: "long" | "short") => {
      setDirectionState(dir);
      syncStopTarget(entry, dir, riskPct);
    },
    [entry, riskPct, syncStopTarget],
  );

  /** Смена плеча: риск счёта на стопе сохраняем → % от входа и цены стоп/цель 1:3 пересчитываем. */
  const resyncStopTargetForLeverage = useCallback(
    ({
      prevLeverage,
      newLeverage,
      stakePct,
      dailyRemainingRankPct,
      balanceUsd,
      rankMaxStakePct,
    }: ResyncStopForLeverageOpts) => {
      if (parseEntryPrice(entry) === null || stakePct <= 0 || newLeverage < 1) return;

      const cap = Math.min(
        STOP_OFFSET_SLIDER_CAP_PCT,
        maxPriceStopPctForStopSlider(dailyRemainingRankPct, balanceUsd, rankMaxStakePct, newLeverage),
      );
      const preserved = priceStopPctPreservingAccountRisk(
        parseRiskPctValue(riskPct),
        stakePct,
        prevLeverage,
        newLeverage,
      );
      const pricePct = clampStopOffsetPct(Math.min(preserved, cap > 0 ? cap : preserved), cap);
      const label = formatRiskPct(pricePct);
      setRiskPct(label);
      const next = stopTargetFromEntryAndRisk(entry, direction, pricePct);
      if (!next) return;
      setStop(next.stop);
      setTarget(next.target);
    },
    [entry, direction, riskPct],
  );

  const loadLevels = useCallback(
    (params: {
      entryVal: string;
      stopVal: string;
      targetVal: string;
      dir: "long" | "short";
    }) => {
      const { entryVal, stopVal, targetVal, dir } = params;
      setDirectionState(dir);
      setEntry(entryVal);
      setStop(stopVal);
      setTarget(targetVal);
      const inferred = riskPctFromEntryStop(entryVal, stopVal, dir);
      setRiskPct(inferred != null ? formatRiskPct(inferred) : String(DEFAULT_STOP_RISK_PCT));
    },
    [],
  );

  return {
    direction,
    entry,
    stop,
    target,
    riskPct,
    setDirection,
    onEntryChange,
    onStopChange,
    onTargetChange,
    onRiskPctChange,
    resyncStopTargetForLeverage,
    applyMarketPrice,
    resetForm,
    resetLevels,
    loadLevels,
  };
}
