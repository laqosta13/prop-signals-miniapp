import { useCallback, useState } from "react";
import {
  DEFAULT_STOP_RISK_PCT,
  formatRiskPct,
  levelsFromEntryAndRisk,
  parseRiskPctValue,
  riskPctFromEntryStop,
  stopTargetFromEntryAndRisk,
} from "../utils/signalLevels";

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

  const applyMarketPrice = useCallback((price: number, dir: "long" | "short") => {
    const levels = levelsFromEntryAndRisk(price, dir, DEFAULT_STOP_RISK_PCT);
    setEntry(levels.entry);
    setStop(levels.stop);
    setTarget(levels.target);
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
      const trimmed = value.trim().replace(",", ".");
      if (!trimmed) return;
      const pct = parseFloat(trimmed);
      if (!Number.isFinite(pct) || pct <= 0) return;
      const next = stopTargetFromEntryAndRisk(entry, direction, pct);
      if (!next) return;
      setStop(next.stop);
      setTarget(next.target);
    },
    [direction, entry],
  );

  const onStopChange = useCallback(
    (value: string) => {
      setStop(value);
      const inferred = riskPctFromEntryStop(entry, value, direction);
      if (inferred === null) return;
      const pctLabel = formatRiskPct(inferred);
      setRiskPct(pctLabel);
      const next = stopTargetFromEntryAndRisk(entry, direction, inferred);
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
    applyMarketPrice,
    resetLevels,
    loadLevels,
  };
}
