import { useCallback, useEffect, useState } from "react";
import {
  fetchChallengeTrackers,
  fetchLeaderboard,
  fetchMe,
  fetchSignals,
  fetchSignalsPreview,
  setNotifications,
  updateChallenge,
  type ChallengeDashboard,
  type NewsPost,
  type Signal,
  type Trader,
} from "./api";
import { FeedTab } from "./components/FeedTab";
import { LeaderboardTab } from "./components/LeaderboardTab";
import { AppendSupplementModal } from "./components/AppendSupplementModal";
import { EditSignalModal } from "./components/EditSignalModal";
import { NewSignalModal } from "./components/NewSignalModal";
import { NewsModal } from "./components/NewsModal";
import { NewsTab } from "./components/NewsTab";
import { ReviewsTab } from "./components/ReviewsTab";
import { SubscriptionTab } from "./components/SubscriptionTab";
import { TrackerTab } from "./components/TrackerTab";

type Tab = "feed" | "tracker" | "top" | "reviews" | "news" | "pay";

const TITLES: Record<Tab, { title: string; sub: string }> = {
  feed: { title: "Сигналы", sub: "PROP-DESK · Hash Hedge" },
  tracker: { title: "Трекер", sub: "Админы · Hash Hedge" },
  top: { title: "ТОП трейдеров", sub: "Рейтинг по сигналам" },
  reviews: { title: "Отзывы", sub: "Мнения подписчиков" },
  news: { title: "Новости", sub: "Обновления PROP-DESK" },
  pay: { title: "Подписка", sub: "USDT TON · рефералы" },
};

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "feed", label: "Лента", icon: "📈" },
  { id: "tracker", label: "Трекер", icon: "〰" },
  { id: "top", label: "ТОП", icon: "🏆" },
  { id: "reviews", label: "Отзывы", icon: "💬" },
  { id: "news", label: "Новости", icon: "📰" },
  { id: "pay", label: "Подписка", icon: "💳" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("feed");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [trackers, setTrackers] = useState<ChallengeDashboard[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);
  const [subActive, setSubActive] = useState(false);
  const [canWriteReview, setCanWriteReview] = useState(false);
  const [reviewWriteBlockedReason, setReviewWriteBlockedReason] = useState<string | null>(null);
  const [daysUntilReview, setDaysUntilReview] = useState<number | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyNewsEnabled, setNotifyNewsEnabled] = useState(false);
  const [paidSub, setPaidSub] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [editSignal, setEditSignal] = useState<Signal | null>(null);
  const [supplementSignal, setSupplementSignal] = useState<Signal | null>(null);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editNews, setEditNews] = useState<NewsPost | null>(null);
  const [newsRefreshKey, setNewsRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const patchSignal = (id: number, patch: Partial<Signal>) =>
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const loadMeAndSignals = useCallback(async () => {
    try {
      const me = await fetchMe();
      setIsAdmin(me.is_admin);
      setMyId(me.telegram_user_id);
      setNotifyEnabled(me.notify_enabled);
      setNotifyNewsEnabled(me.notify_news_enabled);
      setPaidSub(me.paid_subscription);
      setError(null);
      const fullAccess = me.subscription_active || me.is_admin;
      setSubActive(me.subscription_active);
      setCanWriteReview(me.can_write_review);
      setReviewWriteBlockedReason(me.review_write_blocked_reason);
      setDaysUntilReview(me.days_until_review);
      const [sig, trk] = await Promise.all([
        fullAccess ? fetchSignals() : fetchSignalsPreview(),
        fetchChallengeTrackers(),
      ]);
      setSignals(sig);
      setTrackers(trk);
    } catch (e) {
      setSignals([]);
      setTrackers([]);
      setTraders([]);
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
    void loadMeAndSignals();
  }, [loadMeAndSignals]);

  useEffect(() => {
    if (tab === "top") void loadTop();
  }, [tab, loadTop]);

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
      await Promise.all([loadMeAndSignals()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const toggleSignalNotify = async () => {
    try {
      const me = await setNotifications({ notify_enabled: !notifyEnabled });
      setNotifyEnabled(me.notify_enabled);
    } catch {
      /* */
    }
  };

  const toggleNewsNotify = async () => {
    if (!paidSub) {
      alert("Уведомления о новостях доступны только с платной подпиской.");
      return;
    }
    try {
      const me = await setNotifications({ notify_news_enabled: !notifyNewsEnabled });
      setNotifyNewsEnabled(me.notify_news_enabled);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  };

  const openNewNews = () => {
    setEditNews(null);
    setNewsModalOpen(true);
  };

  const openEditNews = (post: NewsPost) => {
    setEditNews(post);
    setNewsModalOpen(true);
  };

  const onNewsSaved = () => setNewsRefreshKey((k) => k + 1);

  const head = TITLES[tab];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{head.title}</h1>
          <p>{head.sub}</p>
        </div>
        <div className="topbar__actions">
          {isAdmin && tab === "news" && (
            <button type="button" className="fab-top" onClick={openNewNews} aria-label="Новая новость">
              +
            </button>
          )}
          <span className="status-dot" title="online" />
        </div>
      </header>

      {tab === "feed" && (
        <label className="notify-row">
          <input type="checkbox" checked={notifyEnabled} onChange={() => void toggleSignalNotify()} />
          Уведомления о сигналах в Telegram
        </label>
      )}
      {tab === "news" && (
        <label className={`notify-row${!paidSub ? " notify-row--disabled" : ""}`}>
          <input
            type="checkbox"
            checked={notifyNewsEnabled}
            disabled={!paidSub}
            onChange={() => void toggleNewsNotify()}
          />
          Уведомления о новостях {paidSub ? "" : "(только платная подписка)"}
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
            myId={myId}
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
        {tab === "reviews" && (
          <ReviewsTab
            isAdmin={isAdmin}
            canWriteReview={canWriteReview}
            reviewWriteBlockedReason={reviewWriteBlockedReason}
            daysUntilReview={daysUntilReview}
          />
        )}
        {tab === "news" && (
          <NewsTab isAdmin={isAdmin} onEdit={openEditNews} refreshKey={newsRefreshKey} />
        )}
        {tab === "pay" && <SubscriptionTab onPaid={() => void loadMeAndSignals()} />}
      </main>

      {isAdmin && tab === "feed" && (
        <button
          type="button"
          className="fab-bottom"
          onClick={() => setShowNewSignal(true)}
          aria-label="Новый сигнал"
        >
          +
        </button>
      )}

      <nav className="bottom-nav">
        {NAV.map(({ id, label, icon }) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <span className="ico">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <NewSignalModal
        open={showNewSignal}
        onClose={() => setShowNewSignal(false)}
        onCreated={loadMeAndSignals}
        trackerBalance={trackers.find((t) => t.owner_telegram_id === myId)?.balance ?? null}
      />
      <EditSignalModal
        signal={editSignal}
        onClose={() => setEditSignal(null)}
        onUpdated={loadMeAndSignals}
        trackerBalance={trackers.find((t) => t.owner_telegram_id === myId)?.balance ?? null}
      />
      <AppendSupplementModal
        signal={supplementSignal}
        onClose={() => setSupplementSignal(null)}
        onDone={loadMeAndSignals}
      />
      <NewsModal
        open={newsModalOpen}
        post={editNews}
        onClose={() => setNewsModalOpen(false)}
        onSaved={onNewsSaved}
      />
    </div>
  );
}
