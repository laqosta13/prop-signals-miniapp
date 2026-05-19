import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { appendSignalSupplement, type Signal } from "../api";

type Props = {
  signal: Signal | null;
  onClose: () => void;
  onDone: () => void;
};

export function AppendSupplementModal({ signal, onClose, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);

  if (!signal) return null;

  const onScreenshot = (file: File | null) => {
    setScreenshot(file);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && !screenshot && !video) {
      setError("Добавьте комментарий, скрин или видео");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      if (comment.trim()) fd.append("comment", comment.trim());
      if (screenshot) fd.append("screenshot", screenshot);
      if (video) fd.append("video", video);
      await appendSignalSupplement(signal.id, fd);
      WebApp.HapticFeedback.notificationOccurred("success");
      onDone();
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
            <h2>Дополнить сигнал</h2>
            <p>
              {signal.symbol} · {signal.direction.toUpperCase()}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="field-label">Комментарий (на русском)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Обновление по сделке…" />

        <label className="field-label">Скрин</label>
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

        {error && <p className="err">{error}</p>}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Отправка…" : "Опубликовать дополнение"}
        </button>
      </form>
    </div>
  );
}
