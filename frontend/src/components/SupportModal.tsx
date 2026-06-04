import { useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createPortal } from "react-dom";
import { fetchSupportMessages, sendSupportMessage, type SupportInfo, type SupportMessage } from "../api";
import {
  SUPPORT_CHAT_HINT,
  SUPPORT_INPUT_PLACEHOLDER,
  SUPPORT_LEAD,
  SUPPORT_SEND_LABEL,
  SUPPORT_TITLE,
  SUPPORT_UNAVAILABLE,
} from "../data/support";
import { formatTime } from "../utils";
import { ruTextFieldProps } from "../utils/textFieldProps";

const POLL_MS = 4000;

type Props = {
  info: SupportInfo | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
};

export function SupportModal({ info, loading, error, onClose, onRetry }: Props) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const afterIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const chatEnabled = info?.live_chat_enabled ?? false;

  const scrollBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const mergeMessages = useCallback((incoming: SupportMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev];
      for (const m of incoming) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          next.push(m);
        }
      }
      next.sort((a, b) => a.id - b.id);
      return next;
    });
    const maxId = Math.max(afterIdRef.current, ...incoming.map((m) => m.id));
    afterIdRef.current = maxId;
  }, []);

  const loadMessages = useCallback(async (initial = false) => {
    if (!chatEnabled) {
      setChatLoading(false);
      return;
    }
    try {
      const data = await fetchSupportMessages(initial ? 0 : afterIdRef.current);
      mergeMessages(data);
      if (initial) setSendErr(null);
    } catch (e) {
      if (initial) setSendErr(e instanceof Error ? e.message : "Не удалось загрузить чат");
    } finally {
      if (initial) setChatLoading(false);
    }
  }, [chatEnabled, mergeMessages]);

  useEffect(() => {
    if (!chatEnabled) {
      setChatLoading(false);
      return;
    }
    afterIdRef.current = 0;
    setMessages([]);
    setChatLoading(true);
    void loadMessages(true);
  }, [chatEnabled, loadMessages]);

  useEffect(() => {
    if (!chatEnabled) return;
    const id = window.setInterval(() => void loadMessages(false), POLL_MS);
    return () => clearInterval(id);
  }, [chatEnabled, loadMessages]);

  useEffect(() => {
    scrollBottom();
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending || !chatEnabled) return;
    setSending(true);
    setSendErr(null);
    try {
      const row = await sendSupportMessage(body);
      mergeMessages([row]);
      setDraft("");
      WebApp.HapticFeedback.notificationOccurred("success");
      scrollBottom();
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "Не удалось отправить");
      WebApp.HapticFeedback.notificationOccurred("error");
    } finally {
      setSending(false);
    }
  };

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

        {loading && <p className="meta">Загрузка…</p>}
        {error && (
          <>
            <p className="err">{error}</p>
            <button type="button" className="ghost-btn" onClick={onRetry}>
              Повторить
            </button>
          </>
        )}

        {!loading && !error && !chatEnabled && <p className="meta">{SUPPORT_UNAVAILABLE}</p>}

        {!loading && !error && chatEnabled && (
          <>
            <p className="support-sheet__lead">{SUPPORT_LEAD}</p>
            <p className="meta support-sheet__hint">{SUPPORT_CHAT_HINT}</p>
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
            <form className="support-chat__form" onSubmit={submit}>
              <textarea
                {...ruTextFieldProps}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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

        {!chatEnabled && !loading && !error && (
          <button type="button" className="ghost-btn" onClick={onClose}>
            Закрыть
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
