import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import type { SupportInfo, SupportMessage } from "../api";
import {
  SUPPORT_INPUT_PLACEHOLDER,
  SUPPORT_LEAD,
  SUPPORT_SEND_LABEL,
  SUPPORT_TITLE,
  SUPPORT_UNAVAILABLE,
} from "../data/support";
import { formatTime } from "../utils";
import { ruTextFieldProps } from "../utils/textFieldProps";

type Props = {
  info: SupportInfo | null;
  infoError: string | null;
  messages: SupportMessage[];
  chatLoading: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  sending: boolean;
  sendErr: string | null;
  onClose: () => void;
  onRetryInfo: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function SupportModal({
  info,
  infoError,
  messages,
  chatLoading,
  draft,
  onDraftChange,
  sending,
  sendErr,
  onClose,
  onRetryInfo,
  onSubmit,
}: Props) {
  const chatEnabled = info?.live_chat_enabled ?? false;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-title"
      onClick={onClose}
    >
      <div className="support-sheet support-sheet--chat" onClick={(e) => e.stopPropagation()}>
        <div className="support-sheet__head">
          <h2 id="support-title">{SUPPORT_TITLE}</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        {infoError && (
          <>
            <p className="err">{infoError}</p>
            <button type="button" className="ghost-btn" onClick={onRetryInfo}>
              Повторить
            </button>
          </>
        )}

        {!infoError && !chatEnabled && <p className="meta">{SUPPORT_UNAVAILABLE}</p>}

        {!infoError && chatEnabled && (
          <>
            <p className="support-sheet__lead">{SUPPORT_LEAD}</p>
            <div ref={listRef} className="support-chat__list" aria-live="polite">
              {chatLoading && messages.length === 0 && <p className="meta">Загрузка сообщений…</p>}
              {!chatLoading && messages.length === 0 && (
                <p className="meta support-chat__empty">Пока нет сообщений. Напишите первым.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`support-chat__bubble support-chat__bubble--${m.direction === "user" ? "user" : "staff"}`}
                >
                  <p className="support-chat__text">{m.text}</p>
                  <time className="support-chat__time">{formatTime(m.created_at)}</time>
                </div>
              ))}
            </div>
            {sendErr && <p className="err">{sendErr}</p>}
            <form className="support-chat__form" onSubmit={onSubmit}>
              <textarea
                {...ruTextFieldProps}
                rows={2}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={SUPPORT_INPUT_PLACEHOLDER}
                maxLength={2000}
                disabled={sending}
              />
              <button type="submit" className="submit-btn" disabled={sending || !draft.trim()}>
                {sending ? "…" : SUPPORT_SEND_LABEL}
              </button>
            </form>
          </>
        )}

        {!chatEnabled && !infoError && (
          <button type="button" className="ghost-btn" onClick={onClose}>
            Закрыть
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
