import { formatUploadSize, type UploadProgress } from "../utils/upload";

type Props = {
  progress: UploadProgress;
  label?: string;
};

export function UploadProgressBar({ progress, label }: Props) {
  const { loaded, total, percent, phase } = progress;
  const indeterminate = phase === "upload" && percent <= 0 && total > 0;
  const sizeHint =
    total > 0 ? `${formatUploadSize(loaded)} / ${formatUploadSize(total)}` : formatUploadSize(loaded);

  return (
    <div className="upload-progress" role="status" aria-live="polite">
      <div className="upload-progress__head">
        <span className="upload-progress__label">{label ?? "Загрузка…"}</span>
        <span className="upload-progress__pct">{phase === "processing" ? "…" : `${percent}%`}</span>
      </div>
      <div className={`upload-progress__track${indeterminate ? " upload-progress__track--busy" : ""}`} aria-hidden>
        <div
          className={`upload-progress__fill${phase === "processing" ? " upload-progress__fill--processing" : ""}`}
          style={{ width: phase === "processing" ? "100%" : `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <p className="upload-progress__meta">{sizeHint}</p>
    </div>
  );
}
