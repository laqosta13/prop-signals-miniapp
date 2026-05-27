import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  fetchChallengeTrackers,
  fetchLeaderboard,
  fetchMe,
  fetchRankPending,
  fetchSignals,
  fetchSignalsPreview,
  setNotifications,
  type TraderRank,
  updateChallenge,
  type ChallengeDashboard,
  type NewsPost,
  type Signal,
  type Trader,
} from "./api";
import { FeedTab } from "./components/FeedTab";
import { AppendSupplementModal } from "./components/AppendSupplementModal";
import { EditSignalModal } from "./components/EditSignalModal";
import { NewSignalModal } from "./components/NewSignalModal";
import { NewsModal } from "./components/NewsModal";
import { RankConfirmModal } from "./components/RankConfirmModal";

const TrackerTab = lazy(() =>
  import("./components/TrackerTab").then((m) => ({ default: m.TrackerTab })),
);
const LeaderboardTab = lazy(() =>
  import("./components/LeaderboardTab").then((m) => ({ default: m.LeaderboardTab })),
);
const ReviewsTab = lazy(() =>
  import("./components/ReviewsTab").then((m) => ({ default: m.ReviewsTab })),
);
const NewsTab = lazy(() => import("./components/NewsTab").then((m) => ({ default: m.NewsTab })));
const SubscriptionTab = lazy(() =>
  import("./components/SubscriptionTab").then((m) => ({ default: m.SubscriptionTab })),
);

type Tab = "feed" | "tracker" | "top" | "reviews" | "news" | "pay";

const FEED_POLL_MS = 60_000;

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

