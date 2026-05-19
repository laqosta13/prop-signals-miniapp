import { useCallback, useEffect, useState } from "react";
import {
  fetchChallengeTrackers,
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
import { AppendSupplementModal } from "./components/AppendSupplementModal";
import { EditSignalModal } from "./components/EditSignalModal";
import { NewSignalModal } from "./components/NewSignalModal";
import { SubscriptionTab } from "./components/SubscriptionTab";
import { TrackerTab } from "./components/TrackerTab";

type Tab = "feed" | "tracker" | "top" | "pay";

const TITLES: Record<Tab, { title: string; sub: string }> = {
  feed: { title: "Сигналы", sub: "PROP-DESK · Hash Hedge" },
  tracker: { title: "Трекер", sub: "Админы · Hash Hedge" },
  top: { title: "ТОП трейдеров", sub: "Рейтинг по сигналам" },
  pay: { title: "Подписка", sub: "USDT TON · рефералы" },
};

export default function App() {
  const [tab, setTab] = useState<Tab>("feed");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [trackers, setTrackers] = useState<ChallengeDashboard[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);
  const [subActive, setSubActive] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [editSignal, setEditSignal] = useState<Signal | null>(null);
  const [supplementSignal, setSupplementSignal] = useState<Signal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patchSignal = (id: number, patch: Partial<Signal>) =>
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const loadMeAndSignals = useCallback(async () => {
    try {
      const me = await fetchMe();
      setIsAdmin(me.is_admin);
      setMyId(me.telegram_user_id);
      setNotifyEnabled(me.notify_enabled);
      setSubActive(me.subscription_active);
      setError(null);
      if (me.subscription_active || me.is_admin) {
        setSignals(await fetchSignals());
      } else {
        setSignals([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrackers = useCallback(async () => {
    try {
      setTrackers(await fetchChallengeTrackers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка трекеров");
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
    void loadMeAndSignals();
    void loadTrackers();
  }, [loadMeAndSignals, loadTrackers]);

  useEffect(() => {
    if (tab === "feed" || tab === "tracker") void loadTrackers();
    if (tab === "top") void loadTop();
  }, [tab, loadTrackers, loadTop]);

  useEffect(() => {
    const id = window.setInterval(() => void loadMeAndSignals(), 45000);
    return () => clearInterval(id);
  }, [loadMeAndSignals]);

  const openSettings = async () => {
    const mine = trackers.find((t) => t.owner_telegram_id === myId);
    const size = prompt("Размер счёта ($)", String(mine?.account_size ?? 10000));
    if (!size) return;
    const stage = prompt("Этап (1–3)", String(mine?.stage ?? 1));
    try {
      await updateChallenge({
        account_size: parseFloat(size),
        stage: parseInt(stage || "1", 10),
        reset_day: true,
      });
      await Promise.all([loadTrackers(), loadMeAndSignals()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const toggleNotify = async () => {
    try {
      const me = await setNotifications(!notifyEnabled);
      setNotifyEnabled(me.notify_enabled);
    } catch {
      /* */
    }
  };

  const head = TITLES[tab];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{head.title}</h1>
          <p>{head.sub}</p>
        </div>
        <div className="topbar__actions">
          {isAdmin && tab === "feed" && (
            <button type="button" className="fab-top" onClick={() => setShowNewSignal(true)} aria-label="Новый сигнал">
              +
            </button>
          )}
          <span className="status-dot" title="online" />
        </div>
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
            trackers={trackers}
            loading={loading}
            isAdmin={isAdmin}
            subscriptionActive={subActive}
            onChanged={loadMeAndSignals}
            onEdit={setEditSignal}
            onSupplement={setSupplementSignal}
            onPatch={patchSignal}
            onOpenPay={() => setTab("pay")}
            onOpenTracker={() => setTab("tracker")}
          />
        )}
        {tab === "tracker" && (
          <TrackerTab trackers={trackers} signals={signals} myId={myId} isAdmin={isAdmin} onSettings={openSettings} />
        )}
        {tab === "top" && <LeaderboardTab traders={traders} loading={loading && !traders.length} />}
        {tab === "pay" && <SubscriptionTab onPaid={() => void loadMeAndSignals()} />}
      </main>

      <nav className="bottom-nav">
        {(["feed", "tracker", "top", "pay"] as const).map((t) => (
          <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            <span className="ico">{t === "feed" ? "📈" : t === "tracker" ? "〰" : t === "top" ? "🏆" : "💳"}</span>
            {t === "feed" ? "Лента" : t === "tracker" ? "Трекер" : t === "top" ? "ТОП" : "Подписка"}
          </button>
        ))}
      </nav>

      <NewSignalModal open={showNewSignal} onClose={() => setShowNewSignal(false)} onCreated={loadMeAndSignals} />
      <EditSignalModal signal={editSignal} onClose={() => setEditSignal(null)} onUpdated={loadMeAndSignals} />
      <AppendSupplementModal
        signal={supplementSignal}
        onClose={() => setSupplementSignal(null)}
        onDone={loadMeAndSignals}
      />
    </div>
  );
}
