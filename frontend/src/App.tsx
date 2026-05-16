import { useCallback, useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  fetchLeaderboard,
  fetchMe,
  fetchSignals,
  setNotifications,
  type Signal,
  type Trader,
} from "./api";
import { FeedTab } from "./components/FeedTab";
import { LeaderboardTab } from "./components/LeaderboardTab";

type Tab = "feed" | "top";

export default function App() {
  const [tab, setTab] = useState<Tab>("feed");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingTop, setLoadingTop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = WebApp.initDataUnsafe.user;
  const isDevBypass = import.meta.env.DEV && !!import.meta.env.VITE_DEV_TELEGRAM_USER_ID;

  const loadFeed = useCallback(async () => {
    setError(null);
    setLoadingFeed(true);
    try {
      const [data, me] = await Promise.all([fetchSignals(), fetchMe()]);
      setSignals(data);
      setIsAdmin(me.is_admin);
      setNotifyEnabled(me.notify_enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  const loadTop = useCallback(async () => {
    setLoadingTop(true);
    try {
      const data = await fetchLeaderboard();
      setTraders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка рейтинга");
    } finally {
      setLoadingTop(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (tab === "top") void loadTop();
  }, [tab, loadTop]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (tab === "feed") void loadFeed();
    }, 45000);
    return () => window.clearInterval(id);
  }, [tab, loadFeed]);

  const headerSub = useMemo(() => {
    if (user?.username) return `@${user.username}`;
    if (user?.id) return `id: ${user.id}`;
    if (isDevBypass) return "режим разработки";
    return "откройте из Telegram Mini App";
  }, [user, isDevBypass]);

  const toggleNotify = async () => {
    try {
      const me = await setNotifications(!notifyEnabled);
      setNotifyEnabled(me.notify_enabled);
      WebApp.HapticFeedback.impactOccurred("light");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить уведомления");
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{tab === "feed" ? "Лента сигналов" : "ТОП трейдеров"}</h1>
        <p className="sub">{headerSub}</p>
        <label className="notify-toggle">
          <input type="checkbox" checked={notifyEnabled} onChange={() => void toggleNotify()} />
          Уведомления в Telegram
        </label>
        <p className="notify-hint">Напишите боту /start, чтобы сообщения доходили</p>
      </header>

      {error && tab === "feed" && <div className="err">{error}</div>}

      <main className="app-main">
        {tab === "feed" ? (
          <FeedTab signals={signals} isAdmin={isAdmin} loading={loadingFeed} onPublished={loadFeed} />
        ) : (
          <LeaderboardTab traders={traders} loading={loadingTop} />
        )}
      </main>

      <nav className="tab-bar">
        <button type="button" className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}>
          Лента
        </button>
        <button type="button" className={tab === "top" ? "active" : ""} onClick={() => setTab("top")}>
          ТОП
        </button>
      </nav>
    </div>
  );
}
