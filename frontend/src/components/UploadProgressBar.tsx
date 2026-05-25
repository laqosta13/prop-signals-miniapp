import { formatUploadSize } from "../utils/upload";

type Props = {
  percent: number;
  loaded: number;
  total: number;
  label?: string;
};

export function UploadProgressBar({ percent, loaded, total, label }: Props) {
  const sizeHint =
    total > 0 ? `${formatUploadSize(loaded)} / ${formatUploadSize(total)}` : formatUploadSize(loaded);

  return (
    <div className="upload-progress" role="status" aria-live="polite">
      <div className="upload-progress__head">
        <span className="upload-progress__label">{label ?? "Загрузка…"}</span>
        <span className="upload-progress__pct">{percent}%</span>
      </div>
      <div className="upload-progress__track" aria-hidden>
        <div className="upload-progress__fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <p className="upload-progress__meta">{sizeHint}</p>
    </div>
  );
}
