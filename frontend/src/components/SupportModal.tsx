import { createPortal } from "react-dom";
import type { SupportInfo } from "../api";
import {
  SUPPORT_HINT,
  SUPPORT_LEAD,
  SUPPORT_TITLE,
  SUPPORT_TOPICS,
  SUPPORT_UNAVAILABLE,
  SUPPORT_WRITE_LABEL,
} from "../data/support";
import { openSupportChat } from "../utils/openSupport";

type Props = {
  info: SupportInfo | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
};

export function SupportModal({ info, loading, error, onClose, onRetry }: Props) {
  const canWrite = info?.available && info.url;

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-title"
      onClick={onClose}
    >
      <div className="support-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="support-sheet__head">
          <h2 id="support-title">{SUPPORT_TITLE}</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="support-sheet__lead">{SUPPORT_LEAD}</p>
        <ul className="support-sheet__list">
          {SUPPORT_TOPICS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="meta support-sheet__hint">{SUPPORT_HINT}</p>
        {info?.username ? (
          <p className="support-sheet__contact">
            Telegram: <span>@{info.username}</span>
          </p>
        ) : null}
        {error && <p className="err">{error}</p>}
        {loading && <p className="meta">Загрузка…</p>}
        {!loading && !canWrite && !error && <p className="meta">{SUPPORT_UNAVAILABLE}</p>}
        <div className="support-sheet__actions">
          {canWrite && (
            <button type="button" className="submit-btn" onClick={() => openSupportChat(info.url)}>
              {SUPPORT_WRITE_LABEL}
            </button>
          )}
          {error && (
            <button type="button" className="ghost-btn" onClick={onRetry}>
              Повторить
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
