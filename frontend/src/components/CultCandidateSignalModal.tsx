import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createCultCandidateSignal, updateCultCandidateSignal, type Signal, type UploadProgress } from "../api";
import { useCandidateSignalFormTracker } from "../hooks/useCandidateSignalFormTracker";
import { useGuardedSubmit } from "../hooks/useGuardedSubmit";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { useSignalMarketPriceInit } from "../hooks/useSignalMarketPriceInit";
import { buildSignalFormData } from "../utils/buildSignalFormData";
import { confirmAction } from "../utils/confirmAction";
import { parseLeverage } from "../utils/signalForm";
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
  editSignal?: Signal | null;
};

const DEFAULT_SYMBOL = "BTCUSDT";

export function CultCandidateSignalModal({ open, onClose, onCreated, editSignal }: Props) {
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
  const [symbolEdited, setSymbolEdited] = useState(false);
  const [entryEdited, setEntryEdited] = useState(false);
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
    loadLevels,
  } = useSignalLevelFields("long");
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const wasOpenRef = useRef(false);

  const copy = useThemedCopy();
  const { tryAcquire, release } = useGuardedSubmit();
  const tracker = useCandidateSignalFormTracker(open, { risk, setRisk }, { leverage, setLeverage }, editSignal?.id);
  const balance = tracker.balanceForNominal();

  const { resetInitKey } = useSignalMarketPriceInit({
    open,
    symbol,
    stakePctLabel: risk,
    leverage,
    riskPct,
    trackerSnap: tracker.trackerSnapshot,
    trackerLoading: tracker.trackerLoading,
    directionRef,
    applyMarketPrice,
    setRisk,
    setPriceLoading,
    setError,
  });

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open) {
      if (wasOpen) {
        release();
        setPriceLoading(false);
        setSubmitting(false);
        setUploadProgress(null);
      }
      return;
    }

    if (!wasOpen) {
      release();
      resetInitKey();
      setError(null);
      setPriceLoading(false);
      setSubmitting(false);
      setUploadProgress(null);
      setScreenshot(null);
      setVideo(null);
      setShotPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (editSignal) {
        setSymbol(editSignal.symbol);
        setSymbolEdited(true);
        setEntryEdited(true);
        setLeverage(String(editSignal.leverage ?? 1));
        setRisk(String(editSignal.risk_percent ?? 10));
        setComment(editSignal.comment ?? "");
        const dir = editSignal.direction.toLowerCase() === "short" ? "short" : "long";
        const firstTarget = (editSignal.take_profits ?? "").split(",")[0]?.trim() ?? "";
        loadLevels({
          entryVal: editSignal.entry_low ?? "",
          stopVal: editSignal.stop_loss ?? "",
          targetVal: firstTarget,
          dir,
        });
      } else {
        setSymbol(DEFAULT_SYMBOL);
        setSymbolEdited(false);
        setEntryEdited(false);
        setLeverage("1");
        setRisk("10");
        setComment("");
        resetForm();
      }
    }
  }, [open, resetForm, resetInitKey, release]);

  if (!open) return null;

  const formBlocked = tracker.dailyLimit.blocked || tracker.stakePoolBlocked;
  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formBlocked || submitting || !tryAcquire()) return;

    setSubmitting(true);
    setError(null);
    let published = false;
    try {
      const side = direction === "short" ? "SHORT" : "LONG";
      const ok = await confirmAction(
        `Открыть ${symbol.trim().toUpperCase()} ${side} в карточке?\nВход ${risk}% · ${parseLeverage(leverage)}×`,
      );
      if (!ok) return;

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
        marketEntry: !entryEdited,
        alwaysSendComment: !!editSignal,
      });
      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      setUploadProgress(trackUpload ? initialUploadProgress(uploadBytes) : null);
      if (editSignal) {
        await updateCultCandidateSignal(editSignal.id, fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      } else {
        await createCultCandidateSignal(fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      }
      published = true;
      try {
        WebApp.HapticFeedback.notificationOccurred("success");
      } catch {
        /* haptic optional */
      }
      void onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      release();
      if (published) onClose();
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <SignalFormShell
      title={editSignal ? "Изменить сделку" : copy.signalNew}
      subtitle={editSignal ? editSignal.symbol : copy.signalToCard}
      onClose={handleClose}
      onBackdropClick={handleClose}
      onSubmit={submit}
      busy={submitting}
    >
      <SignalFormLimitsBar
        active
        loading={tracker.trackerLoading}
        trackerConfigured={false}
        dailyRemaining={tracker.dailyRemaining}
        dailyStopReservedRankPct={tracker.dailyStopReservedRank}
        dailyTradesRemaining={tracker.dailyTradesRemainingCount}
        dailyTradesLimit={tracker.dailyTradesLimit}
        stakePoolBurnedPct={tracker.trackerSnap?.stake_pool_burned_pct}
        stakePoolUsedPct={tracker.trackerSnap?.stake_pool_used_pct}
        stakePoolRemainingPct={tracker.trackerSnap?.stake_pool_remaining_pct}
        dailyBlocked={tracker.dailyLimit.blocked}
        dailyBlockReason={tracker.dailyLimit.reason}
        stakePoolBlocked={tracker.stakePoolBlocked}
        rankEntryLocked={tracker.rankEntryBlocksNew}
        rankMaxStakePct={tracker.rankMaxStakePct}
        maxStakePct={tracker.maxStakePct}
      />

      <SignalFormSection title={copy.signalDeal}>
        <SignalFormDealSection
          symbol={symbol}
          suggestOnInput={symbolEdited}
          onSymbolChange={(value) => {
            setSymbolEdited(true);
            setEntryEdited(false);
            setSymbol(value);
          }}
          direction={direction}
          onDirectionChange={setDirection}
        />
      </SignalFormSection>

      <SignalFormSection title={copy.signalLevels}>
        <SignalLevelsFields
          entry={entry}
          direction={direction}
          stop={stop}
          target={target}
          riskPct={riskPct}
          priceLoading={priceLoading}
          onEntryChange={(value) => {
            setEntryEdited(true);
            onEntryChange(value);
          }}
          onStopChange={onStopChange}
          onTargetChange={onTargetChange}
          onRiskPctChange={onRiskPctChange}
          stakePct={tracker.stakePct}
          leverage={tracker.lev}
          dailyRemainingPct={tracker.dailyRemainingRank}
          balanceUsd={balance}
          rankMaxStakePct={tracker.rankMaxStakePct}
          dailyStopBlocked={tracker.dailyStopBlocked}
        />
      </SignalFormSection>

      <SignalFormSection title={copy.signalPosition}>
        <SignalFormPositionCard
          leverage={leverage}
          onLeverageChange={(lev) => {
            const prev = parseLeverage(leverage);
            const next = parseLeverage(lev);
            setLeverage(lev);
            resyncStopTargetForLeverage({
              prevLeverage: prev,
              newLeverage: next,
              stakePct: tracker.stakePct,
              dailyRemainingRankPct: tracker.dailyRemainingRank,
              balanceUsd: balance,
              rankMaxStakePct: tracker.rankMaxStakePct,
            });
          }}
          risk={risk}
          onRiskChange={setRisk}
          maxStakePct={tracker.maxStakePct}
          maxLeverage={tracker.rankMaxLeverage}
          disabled={tracker.stakePoolBlocked}
          balanceUsd={balance}
          stakeUsd={tracker.stakeUsd(balance)}
          stakePct={tracker.stakePct}
          lev={tracker.lev}
        />
      </SignalFormSection>

      <SignalFormSection title={copy.signalComment}>
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
          placeholder={copy.signalCommentPh}
        />
      </SignalFormSection>

      <SignalFormSubmitFooter
        error={error}
        submitting={submitting}
        uploadProgress={uploadProgress}
        hasVideo={!!video}
        disabled={submitting || priceLoading || formBlocked}
        publishLabel={editSignal ? "Сохранить" : copy.signalPublish}
        saveLabel={editSignal ? "Сохранение…" : copy.signalPublishing}
      />
    </SignalFormShell>
  );
}
