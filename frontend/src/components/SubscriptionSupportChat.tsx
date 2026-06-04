import { useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  fetchSupportInfo,
  fetchSupportMessages,
  sendSupportMessage,
  type SupportInfo,
  type SupportMessage,
} from "../api";
import { SupportModal } from "./SupportModal";

const POLL_MS = 4000;

/** Плавающий лайв-чат только на вкладке «Подписка»; история хранится на сервере и в состоянии вкладки. */
export function SubscriptionSupportChat() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<SupportInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const afterIdRef = useRef(0);
  const historyLoadedRef = useRef(false);

  const chatEnabled = info?.live_chat_enabled ?? false;

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
    afterIdRef.current = Math.max(afterIdRef.current, ...incoming.map((m) => m.id));
  }, []);

  const loadInfo = useCallback(async () => {
    setInfoLoading(true);
    setInfoError(null);
    try {
      setInfo(await fetchSupportInfo());
    } catch (e) {
      setInfoError(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setInfoLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!chatEnabled) return;
    setChatLoading(true);
    try {
      const data = await fetchSupportMessages(0);
      setMessages(data);
      afterIdRef.current = data.length ? Math.max(...data.map((m) => m.id)) : 0;
      setSendErr(null);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "Не удалось загрузить чат");
    } finally {
      setChatLoading(false);
      historyLoadedRef.current = true;
    }
  }, [chatEnabled]);

  const pollNew = useCallback(async () => {
    if (!chatEnabled || afterIdRef.current < 0) return;
    try {
      const data = await fetchSupportMessages(afterIdRef.current);
      mergeMessages(data);
    } catch {
      /* тихо при опросе */
    }
  }, [chatEnabled, mergeMessages]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (!info || infoLoading) return;
    if (chatEnabled && !historyLoadedRef.current) {
      void loadHistory();
    }
  }, [info, infoLoading, chatEnabled, loadHistory]);

  useEffect(() => {
    if (!open || !chatEnabled) return;
    void pollNew();
    const id = window.setInterval(() => void pollNew(), POLL_MS);
    return () => clearInterval(id);
  }, [open, chatEnabled, pollNew]);

  const openChat = () => {
    WebApp.HapticFeedback.impactOccurred("light");
    setOpen(true);
    if (chatEnabled && historyLoadedRef.current) {
      void pollNew();
    }
  };

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
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "Не удалось отправить");
      WebApp.HapticFeedback.notificationOccurred("error");
    } finally {
      setSending(false);
    }
  };

  if (infoLoading) return null;
  if (!chatEnabled && !infoError) return null;

  return (
    <>
      <button
        type="button"
        className={`support-fab${open ? " support-fab--paused" : ""}`}
        onClick={openChat}
        aria-label="Лайв-чат поддержки"
      >
        <span className="support-fab__icon" aria-hidden>
          💬
        </span>
        <span className="support-fab__label">Чат</span>
      </button>

      {open && (
        <SupportModal
          info={info}
          infoError={infoError}
          messages={messages}
          chatLoading={chatLoading}
          draft={draft}
          onDraftChange={setDraft}
          sending={sending}
          sendErr={sendErr}
          onClose={() => setOpen(false)}
          onRetryInfo={() => void loadInfo()}
          onSubmit={submit}
        />
      )}
    </>
  );
}
