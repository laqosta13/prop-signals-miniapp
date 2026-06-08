import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignalWithMedia } from "../api";
import type { UploadProgress } from "../api";
import { useGuardedSubmit } from "../hooks/useGuardedSubmit";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { useSignalFormTracker } from "../hooks/useSignalFormTracker";
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
  const [symbolEdited, setSymbolEdited] = useState(false);
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
  const wasOpenRef = useRef(false);

  const copy = useThemedCopy();
  const { tryAcquire, release } = useGuardedSubmit();
  const tracker = useSignalFormTracker(open, { risk, setRisk }, { leverage, setLeverage });

  const balance = tracker.balanceForNominal();

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
      setSymbol(DEFAULT_SYMBOL);
      setSymbolEdited(false);
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
        `Опубликовать ${symbol.trim().toUpperCase()} ${side} в ленту?\nВход ${risk}% · ${parseLeverage(leverage)}×`,
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
      });
      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      setUploadProgress(trackUpload ? initialUploadProgress(uploadBytes) : null);
      await createSignalWithMedia(fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      published = true;
      WebApp.HapticFeedback.notificationOccurred("success");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      if (!published) {
        release();
        setSubmitting(false);
        setUploadProgress(null);
      }
    }
  };

  return (
    <SignalFormShell
      title={copy.signalNew}
      subtitle={copy.signalToFeed}
      onClose={handleClose}
      onBackdropClick={handleClose}
      onSubmit={submit}
      busy={submitting}
    >
      <SignalFormLimitsBar
        active
        loading={tracker.trackerLoading}
        dailyRemaining={tracker.dailyRemaining}
        dailyStopReservedRankPct={tracker.dailyStopReservedRank}
        dailyTradesRemaining={tracker.dailyTradesRemainingCount}
        dailyTradesLimit={tracker.dailyTradesLimit}
        stakePoolUsedPct={tracker.trackerSnap?.stakePoolUsedPct}
        stakePoolRemainingPct={tracker.trackerSnap?.stakePoolRemainingPct}
        dailyBlocked={tracker.dailyLimit.blocked}
        dailyBlockReason={tracker.dailyLimit.reason}
        stakePoolBlocked={tracker.stakePoolBlocked}
        maxStakePct={tracker.maxStakePct}
      />

      <SignalFormSection title={copy.signalDeal}>
        <SignalFormDealSection
          symbol={symbol}
          suggestOnInput={symbolEdited}
          onSymbolChange={(value) => {
            setSymbolEdited(true);
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
          onEntryChange={onEntryChange}
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
          label={copy.signalMedia}
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
        publishLabel={copy.signalPublish}
        saveLabel={copy.signalPublishing}
      />
    </SignalFormShell>
  );
}
