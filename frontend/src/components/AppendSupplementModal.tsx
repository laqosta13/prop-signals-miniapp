import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { appendSignalSupplement, type Signal, type UploadProgress } from "../api";
import { initialUploadProgress, mediaBytesInForm, uploadProgressLabel } from "../utils/upload";
import { ruTextFieldProps } from "../utils/textFieldProps";
import { SignalMediaPicker } from "./SignalMediaPicker";
import { FieldLabelWithPaste, appendPastedText } from "./FieldLabelWithPaste";
import { UploadProgressBar } from "./UploadProgressBar";

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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  if (!signal) return null;

  const onScreenshot = (file: File | null) => {
    setScreenshot(file);
    setError(null);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
  };

  const onVideo = (file: File | null) => {
    setVideo(file);
    setError(null);
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

      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      if (trackUpload) {
        setUploadProgress(initialUploadProgress(uploadBytes));
      } else {
        setUploadProgress(null);
      }

      await appendSignalSupplement(signal.id, fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      WebApp.HapticFeedback.notificationOccurred("success");
      onDone();
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
            <h2>Дополнить сделку</h2>
            <p>
              #{signal.number} · {signal.symbol} · {signal.direction.toUpperCase()}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <FieldLabelWithPaste
          label="Комментарий (на русском)"
          onPaste={(text) => setComment((prev) => appendPastedText(prev, text))}
          disabled={submitting}
        />
        <textarea {...ruTextFieldProps} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Обновление по сделке…" />

        <SignalMediaPicker
          screenshot={screenshot}
          video={video}
          shotPreview={shotPreview}
          onScreenshot={onScreenshot}
          onVideo={onVideo}
        />

        {error && <p className="err">{error}</p>}

        {submitting && uploadProgress && (
          <UploadProgressBar
            progress={uploadProgress}
            label={uploadProgressLabel(!!video, uploadProgress.phase, true)}
          />
        )}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting && uploadProgress
            ? uploadProgress.phase === "processing"
              ? "Сохранение…"
              : `Загрузка… ${uploadProgress.percent}%`
            : submitting
              ? "Отправка…"
              : "Опубликовать дополнение"}
        </button>
      </form>
    </div>
  );
}
