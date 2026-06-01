import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateSignalWithMedia, type Signal, type UploadProgress } from "../api";
import { useSignalFormTracker } from "../hooks/useSignalFormTracker";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { useSignalPositionControls } from "../hooks/useSignalPositionControls";
import { formatTakeProfits } from "../utils";
import { parseLeverage } from "../utils/signalForm";
import { buildSignalFormData } from "../utils/buildSignalFormData";
import { ACCOUNT_STOP_MIN_STEP, priceStopToAccountRiskPct } from "../utils/dailyStopLimit";
import { parseRiskPctValue } from "../utils/signalLevels";
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
  const [accountStopSel, setAccountStopSel] = useState<number | null>(null);
  const levelsInitRef = useRef<number | null>(null);

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
    loadLevels,
  } = useSignalLevelFields("long");

  const tracker = useSignalFormTracker(
    signal != null,
    { riskPct, onRiskPctChange },
    { risk, setRisk },
    leverage,
    setAccountStopSel,
    signal?.id,
  );

  const { onStakeChange, onLeverageChange } = useSignalPositionControls({
    risk,
    setRisk,
    leverage,
    setLeverage,
    stakePct: tracker.stakePct,
    lev: tracker.lev,
    riskPct,
    entry,
    dailyRemaining: tracker.dailyRemaining,
    accountStopSel,
    setAccountStopSel,
    onRiskPctChange,
  });

  useEffect(() => {
    if (!signal) return;
    setSymbol(signal.symbol);
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
    setAccountStopSel(null);
  }, [signal, loadLevels]);

  useEffect(() => {
    if (!signal || !entry || tracker.stakePct <= 0) return;
    if (levelsInitRef.current === signal.id) return;
    levelsInitRef.current = signal.id;
    const inferred = priceStopToAccountRiskPct(parseRiskPctValue(riskPct), tracker.stakePct, tracker.lev);
    if (inferred >= ACCOUNT_STOP_MIN_STEP) setAccountStopSel(inferred);
  }, [signal, entry, riskPct, tracker.stakePct, tracker.lev]);

  if (!signal) return null;

  const balance = tracker.balanceForNominal(signal.account_size ?? 0);

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
        removeScreenshot,
        removeVideo,
        alwaysSendComment: true,
      });
      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      setUploadProgress(trackUpload ? initialUploadProgress(uploadBytes) : null);
      await updateSignalWithMedia(signal.id, fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      WebApp.HapticFeedback.notificationOccurred("success");
      onUpdated();
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
      title="Редактирование"
      subtitle={`#${signal.number} · ${signal.symbol}`}
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
        stakePoolRemainingPct={tracker.trackerSnap?.stakePoolRemainingPct}
        rankName={tracker.trackerSnap?.currentRankName}
        rankMaxStakePct={tracker.trackerSnap?.rankMaxStakePct}
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

      <SignalFormSection title="Уровни" hint="Стоп — бегунок · цель 1:3">
        <SignalLevelsFields
          entry={entry}
          stop={stop}
          target={target}
          riskPct={riskPct}
          onEntryChange={onEntryChange}
          onStopChange={onStopChange}
          onTargetChange={onTargetChange}
          onRiskPctChange={onRiskPctChange}
          stakePct={tracker.stakePct}
          leverage={tracker.lev}
          dailyRemainingPct={tracker.dailyRemaining}
          dailyLossPct={tracker.dailyLossPct}
          dailyStopBlocked={tracker.dailyStopBlocked}
          accountStopPct={accountStopSel}
          onAccountStopChange={setAccountStopSel}
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

      <SignalFormSection title="Медиа">
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
      </SignalFormSection>

      <SignalFormSection title="Комментарий">
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
