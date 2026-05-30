import { useCallback, useEffect, useRef, useState } from "react";
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
  type ChallengeDashboard,
  type NewsPost,
  type Signal,
  type Trader,
} from "./api";
import { FeedTab } from "./components/FeedTab";
import { AppendSupplementModal } from "./components/AppendSupplementModal";
import { EditSignalModal } from "./components/EditSignalModal";
import { LeaderboardTab } from "./components/LeaderboardTab";
import { NewSignalModal } from "./components/NewSignalModal";
import { NewsModal } from "./components/NewsModal";
import { NewsTab } from "./components/NewsTab";
import { DisclaimerModal } from "./components/DisclaimerModal";
import { RankConfirmModal } from "./components/RankConfirmModal";
import { ReviewsTab } from "./components/ReviewsTab";
import { SubscriptionTab } from "./components/SubscriptionTab";
import { TrackerSettingsModal } from "./components/TrackerSettingsModal";
import { TrackerTab } from "./components/TrackerTab";
import { mergeFeedSignals } from "./utils/mergeFeedSignals";
import { hasAcceptedDisclaimer, markDisclaimerAccepted } from "./utils/disclaimerStorage";

type Tab = "feed" | "tracker" | "top" | "reviews" | "news" | "pay";

const FEED_POLL_MS = 15_000;

const TITLES: Record<Tab, { title: string; sub: string }> = {
  feed: { title: "Сигналы", sub: "PROP-DESK · Hash Hedge" },
  tracker: { title: "Трекер", sub: "Админы · Hash Hedge" },
  top: { title: "ТОП трейдеров", sub: "Рейтинг по сигналам" },
  reviews: { title: "Отзывы", sub: "Мнения подписчиков" },
  news: { title: "Новости", sub: "Обновления PROP-DESK" },
  pay: { title: "Подписка", sub: "USDT TON · рефералы" },
};

const NAV: { id: Tab; label: string }[] = [
  { id: "feed", label: "Лента" },
  { id: "tracker", label: "Трекер" },
  { id: "top", label: "ТОП" },
  { id: "reviews", label: "Отзывы" },
  { id: "news", label: "Новости" },
  { id: "pay", label: "Подписка" },
];

function NavIcon({ tab }: { tab: Tab }) {
  if (tab === "feed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 16 9 11l3.5 3.5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 12V7h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "tracker") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (tab === "top") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 20h10M8 16h8l1.5-8H6.5L8 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 8V5a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (tab === "reviews") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 6h14v9H9l-4 3V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "news") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 5h10v14H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
        <path d="M16 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8" stroke="currentColor" strokeWidth="2" />
        <path d="M8.5 9.5h5M8.5 12.5h5M8.5 15.5h3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="2" />
      <path d="M8 14h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
  const [disclaimerReady, setDisclaimerReady] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [feedDisclaimerOpen, setFeedDisclaimerOpen] = useState(false);
  const [trackerSettings, setTrackerSettings] = useState<ChallengeDashboard | null>(null);

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
      setSignals((prev) => mergeFeedSignals(prev, sig));
    } catch {
      /* keep previous feed on poll errors */
    }
  }, []);

  const reloadTrackersOnly = useCallback(async () => {
    if (trackersFetchedRef.current) await loadTrackers();
  }, [loadTrackers]);

  const loadBootstrap = useCallback(async () => {
    try {
      const me = await fetchMe();
      setIsAdmin(me.is_admin);
      setMyId(me.telegram_user_id);
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
    if (myId == null) {
      setDisclaimerReady(false);
      return;
    }
    setDisclaimerAccepted(hasAcceptedDisclaimer(myId));
    setDisclaimerReady(true);
  }, [myId]);

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
    if (loading) return;
    const id = window.setInterval(() => void refreshSignalsOnly(), FEED_POLL_MS);
    return () => clearInterval(id);
  }, [loading, refreshSignalsOnly]);

  const openSettings = (tracker: ChallengeDashboard) => {
    setTrackerSettings(tracker);
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
  const showDisclaimer = disclaimerReady && !disclaimerAccepted;

  const acceptDisclaimer = () => {
    if (myId == null) return;
    markDisclaimerAccepted(myId);
    setDisclaimerAccepted(true);
  };

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
          {tab === "feed" && (
            <button
              type="button"
              className="disclaimer-btn"
              onClick={() => setFeedDisclaimerOpen(true)}
              aria-label="Дисклеймер"
            >
              <span className="disclaimer-btn__icon" aria-hidden>
                !
              </span>
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
            subscriptionActive={subActive}
            onChanged={reloadAfterSignalChange}
            onReloadTrackers={reloadTrackersOnly}
            onEdit={setEditSignal}
            onSupplement={setSupplementSignal}
            onPatch={patchSignal}
            onOpenPay={() => setTab("pay")}
            onOpenTracker={() => setTab("tracker")}
          />
        )}
        {tab === "tracker" && (
          <TrackerTab
            trackers={trackers}
            signals={signals}
            myId={myId}
            isAdmin={isAdmin}
            onSettings={openSettings}
          />
        )}
        {tab === "top" && (
          <LeaderboardTab traders={traders} loading={loading && !traders.length} myId={myId} />
        )}
        {tab === "reviews" && (
          <ReviewsTab
            isAdmin={isAdmin}
            canWriteReview={canWriteReview}
            reviewWriteBlockedReason={reviewWriteBlockedReason}
            daysUntilReview={daysUntilReview}
            refreshKey={reviewsRefreshKey}
          />
        )}
        {tab === "news" && (
          <NewsTab isAdmin={isAdmin} onEdit={openEditNews} refreshKey={newsRefreshKey} />
        )}
        {tab === "pay" && (
          <SubscriptionTab onPaid={() => void loadBootstrap()} refreshKey={payRefreshKey} />
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
        {NAV.map(({ id, label }) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <span className="ico">
              <NavIcon tab={id} />
            </span>
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

      {showDisclaimer && <DisclaimerModal onAccept={acceptDisclaimer} />}
      {feedDisclaimerOpen && !showDisclaimer && (
        <DisclaimerModal variant="info" onClose={() => setFeedDisclaimerOpen(false)} />
      )}

      {!showDisclaimer && rankPending && (
        <RankConfirmModal
          rank={rankPending}
          onDone={() => {
            setRankPending(null);
            if (tab === "top") void loadTop();
          }}
        />
      )}

      <TrackerSettingsModal
        tracker={trackerSettings}
        onClose={() => setTrackerSettings(null)}
        onSaved={() => void loadTrackers()}
      />
    </div>
  );
}
