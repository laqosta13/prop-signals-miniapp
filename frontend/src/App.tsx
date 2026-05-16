import { useCallback, useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  fetchChallengeDashboard,
  fetchLeaderboard,
  fetchMe,
  fetchSignals,
  setNotifications,
  updateChallenge,
  type ChallengeDashboard,
  type Signal,
  type Trader,
} from "./api";
import { FeedTab } from "./components/FeedTab";
import { LeaderboardTab } from "./components/LeaderboardTab";
import { NewSignalModal } from "./components/NewSignalModal";
import { TrackerTab } from "./components/TrackerTab";

type Tab = "feed" | "tracker" | "top";

export default function App() {
  const [tab, setTab] = useState<Tab>("feed");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [challenge, setChallenge] = useState<ChallengeDashboard | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sig, me, dash] = await Promise.all([fetchSignals(), fetchMe(), fetchChallengeDashboard()]);
      setSignals(sig);
      setIsAdmin(me.is_admin);
      setNotifyEnabled(me.notify_enabled);
      setChallenge(dash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTop = useCallback(async () => {
    try {
      setTraders(await fetchLeaderboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка рейтинга");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "top") void loadTop();
  }, [tab, loadTop]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 45000);
    return () => window.clearInterval(id);
  }, [load]);

  const toggleNotify = async () => {
    try {
      const me = await setNotifications(!notifyEnabled);
      setNotifyEnabled(me.notify_enabled);
    } catch {
      /* */
    }
  };

  const openSettings = async () => {
    const size = prompt("Размер счёта Hash Hedge ($)", String(challenge?.account_size ?? 10000));
    if (!size) return;
    const stage = prompt("Этап (1, 2 или 3)", String(challenge?.stage ?? 1));
    try {
      const dash = await updateChallenge({
        account_size: parseFloat(size),
        stage: parseInt(stage || "1", 10),
        reset_day: true,
      });
      setChallenge(dash);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const titles: Record<Tab, { title: string; sub: string }> = {
    feed: { title: "Сигналы", sub: "PROP-DESK · Hash Hedge" },
    tracker: { title: "Трекер", sub: "HASH HEDGE CHALLENGE" },
    top: { title: "ТОП трейдеров", sub: "Рейтинг по сигналам" },
  };

  const head = titles[tab];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{head.title}</h1>
          <p>{head.sub}</p>
        </div>
        <span className="status-dot" title="online" />
      </header>

      {tab === "feed" && (
        <label className="notify-row">
          <input type="checkbox" checked={notifyEnabled} onChange={() => void toggleNotify()} />
          Уведомления в Telegram
        </label>
      )}

      {error && <p className="err">{error}</p>}

      <main className="content">
        {tab === "feed" && (
          <FeedTab
            signals={signals}
            challenge={challenge}
            loading={loading}
            onOpenTracker={() => setTab("tracker")}
          />
        )}
        {tab === "tracker" && challenge && (
          <TrackerTab data={challenge} signals={signals} onSettings={() => void openSettings()} />
        )}
        {tab === "top" && <LeaderboardTab traders={traders} loading={loading && traders.length === 0} />}
      </main>

      {isAdmin && (
        <button type="button" className="fab" onClick={() => setShowNewSignal(true)} aria-label="Новый сигнал">
          +
        </button>
      )}

      <nav className="bottom-nav">
        <button type="button" className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>
          <span className="ico">📈</span>
          Лента
        </button>
        <button type="button" className={tab === "tracker" ? "on" : ""} onClick={() => setTab("tracker")}>
          <span className="ico">〰</span>
          Трекер
        </button>
        <button type="button" className={tab === "top" ? "on" : ""} onClick={() => setTab("top")}>
          <span className="ico">🏆</span>
          ТОП
        </button>
      </nav>

      <NewSignalModal open={showNewSignal} onClose={() => setShowNewSignal(false)} onCreated={load} />
    </div>
  );
}
