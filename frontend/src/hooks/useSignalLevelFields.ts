import { useCallback, useEffect, useRef, useState } from "react";
import { maxPriceStopPctForStopSlider, priceStopPctPreservingDailyRank } from "../utils/dailyStopLimit";
import {
  DEFAULT_STOP_RISK_PCT,
  STOP_OFFSET_MIN_PCT,
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
  const [rrRatio, setRrRatio] = useState<number | null>(3);
  const rrRatioRef = useRef<number | null>(3);
  rrRatioRef.current = rrRatio;

  const syncStopTarget = useCallback((entryVal: string, dir: "long" | "short", riskRaw: string) => {
    const ratio = rrRatioRef.current;
    const next = stopTargetFromEntryAndRisk(entryVal, dir, parseRiskPctValue(riskRaw), ratio ?? 3);
    if (!next) return;
    setStop(next.stop);
    if (ratio !== null) setTarget(next.target);
  }, []);

  const applyMarketPrice = useCallback(
    (price: number, dir: "long" | "short", priceRiskPct?: number) => {
      const risk = priceRiskPct ?? DEFAULT_STOP_RISK_PCT;
      const ratio = rrRatioRef.current ?? 3;
      const levels = levelsFromEntryAndRisk(price, dir, risk, ratio);
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
      const ratio = rrRatioRef.current;
      const next = stopTargetFromEntryAndRisk(entry, direction, pct, ratio ?? 3);
      if (!next) return;
      setStop(next.stop);
      if (ratio !== null) setTarget(next.target);
    },
    [direction, entry],
  );

  const riskPctRef = useRef(riskPct);
  riskPctRef.current = riskPct;
  const skipSyncRef = useRef(false);

  /** При смене входа или направления — стоп/цель заново от цены входа. */
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const ratio = rrRatioRef.current;
    const next = stopTargetFromEntryAndRisk(entry, direction, parseRiskPctValue(riskPctRef.current), ratio ?? 3);
    if (!next) return;
    setStop(next.stop);
    if (ratio !== null) setTarget(next.target);
  }, [entry, direction]);

  const onStopChange = useCallback(
    (value: string) => {
      setStop(value);
      const inferred = riskPctFromEntryStop(entry, value, direction);
      if (inferred === null) return;
      const pctLabel = formatRiskPct(clampStopOffsetPct(inferred));
      setRiskPct(pctLabel);
      const ratio = rrRatioRef.current;
      const next = stopTargetFromEntryAndRisk(entry, direction, clampStopOffsetPct(inferred), ratio ?? 3);
      if (next && ratio !== null) setTarget(next.target);
    },
    [direction, entry],
  );

  const onTargetChange = useCallback((value: string) => {
    setTarget(value);
  }, []);

  const onRrRatioChange = useCallback(
    (ratio: number | null) => {
      setRrRatio(ratio);
      rrRatioRef.current = ratio;
      if (ratio === null) return;
      const pct = parseRiskPctValue(riskPctRef.current);
      const next = stopTargetFromEntryAndRisk(entry, direction, pct, ratio);
      if (next) setTarget(next.target);
    },
    [entry, direction],
  );

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
        maxPriceStopPctForStopSlider(
          dailyRemainingRankPct,
          balanceUsd,
          rankMaxStakePct,
          stakePct,
          newLeverage,
        ),
      );
      const preserved = priceStopPctPreservingDailyRank(
        parseRiskPctValue(riskPct),
        prevLeverage,
        newLeverage,
      );
      const capped =
        cap >= STOP_OFFSET_MIN_PCT ? Math.min(preserved, cap) : preserved;
      const pricePct = clampStopOffsetPct(capped, cap >= STOP_OFFSET_MIN_PCT ? cap : STOP_OFFSET_SLIDER_CAP_PCT);
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
      skipSyncRef.current = true;
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
    rrRatio,
    setDirection,
    onEntryChange,
    onStopChange,
    onTargetChange,
    onRiskPctChange,
    onRrRatioChange,
    resyncStopTargetForLeverage,
    applyMarketPrice,
    resetForm,
    resetLevels,
    loadLevels,
  };
}