function TabFallback() {
  return <p className="meta">Загрузка…</p>;
}

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
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [editSignal, setEditSignal] = useState<Signal | null>(null);
  const [supplementSignal, setSupplementSignal] = useState<Signal | null>(null);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editNews, setEditNews] = useState<NewsPost | null>(null);
  const [newsRefreshKey, setNewsRefreshKey] = useState(0);
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [payRefreshKey, setPayRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankPending, setRankPending] = useState<TraderRank | null>(null);

  const fullAccessRef = useRef(false);
  const trackersFetchedRef = useRef(false);

  const patchSignal = (id: number, patch: Partial<Signal>) =>
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const loadTrackers = useCallback(async () => {
    try {
      setTrackers(await fetchChallengeTrackers());
    } catch {
      setTrackers([]);
    }
  }, []);

  const refreshSignalsOnly = useCallback(async () => {
    try {
      const sig = fullAccessRef.current ? await fetchSignals() : await fetchSignalsPreview();
      setSignals(sig);
    } catch {
      /* keep previous feed on poll errors */
    }
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const me = await fetchMe();
      setIsAdmin(me.is_admin);
      setMyId(me.telegram_user_id);
      setMemberSince(me.member_since);
      setNotifyEnabled(me.notify_enabled);
      setNotifyNewsEnabled(me.notify_news_enabled);
      setPaidSub(me.paid_subscription);
      setError(null);
      const fullAccess = me.subscription_active || me.is_admin;
      fullAccessRef.current = fullAccess;
      setSubActive(me.subscription_active);
      setCanWriteReview(me.can_write_review);
      setReviewWriteBlockedReason(me.review_write_blocked_reason);
      setDaysUntilReview(me.days_until_review);
      if (me.is_admin) {
        try {
          const pending = await fetchRankPending();
          setRankPending(pending.needs_confirm ? pending.rank : null);
        } catch {
          setRankPending(null);
        }
      } else {
        setRankPending(null);
      }
      const sig = fullAccess ? await fetchSignals() : await fetchSignalsPreview();
      setSignals(sig);
    } catch (e) {
      setSignals([]);
      setTrackers([]);
      setTraders([]);
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadAfterSignalChange = useCallback(async () => {
    await refreshSignalsOnly();
    if (trackersFetchedRef.current) await loadTrackers();
  }, [refreshSignalsOnly, loadTrackers]);

  const loadTop = useCallback(async () => {
    try {
      setTraders(await fetchLeaderboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка рейтинга");
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (tab === "feed") {
        await Promise.all([refreshSignalsOnly(), loadTrackers()]);
      } else if (tab === "tracker") {
        await Promise.all([loadTrackers(), refreshSignalsOnly()]);
      } else if (tab === "top") {
        await loadTop();
      } else if (tab === "news") {
        setNewsRefreshKey((k) => k + 1);
      } else if (tab === "reviews") {
        setReviewsRefreshKey((k) => k + 1);
      } else if (tab === "pay") {
        setPayRefreshKey((k) => k + 1);
      }
      WebApp.HapticFeedback.impactOccurred("light");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, tab, refreshSignalsOnly, loadTrackers, loadTop]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (tab !== "feed" && tab !== "tracker") return;
    if (trackersFetchedRef.current) return;
    trackersFetchedRef.current = true;
    void loadTrackers();
  }, [tab, loadTrackers]);

  useEffect(() => {
    if (tab === "top") void loadTop();
  }, [tab, loadTop]);

  useEffect(() => {
    if (tab !== "feed" || loading) return;
    const id = window.setInterval(() => void refreshSignalsOnly(), FEED_POLL_MS);
    return () => clearInterval(id);
  }, [tab, loading, refreshSignalsOnly]);

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
      await loadTrackers();
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
          <button
            type="button"
            className={`refresh-btn${refreshing ? " refresh-btn--spin" : ""}`}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="Обновить"
          >
            <span className="refresh-btn__icon" aria-hidden>
              ↻
            </span>
          </button>
        </div>
      </header>

      {tab === "feed" && (
        <label className="notify-row">
          <input type="checkbox" checked={notifyEnabled} onChange={() => void toggleSignalNotify()} />
          Уведомления о сигналах в Telegram
        </label>
      )}
      {tab === "news" && (
        <label className="notify-row">
          <input
            type="checkbox"
            checked={notifyNewsEnabled}
            onChange={() => void toggleNewsNotify()}
          />
          Уведомления о новостях в Telegram
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
            memberSince={memberSince}
            subscriptionActive={subActive}
            onChanged={reloadAfterSignalChange}
            onEdit={setEditSignal}
            onSupplement={setSupplementSignal}
            onPatch={patchSignal}
            onOpenPay={() => setTab("pay")}
            onOpenTracker={() => setTab("tracker")}
          />
        )}
        {tab === "tracker" && (
          <Suspense fallback={<TabFallback />}>
            <TrackerTab
              trackers={trackers}
              signals={signals}
              myId={myId}
              isAdmin={isAdmin}
              onSettings={openSettings}
            />
          </Suspense>
        )}
        {tab === "top" && (
          <Suspense fallback={<TabFallback />}>
            <LeaderboardTab traders={traders} loading={loading && !traders.length} myId={myId} />
          </Suspense>
        )}
        {tab === "reviews" && (
          <Suspense fallback={<TabFallback />}>
            <ReviewsTab
              isAdmin={isAdmin}
              canWriteReview={canWriteReview}
              reviewWriteBlockedReason={reviewWriteBlockedReason}
              daysUntilReview={daysUntilReview}
              refreshKey={reviewsRefreshKey}
            />
          </Suspense>
        )}
        {tab === "news" && (
          <Suspense fallback={<TabFallback />}>
            <NewsTab isAdmin={isAdmin} onEdit={openEditNews} refreshKey={newsRefreshKey} />
          </Suspense>
        )}
        {tab === "pay" && (
          <Suspense fallback={<TabFallback />}>
            <SubscriptionTab onPaid={() => void loadBootstrap()} refreshKey={payRefreshKey} />
          </Suspense>
        )}
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
        onCreated={reloadAfterSignalChange}
        trackerBalance={trackers.find((t) => t.owner_telegram_id === myId)?.balance ?? null}
      />
      <EditSignalModal
        signal={editSignal}
        onClose={() => setEditSignal(null)}
        onUpdated={reloadAfterSignalChange}
        trackerBalance={trackers.find((t) => t.owner_telegram_id === myId)?.balance ?? null}
      />
      <AppendSupplementModal
        signal={supplementSignal}
        onClose={() => setSupplementSignal(null)}
        onDone={reloadAfterSignalChange}
      />
      <NewsModal
        open={newsModalOpen}
        post={editNews}
        onClose={() => setNewsModalOpen(false)}
        onSaved={onNewsSaved}
      />

      {rankPending && (
        <RankConfirmModal
          rank={rankPending}
          onDone={() => {
            setRankPending(null);
            if (tab === "top") void loadTop();
          }}
        />
      )}
    </div>
  );
}
