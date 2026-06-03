import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createCultCandidateSignal, fetchCopyTradingStatus } from "../api";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { useSignalMarketPriceInit } from "../hooks/useSignalMarketPriceInit";
import { buildSignalFormData } from "../utils/buildSignalFormData";
import { parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { SignalLevelsFields } from "./SignalLevelsFields";
import { SignalFormDealSection } from "./signal-form/SignalFormDealSection";
import { SignalFormPositionCard } from "./signal-form/SignalFormPositionCard";
import { SignalFormSection } from "./signal-form/SignalFormSection";
import { SignalFormShell } from "./signal-form/SignalFormShell";
import { SignalFormSubmitFooter } from "./signal-form/SignalFormSubmitFooter";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const DEFAULT_SYMBOL = "BTCUSDT";

export function CultCandidateSignalModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [leverage, setLeverage] = useState("1");
  const [risk, setRisk] = useState("10");
  const [comment, setComment] = useState("");
  const [balanceUsd, setBalanceUsd] = useState(10_000);

  const {
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
  } = useSignalLevelFields("long");
  const directionRef = useRef(direction);
  directionRef.current = direction;

  const stakePct = parseRiskPercent(risk);
  const lev = parseLeverage(leverage);

  const { resetInitKey } = useSignalMarketPriceInit({
    open,
    symbol,
    stakePctLabel: risk,
    leverage,
    riskPct,
    trackerSnap: null,
    trackerLoading: false,
    directionRef,
    applyMarketPrice,
    setRisk,
    setPriceLoading,
    setError,
    skipTrackerInit: true,
  });

  useEffect(() => {
    if (!open) return;
    void fetchCopyTradingStatus()
      .then((s) => {
        const b = s.usdt_balance ?? s.account_balance_usd;
        if (b != null && b > 0) setBalanceUsd(b);
        if (s.stake_percent > 0) setRisk(String(s.stake_percent));
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) resetInitKey();
  }, [open, resetInitKey]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSymbol(DEFAULT_SYMBOL);
    setLeverage("1");
    setComment("");
    resetForm();
  }, [open, resetForm]);

  if (!open) return null;

  const stakeUsd = balanceUsd > 0 ? (balanceUsd * stakePct * lev) / 100 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = buildSignalFormData({
        symbol,
        direction,
        entry,
        stop,
        target,
        comment,
        leverage,
        risk,
        screenshot: null,
        video: null,
      });
      await createCultCandidateSignal(fd);
      WebApp.HapticFeedback.notificationOccurred("success");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignalFormShell
      title="Сделка кандидата"
      subtitle="Отправка на ваш Bybit"
      onClose={onClose}
      onBackdropClick={onClose}
      onSubmit={submit}
    >
      <p className="meta cult-candidate-signal-hint">
        Сигнал не попадает в общую ленту — только в вашу карточку в ТОП. Исполнение через подключённый API Bybit.
      </p>

      <SignalFormSection title="Сделка">
        <SignalFormDealSection
          symbol={symbol}
          onSymbolChange={setSymbol}
          direction={direction}
          onDirectionChange={setDirection}
        />
      </SignalFormSection>

      <SignalFormSection title="Уровни">
        <SignalLevelsFields
          entry={entry}
          direction={direction}
          stop={stop}
          target={target}
          riskPct={riskPct}
          priceLoading={priceLoading}
          onEntryChange={onEntryChange}
          onStopChange={onStopChange}
          onTargetChange={onTargetChange}
          onRiskPctChange={onRiskPctChange}
          stakePct={stakePct}
          leverage={lev}
          dailyStopBlocked={false}
        />
      </SignalFormSection>

      <SignalFormSection title="Размер позиции">
        <SignalFormPositionCard
          leverage={leverage}
          onLeverageChange={(lev) => {
            const prev = parseLeverage(leverage);
            const next = parseLeverage(lev);
            setLeverage(lev);
            resyncStopTargetForLeverage({
              prevLeverage: prev,
              newLeverage: next,
              stakePct,
            });
          }}
          risk={risk}
          onRiskChange={setRisk}
          maxStakePct={100}
          balanceUsd={balanceUsd}
          stakeUsd={stakeUsd}
          stakePct={stakePct}
          lev={lev}
        />
      </SignalFormSection>

      <SignalFormSection title="Комментарий">
        <textarea
          className="signal-form-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Необязательно"
          rows={2}
        />
      </SignalFormSection>

      <SignalFormSubmitFooter
        error={error}
        submitting={submitting}
        uploadProgress={null}
        hasVideo={false}
        disabled={false}
        publishLabel="Отправить на Bybit"
      />
    </SignalFormShell>
  );
}
