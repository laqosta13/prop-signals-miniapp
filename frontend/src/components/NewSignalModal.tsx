import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignalWithMedia } from "../api";
import { normalizeTakeProfits } from "../utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  trackerBalance?: number | null;
};

export function NewSignalModal({ open, onClose, onCreated, trackerBalance }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
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

  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open, trackerBalance]);

  if (!open) return null;

  const tracker = trackerBalance ?? 0;
  const stakeUsd = tracker > 0 ? (tracker * (parseFloat(risk) || 0)) / 100 : 0;

  const onScreenshot = (file: File | null) => {
    setScreenshot(file);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
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
      if (comment) fd.append("comment", comment);
      fd.append("leverage", String(parseInt(leverage, 10) || 1));
      fd.append("risk_percent", String(parseFloat(risk) || 10));
      if (screenshot) fd.append("screenshot", screenshot);
      if (video) fd.append("video", video);

      await createSignalWithMedia(fd);
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
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <div>
            <h2>Новый сигнал</h2>
            <p>Публикация в ленту</p>
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
            <input value={tracker > 0 ? String(Math.round(tracker)) : "—"} readOnly className="readonly" />
          </div>
        </div>
        {tracker > 0 && (
          <p className="meta">
            Номинал позиции: ${stakeUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} ({risk}% от трекера)
          </p>
        )}

        <label className="field-label">Скрин сетапа</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => onScreenshot(e.target.files?.[0] ?? null)}
        />
        {shotPreview && <img src={shotPreview} alt="Превью" className="media-preview" />}

        <label className="field-label">Видео</label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
        />
        {video && <p className="meta">Видео: {video.name}</p>}

        <label className="field-label">Комментарий (на русском)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Краткий анализ по-русски…" />

        {error && <p className="err">{error}</p>}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Публикация…" : "Опубликовать сигнал"}
        </button>
      </form>
    </div>
  );
}
