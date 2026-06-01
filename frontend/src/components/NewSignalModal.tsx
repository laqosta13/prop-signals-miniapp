import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignalWithMedia } from "../api";
import type { UploadProgress } from "../api";
import { useSignalFormTracker } from "../hooks/useSignalFormTracker";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { useSignalMarketPriceInit } from "../hooks/useSignalMarketPriceInit";
import { useSignalPositionControls } from "../hooks/useSignalPositionControls";
import { buildSignalFormData } from "../utils/buildSignalFormData";
import { initialUploadProgress, mediaBytesInForm } from "../utils/upload";
import { SignalLevelsFields } from "./SignalLevelsFields";
import { SignalMediaPicker } from "./SignalMediaPicker";
import { SignalFormCommentSection } from "./signal-form/SignalFormCommentSection";
import { SignalFormDealSection } from "./signal-form/SignalFormDealSection";
import { SignalFormLimitsBar } from "./signal-form/SignalFormLimitsBar";
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

export function NewSignalModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [leverage, setLeverage] = useState("1");
  const [risk, setRisk] = useState("10");
  const [comment, setComment] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
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
    applyMarketPrice,
    resetForm,
  } = useSignalLevelFields("long");
  const directionRef = useRef(direction);
  directionRef.current = direction;

  const tracker = useSignalFormTracker(open, { riskPct, onRiskPctChange }, { risk, setRisk }, leverage);

  const balance = tracker.balanceForNominal();

  const { onStakeChange, onLeverageChange } = useSignalPositionControls({
    risk,
    setRisk,
    leverage,
    setLeverage,
    riskPct,
    onRiskPctChange,
  });

  const { resetInitKey } = useSignalMarketPriceInit({
    open,
    symbol,
    stakePctLabel: risk,
    leverage,
    riskPct,
    trackerSnap: tracker.trackerSnap,
    trackerLoading: tracker.trackerLoading,
    directionRef,
    applyMarketPrice,
    setRisk,
    setPriceLoading,
    setError,
  });

  useEffect(() => {
    if (!open) resetInitKey();
  }, [open, resetInitKey]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSymbol(DEFAULT_SYMBOL);
    setLeverage("1");
    setRisk("10");
    setComment("");
    resetForm();
    setScreenshot(null);
    setVideo(null);
    setShotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, resetForm]);

  if (!open) return null;

  const formBlocked = tracker.dailyLimit.blocked || tracker.stakePoolBlocked;

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
        screenshot,
        video,
      });
      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      setUploadProgress(trackUpload ? initialUploadProgress(uploadBytes) : null);
      await createSignalWithMedia(fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      WebApp.HapticFeedback.notificationOccurred("success");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <SignalFormShell
      title="Новый сигнал"
      subtitle="Публикация в ленту"
      onClose={onClose}
      onBackdropClick={onClose}
      onSubmit={submit}
    >
      <SignalFormLimitsBar
        active
        loading={tracker.trackerLoading}
        dailyRemaining={tracker.dailyRemaining}
        dailyTradesRemaining={tracker.dailyTradesRemainingCount}
        dailyTradesLimit={tracker.dailyTradesLimit}
        stakePoolUsedPct={tracker.trackerSnap?.stakePoolUsedPct}
        stakePoolRemainingPct={tracker.trackerSnap?.stakePoolRemainingPct}
        dailyBlocked={tracker.dailyLimit.blocked}
        dailyBlockReason={tracker.dailyLimit.reason}
        stakePoolBlocked={tracker.stakePoolBlocked}
        maxStakePct={tracker.maxStakePct}
      />

      <SignalFormSection title="Сделка">
        <SignalFormDealSection
          symbol={symbol}
          onSymbolChange={setSymbol}
          direction={direction}
          onDirectionChange={setDirection}
        />
      </SignalFormSection>

      <SignalFormSection
        title="Уровни"
        hint={priceLoading ? "Курс Bybit…" : "Perp USDT · стоп 2% от входа · цель 1:3"}
      >
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
          stakePct={tracker.stakePct}
          leverage={tracker.lev}
          dailyRemainingPct={tracker.dailyRemainingRank}
          dailyLossUsd={tracker.dailyLossUsd}
          balanceUsd={balance}
          rankMaxStakePct={tracker.rankMaxStakePct}
          dailyStopBlocked={tracker.dailyStopBlocked}
        />
      </SignalFormSection>

      <SignalFormSection title="Размер позиции">
        <SignalFormPositionCard
          leverage={leverage}
          onLeverageChange={onLeverageChange}
          risk={risk}
          onRiskChange={onStakeChange}
          maxStakePct={tracker.maxStakePct}
          disabled={tracker.stakePoolBlocked}
          balanceUsd={balance}
          stakeUsd={tracker.stakeUsd(balance)}
          stakePct={tracker.stakePct}
          lev={tracker.lev}
        />
      </SignalFormSection>

      <SignalFormSection title="Комментарий">
        <SignalMediaPicker
          screenshot={screenshot}
          video={video}
          shotPreview={shotPreview}
          onScreenshot={(file) => {
            setScreenshot(file);
            if (shotPreview) URL.revokeObjectURL(shotPreview);
            setShotPreview(file ? URL.createObjectURL(file) : null);
          }}
          onVideo={setVideo}
          label="Скрин или видео"
        />
        <SignalFormCommentSection
          value={comment}
          onChange={setComment}
          disabled={submitting}
          placeholder="Краткий разбор сделки…"
        />
      </SignalFormSection>

      <SignalFormSubmitFooter
        error={error}
        submitting={submitting}
        uploadProgress={uploadProgress}
        hasVideo={!!video}
        disabled={submitting || priceLoading || formBlocked}
        publishLabel="Опубликовать"
        saveLabel="Публикация…"
      />
    </SignalFormShell>
  );
}
