import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateSignalWithMedia, type Signal, type UploadProgress } from "../api";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { formatTakeProfits, normalizeTakeProfits } from "../utils";
import { entryNominalUsd, parseLeverage, parseRiskPercent } from "../utils/signalForm";
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

type Props = {
  signal: Signal | null;
  onClose: () => void;
  onUpdated: () => void;
  trackerBalance?: number | null;
};

export function EditSignalModal({ signal, onClose, onUpdated, trackerBalance }: Props) {
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

  const tracker = trackerBalance ?? signal.tracker_balance ?? 0;
  const lev = parseLeverage(leverage);
  const stakeUsd = entryNominalUsd(tracker, parseRiskPercent(risk), lev);

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
            <p>{signal.symbol} · активный сигнал</p>
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
        />

        <label className="field-label">Плечо</label>
        <LeveragePicker
          leverage={leverage}
          onLeverageChange={(nextLev, nextRisk) => {
            setLeverage(nextLev);
            setRisk(nextRisk);
          }}
        />

        <RiskPercentSlider value={risk} onChange={setRisk} />

        <label className="field-label">Трекер $</label>
        <input
          value={tracker > 0 ? String(Math.round(tracker)) : "—"}
          readOnly
          className="readonly"
        />
        {tracker > 0 && (
          <p className="meta signal-nominal">
            Номинал позиции:{" "}
            <span className="signal-nominal__usd">
              ${stakeUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>{" "}
            (<span className="signal-nominal__pct">{risk}%</span> × <span className="signal-nominal__lev">{lev}x</span>)
          </p>
        )}

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

        <label className="field-label">Комментарий (на русском)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Краткий анализ по-русски…" />

        {error && <p className="err">{error}</p>}

        {submitting && uploadProgress && (
          <UploadProgressBar
            progress={uploadProgress}
            label={uploadProgressLabel(!!video, uploadProgress.phase)}
          />
        )}

        <button type="submit" className="submit-btn" disabled={submitting}>
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
