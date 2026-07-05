import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateSignalWithMedia, type Signal, type UploadProgress } from "../api";
import { useGuardedSubmit } from "../hooks/useGuardedSubmit";
import { useSignalFormTracker } from "../hooks/useSignalFormTracker";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { useSignalMarketPriceInit } from "../hooks/useSignalMarketPriceInit";
import { formatTakeProfits } from "../utils";
import { parseLeverage } from "../utils/signalForm";
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
  signal: Signal | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function EditSignalModal({ signal, onClose, onUpdated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [risk, setRisk] = useState("10");
  const [comment, setComment] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [removeScreenshot, setRemoveScreenshot] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [symbolEdited, setSymbolEdited] = useState(false);
  const levelsInitRef = useRef<number | null>(null);
  const {
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
    loadLevels,
  } = useSignalLevelFields("long");
  const directionRef = useRef(direction);
  directionRef.current = direction;

  const { tryAcquire, release } = useGuardedSubmit();
  const tracker = useSignalFormTracker(
    signal != null,
    { risk, setRisk },
    { leverage, setLeverage },
    signal?.id,
  );

  const balance = tracker.balanceForNominal(signal?.account_size ?? 0);

  useSignalMarketPriceInit({
    open: signal != null,
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
    skipTrackerInit: true,
  });

  useEffect(() => {
    if (!signal) {
      release();
      return;
    }
    setSymbol(signal.symbol);
    setSymbolEdited(false);
    setLeverage(String(parseLeverage(String(signal.leverage ?? 1))));
    setRisk(String(signal.risk_percent ?? signal.points_percent ?? 10));
    setComment(signal.comment || "");
    loadLevels({
      entryVal: signal.entry_low || signal.entry_high || "",
      stopVal: signal.stop_loss || "",
      targetVal: formatTakeProfits(signal.take_profits),
      dir: signal.direction === "short" ? "short" : "long",
    });
    setScreenshot(null);
    setVideo(null);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(null);
    setRemoveScreenshot(false);
    setRemoveVideo(false);
    setError(null);
    levelsInitRef.current = null;
  }, [signal, loadLevels, release]);

  if (!signal) return null;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !tryAcquire()) return;

    setSubmitting(true);
    setError(null);
    let saved = false;
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
        removeScreenshot,
        removeVideo,
        alwaysSendComment: true,
      });
      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      setUploadProgress(trackUpload ? initialUploadProgress(uploadBytes) : null);
      await updateSignalWithMedia(signal.id, fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      saved = true;
      try {
        WebApp.HapticFeedback.notificationOccurred("success");
      } catch {
        /* haptic optional */
      }
      void onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      release();
      if (saved) onClose();
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <SignalFormShell
      title="Редактирование"
      subtitle={`#${signal.number} · ${signal.symbol}`}
      onClose={handleClose}
      onBackdropClick={handleClose}
      onSubmit={submit}
      busy={submitting}
    >
      <SignalFormLimitsBar
        active
        loading={tracker.trackerLoading}
        trackerConfigured={tracker.trackerConfigured}
        dailyRemaining={tracker.dailyRemaining}
        dailyStopReservedRankPct={tracker.dailyStopReservedRank}
        dailyTradesRemaining={tracker.dailyTradesRemainingCount}
        dailyTradesLimit={tracker.dailyTradesLimit}
        stakePoolUsedPct={tracker.trackerSnap?.stakePoolUsedPct}
        stakePoolRemainingPct={tracker.trackerSnap?.stakePoolRemainingPct}
        dailyBlocked={tracker.dailyLimit.blocked}
        dailyBlockReason={tracker.dailyLimit.reason}
        stakePoolBlocked={tracker.stakePoolBlocked}
        rankMaxStakePct={tracker.rankMaxStakePct}
        maxStakePct={tracker.maxStakePct}
      />

      <SignalFormSection title="Сделка">
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

      <SignalFormSection title="Уровни">
        <SignalLevelsFields
          entry={entry}
          direction={direction}
          stop={stop}
          target={target}
          riskPct={riskPct}
          priceLoading={priceLoading}
          onEntryChange={onEntryChange}
          rrRatio={rrRatio}
          onStopChange={onStopChange}
          onTargetChange={onTargetChange}
          onRiskPctChange={onRiskPctChange}
          onRrRatioChange={onRrRatioChange}
          stakePct={tracker.stakePct}
          leverage={tracker.lev}
          dailyRemainingPct={tracker.dailyRemainingRank}
          balanceUsd={balance}
          rankMaxStakePct={tracker.rankMaxStakePct}
          dailyStopBlocked={tracker.dailyStopBlocked}
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

      <SignalFormSection title="Комментарий">
        <SignalMediaPicker
          screenshot={screenshot}
          video={video}
          shotPreview={shotPreview}
          onScreenshot={(file) => {
            setScreenshot(file);
            setRemoveScreenshot(false);
            if (shotPreview) URL.revokeObjectURL(shotPreview);
            setShotPreview(file ? URL.createObjectURL(file) : null);
          }}
          onVideo={(file) => {
            setVideo(file);
            setRemoveVideo(false);
          }}
          existingImageUrl={signal.media_image_url}
          existingVideoUrl={signal.media_video_url}
          removeScreenshot={removeScreenshot}
          removeVideo={removeVideo}
          onRemoveScreenshot={setRemoveScreenshot}
          onRemoveVideo={setRemoveVideo}
        />
        <SignalFormCommentSection value={comment} onChange={setComment} disabled={submitting} />
      </SignalFormSection>

      <SignalFormSubmitFooter
        error={error}
        submitting={submitting}
        uploadProgress={uploadProgress}
        hasVideo={!!video}
        disabled={submitting || tracker.dailyStopBlocked || tracker.stakePoolBlocked}
        publishLabel="Сохранить"
      />
    </SignalFormShell>
  );
}
