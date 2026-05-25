import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateSignalWithMedia, type Signal, type UploadProgress } from "../api";
import { formatTakeProfits, normalizeTakeProfits } from "../utils";
import { formatUploadSize } from "../utils/upload";
import { UploadProgressBar } from "./UploadProgressBar";

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
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [risk, setRisk] = useState("10");
  const [comment, setComment] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [removeScreenshot, setRemoveScreenshot] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  useEffect(() => {
    if (!signal) return;
    setSymbol(signal.symbol);
    setDirection(signal.direction === "short" ? "short" : "long");
    setEntry(signal.entry_low || signal.entry_high || "");
    setStop(signal.stop_loss || "");
    setTarget(formatTakeProfits(signal.take_profits));
    setLeverage(String(signal.leverage ?? 1));
    setRisk(String(signal.risk_percent ?? signal.points_percent ?? 10));
    setComment(signal.comment || "");
    setScreenshot(null);
    setVideo(null);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(null);
    setRemoveScreenshot(false);
    setRemoveVideo(false);
    setError(null);
  }, [signal]);

  if (!signal) return null;

  const tracker = trackerBalance ?? signal.tracker_balance ?? 0;

  const onScreenshot = (file: File | null) => {
    setScreenshot(file);
    setRemoveScreenshot(false);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setUploadProgress(null);
    const hasMedia = !!(video || screenshot);
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
      fd.append("leverage", String(parseInt(leverage, 10) || 1));
      fd.append("risk_percent", String(parseFloat(risk) || 10));
      fd.append("remove_screenshot", removeScreenshot ? "true" : "false");
      fd.append("remove_video", removeVideo ? "true" : "false");
      if (screenshot) fd.append("screenshot", screenshot);
      if (video) fd.append("video", video);

      await updateSignalWithMedia(
        signal.id,
        fd,
        hasMedia ? (p) => setUploadProgress(p) : undefined,
      );
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

  const imageSrc = shotPreview || (removeScreenshot ? null : signal.media_image_url);

  return (
    <div className="modal-backdrop" onClick={onClose}>
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

        <div className="triple">
          <div>
            <label className="field-label">Вход</label>
            <input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="field-label">Стоп</label>
            <input value={stop} onChange={(e) => setStop(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="field-label">Цель</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="triple">
          <div>
            <label className="field-label">Плечо</label>
            <input value={leverage} onChange={(e) => setLeverage(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Сумма входа %</label>
            <input value={risk} onChange={(e) => setRisk(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Трекер $</label>
            <input
              value={tracker > 0 ? String(Math.round(tracker)) : "—"}
              readOnly
              className="readonly"
            />
          </div>
        </div>

        <label className="field-label">Скрин сетапа</label>
        {signal.media_image_url && !removeScreenshot && !screenshot && (
          <label className="check-row">
            <input type="checkbox" checked={removeScreenshot} onChange={(e) => setRemoveScreenshot(e.target.checked)} />
            Удалить текущий скрин
          </label>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => onScreenshot(e.target.files?.[0] ?? null)}
        />
        {imageSrc && <img src={imageSrc} alt="Превью" className="media-preview" />}

        <label className="field-label">Видео</label>
        {signal.media_video_url && !removeVideo && !video && (
          <label className="check-row">
            <input type="checkbox" checked={removeVideo} onChange={(e) => setRemoveVideo(e.target.checked)} />
            Удалить текущее видео
          </label>
        )}
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => {
            setVideo(e.target.files?.[0] ?? null);
            setRemoveVideo(false);
          }}
        />
        {video && (
          <p className="meta">
            Видео: {video.name} ({formatUploadSize(video.size)})
          </p>
        )}

        <label className="field-label">Комментарий (на русском)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Краткий анализ по-русски…" />

        {error && <p className="err">{error}</p>}

        {submitting && uploadProgress && uploadProgress.percent >= 0 && (
          <UploadProgressBar
            percent={uploadProgress.percent}
            loaded={uploadProgress.loaded}
            total={uploadProgress.total}
            label={video ? "Загрузка видео и сохранение" : "Загрузка файлов и сохранение"}
          />
        )}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting && uploadProgress && uploadProgress.percent >= 0
            ? `Загрузка… ${uploadProgress.percent}%`
            : submitting
              ? "Сохранение…"
              : "Сохранить изменения"}
        </button>
      </form>
    </div>
  );
}
