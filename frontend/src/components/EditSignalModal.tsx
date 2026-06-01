import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateSignalWithMedia, type Signal, type UploadProgress } from "../api";
import { useAdminTrackerSnapshot } from "../hooks/useAdminTrackerSnapshot";
import { preserveAccountStopOnLeverageChange, useDailyStopSync } from "../hooks/useDailyStopSync";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { formatTakeProfits, normalizeTakeProfits } from "../utils";
import { ruTextFieldProps } from "../utils/textFieldProps";
import { entryNominalUsd, formatRiskPercent, parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { formatRiskPct } from "../utils/signalLevels";
import { stakePoolBlockedMessage } from "../utils/stakePool";
import {
  initialUploadProgress,
  mediaBytesInForm,
  uploadProgressLabel,
} from "../utils/upload";
import { UploadProgressBar } from "./UploadProgressBar";
import { LeveragePicker } from "./LeveragePicker";
import { RiskPercentSlider } from "./RiskPercentSlider";
import { SignalLevelsFields } from "./SignalLevelsFields";
import { SignalMediaPicker } from "./SignalMediaPicker";
import { FieldLabelWithPaste, appendPastedText } from "./FieldLabelWithPaste";
import { SignalDailyResetTimer } from "./SignalDailyResetTimer";

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

  const { snapshot: trackerSnap, loading: trackerLoading } = useAdminTrackerSnapshot(
    signal != null,
    signal?.id,
  );

  const maxStakePct = trackerSnap?.maxStakePct ?? 100;
  const stakePoolBlocked = signal != null && !trackerLoading && maxStakePct <= 0;

  useEffect(() => {
    if (!signal || trackerLoading || trackerSnap == null) return;
    const cap = trackerSnap.maxStakePct;
    if (parseRiskPercent(risk) > cap) {
      setRisk(formatRiskPercent(Math.max(0, cap)));
    }
  }, [signal, trackerLoading, trackerSnap?.maxStakePct, risk]);

  const stakePct = parseRiskPercent(risk);
  const lev = parseLeverage(leverage);
  const { dailyRemaining, dailyLossPct, blocked: dailyStopBlocked } = useDailyStopSync({
    enabled: signal != null && !trackerLoading,
    riskPct,
    onRiskPctChange,
    dailyLossPct: trackerSnap?.dailyLossPct,
    stakePct,
    leverage: lev,
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
  }, [signal, loadLevels]);

  if (!signal) return null;

  const trackerBalance = trackerSnap?.balance ?? signal.tracker_balance ?? 0;
  const balanceForNominal =
    trackerBalance > 0
      ? trackerBalance
      : trackerSnap?.accountSize ?? signal.account_size ?? 0;
  const stakeUsd = entryNominalUsd(balanceForNominal, stakePct, lev);

  const onScreenshot = (file: File | null) => {
    setScreenshot(file);
    setRemoveScreenshot(false);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
  };

  const onVideo = (file: File | null) => {
    setVideo(file);
    setRemoveVideo(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("symbol", symbol);
      fd.append("direction", direction);
      if (entry) {
        fd.append("entry_low", entry);
        fd.append("entry_high", entry);
      }
      if (stop) fd.append("stop_loss", stop);
      const tp = normalizeTakeProfits(target);
      if (tp) fd.append("take_profits", tp);
      fd.append("comment", comment);
      fd.append("leverage", String(parseLeverage(leverage)));
      fd.append("risk_percent", String(parseRiskPercent(risk)));
      fd.append("remove_screenshot", removeScreenshot ? "true" : "false");
      fd.append("remove_video", removeVideo ? "true" : "false");
      if (screenshot) fd.append("screenshot", screenshot);
      if (video) fd.append("video", video);

      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      if (trackUpload) {
        setUploadProgress(initialUploadProgress(uploadBytes));
      } else {
        setUploadProgress(null);
      }

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
    <div className="modal-backdrop modal-backdrop--sheet modal-backdrop--signal" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <div>
            <h2>Редактировать</h2>
            <p>#{signal.number} · {signal.symbol} · активный сигнал</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="field-label">Инструмент</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required />

        <label className="field-label">Направление</label>
        <div className="dir-toggle">
          <button type="button" className={direction === "long" ? "active long" : ""} onClick={() => setDirection("long")}>
            LONG
          </button>
          <button type="button" className={direction === "short" ? "active short" : ""} onClick={() => setDirection("short")}>
            SHORT
          </button>
        </div>

        <SignalLevelsFields
          entry={entry}
          stop={stop}
          target={target}
          riskPct={riskPct}
          onEntryChange={onEntryChange}
          onStopChange={onStopChange}
          onTargetChange={onTargetChange}
          onRiskPctChange={onRiskPctChange}
          showPriceHint={false}
          stakePct={stakePct}
          leverage={lev}
          dailyRemainingPct={dailyRemaining}
          dailyLossPct={dailyLossPct}
          dailyStopBlocked={dailyStopBlocked}
        />

        <label className="field-label">Плечо</label>
        <LeveragePicker
          leverage={leverage}
          onLeverageChange={(nextLev, nextRisk) => {
            const prevStake = parseRiskPercent(risk);
            const prevLev = parseLeverage(leverage);
            setLeverage(nextLev);
            setRisk(nextRisk);
            const nextPrice = preserveAccountStopOnLeverageChange({
              riskPct,
              prevStakePct: prevStake,
              prevLeverage: prevLev,
              nextStakePct: parseRiskPercent(nextRisk),
              nextLeverage: parseLeverage(nextLev),
              dailyRemaining: dailyRemaining ?? 2,
            });
            if (nextPrice) onRiskPctChange(nextPrice);
          }}
        />

        <RiskPercentSlider value={risk} onChange={setRisk} max={maxStakePct} disabled={stakePoolBlocked} />

        <label className="field-label">Трекер $</label>
        <input
          value={
            trackerLoading
              ? "Загрузка…"
              : trackerBalance > 0
                ? String(Math.round(trackerBalance))
                : "—"
          }
          readOnly
          className="readonly"
        />
        {balanceForNominal > 0 && (
          <p className="meta signal-nominal">
            Номинал позиции:{" "}
            <span className="signal-nominal__usd">
              ${stakeUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>{" "}
            (<span className="signal-nominal__pct">{risk}%</span> × <span className="signal-nominal__lev">{lev}x</span>)
          </p>
        )}
        {balanceForNominal > 0 && (
          <p className="meta signal-nominal-hint">Номинал от текущего баланса трекера</p>
        )}
        {!trackerLoading && trackerSnap && (
          <p className="meta signal-stake-pool">
            Пул копирующих: занято <strong>{formatRiskPct(trackerSnap.stakePoolUsedPct)}%</strong> · доступно{" "}
            <strong>{formatRiskPct(trackerSnap.stakePoolRemainingPct)}%</strong>
            {" · "}
            ваш ранг <strong>{trackerSnap.currentRankName}</strong> — до{" "}
            <strong>{formatRiskPct(trackerSnap.rankMaxStakePct)}%</strong> входа
          </p>
        )}
        {stakePoolBlocked && (
          <p className="err signal-stake-pool-blocked">
            {stakePoolBlockedMessage(maxStakePct, trackerSnap?.stakePoolRemainingPct ?? 0)}
          </p>
        )}
        {signal != null && !trackerLoading && <SignalDailyResetTimer active />}

        <SignalMediaPicker
          screenshot={screenshot}
          video={video}
          shotPreview={shotPreview}
          onScreenshot={onScreenshot}
          onVideo={onVideo}
          existingImageUrl={signal.media_image_url}
          existingVideoUrl={signal.media_video_url}
          removeScreenshot={removeScreenshot}
          removeVideo={removeVideo}
          onRemoveScreenshot={setRemoveScreenshot}
          onRemoveVideo={setRemoveVideo}
        />

        <FieldLabelWithPaste
          label="Комментарий (на русском)"
          onPaste={(text) => setComment((prev) => appendPastedText(prev, text))}
          disabled={submitting}
        />
        <textarea {...ruTextFieldProps} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Краткий анализ по-русски…" />

        {error && <p className="err">{error}</p>}

        {submitting && uploadProgress && (
          <UploadProgressBar
            progress={uploadProgress}
            label={uploadProgressLabel(!!video, uploadProgress.phase)}
          />
        )}

        <button type="submit" className="submit-btn" disabled={submitting || dailyStopBlocked || stakePoolBlocked}>
          {submitting && uploadProgress
            ? uploadProgress.phase === "processing"
              ? "Сохранение…"
              : `Загрузка… ${uploadProgress.percent}%`
            : submitting
              ? "Сохранение…"
              : "Сохранить изменения"}
        </button>
      </form>
    </div>
  );
}
