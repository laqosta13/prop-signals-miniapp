import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import WebApp from "@twa-dev/sdk";
import {
  fetchChallengeTrackers,
  fetchCultCandidates,
  fetchCultChannels,
  fetchFiredLeaderboard,
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
  type CultCandidate,
  type CultChannel,
  type Trader,
} from "./api";
import { FeedTab } from "./components/FeedTab";
import { ThemeToggle } from "./components/ThemeToggle";
import { mergeFeedSignals } from "./utils/mergeFeedSignals";
import { isSignalAwaitingEntry, isSignalInMarket } from "./utils/signalActions";
import { PRODUCT_TAGLINE, TAB_SUBTITLES } from "./data/appCopy";
import { hasAcceptedDisclaimer, markDisclaimerAccepted } from "./utils/disclaimerStorage";

const TrackerTab = lazy(() => import("./components/TrackerTab").then((m) => ({ default: m.TrackerTab })));
const LeaderboardTab = lazy(() => import("./components/LeaderboardTab").then((m) => ({ default: m.LeaderboardTab })));
const ReviewsTab = lazy(() => import("./components/ReviewsTab").then((m) => ({ default: m.ReviewsTab })));
const NewsTab = lazy(() => import("./components/NewsTab").then((m) => ({ default: m.NewsTab })));
const SubscriptionTab = lazy(() => import("./components/SubscriptionTab").then((m) => ({ default: m.SubscriptionTab })));
const AppendSupplementModal = lazy(() =>
  import("./components/AppendSupplementModal").then((m) => ({ default: m.AppendSupplementModal })),
);
const EditSignalModal = lazy(() => import("./components/EditSignalModal").then((m) => ({ default: m.EditSignalModal })));
import { NewSignalModal } from "./components/NewSignalModal";
import { NotifySettingsPanel } from "./components/NotifySettingsPanel";
import { DisclaimerModal } from "./components/DisclaimerModal";
const NewsModal = lazy(() => import("./components/NewsModal").then((m) => ({ default: m.NewsModal })));
const RankConfirmModal = lazy(() => import("./components/RankConfirmModal").then((m) => ({ default: m.RankConfirmModal })));
const TrackerSettingsModal = lazy(() =>
  import("./components/TrackerSettingsModal").then((m) => ({ default: m.TrackerSettingsModal })),
);

type Tab = "feed" | "tracker" | "top" | "reviews" | "news" | "pay";

const FEED_POLL_MS = 15_000;

const TITLES: Record<Tab, { title: string; sub: string }> = {
  feed: { title: "", sub: "" },
  tracker: { title: "Трекер", sub: TAB_SUBTITLES.tracker },
  top: { title: "ТОП", sub: TAB_SUBTITLES.top },
  reviews: { title: "Отзывы", sub: TAB_SUBTITLES.reviews },
  news: { title: "Новости", sub: TAB_SUBTITLES.news },
  pay: { title: "Подписка", sub: TAB_SUBTITLES.pay },
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
  const [firedTraders, setFiredTraders] = useState<Trader[]>([]);
  const [canPublishMainFeed, setCanPublishMainFeed] = useState(false);
  const [canPublishCandidate, setCanPublishCandidate] = useState(false);
  const [cultCandidates, setCultCandidates] = useState<CultCandidate[]>([]);
  const [cultChannels, setCultChannels] = useState<CultChannel[]>([]);
  const [trackers, setTrackers] = useState<ChallengeDashboard[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);
  const [subActive, setSubActive] = useState(false);
  const [canWriteReview, setCanWriteReview] = useState(false);
  const [reviewWriteBlockedReason, setReviewWriteBlockedReason] = useState<string | null>(null);
  const [daysUntilReview, setDaysUntilReview] = useState<number | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyNewsEnabled, setNotifyNewsEnabled] = useState(false);
  const [notifyPushActive, setNotifyPushActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [editSignal, setEditSignal] = useState<Signal | null>(null);
  const [supplementSignal, setSupplementSignal] = useState<Signal | null>(null);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editNews, setEditNews] = useState<NewsPost | null>(null);
  const [newsRefreshKey, setNewsRefreshKey] = useState(0);
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [payRefreshKey, setPayRefreshKey] = useState(0);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankPending, setRankPending] = useState<TraderRank | null>(null);
  const [disclaimerReady, setDisclaimerReady] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [feedDisclaimerOpen, setFeedDisclaimerOpen] = useState(false);
  const [trackerSettings, setTrackerSettings] = useState<ChallengeDashboard | null>(null);
  const [trackerSettingsOpen, setTrackerSettingsOpen] = useState(false);

  const fullAccessRef = useRef(false);
  const trackersFetchedRef = useRef(false);

  const patchSignal = useCallback(
    (id: number, patch: Partial<Signal>) =>
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    [],
  );

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

  /** Ручное обновление: полная замена ленты и перезагрузка графиков. */
  const refreshSignalsFull = useCallback(async () => {
    try {
      const sig = fullAccessRef.current ? await fetchSignals() : await fetchSignalsPreview();
      setSignals(sig);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить ленту");
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await fetchMe();
      setIsAdmin(me.is_admin);
      setIsSuperAdmin(me.is_super_admin);
      setCanPublishMainFeed(me.can_publish_main_feed);
      setCanPublishCandidate(me.can_publish_candidate);
      setMyId(me.telegram_user_id);
      setNotifyEnabled(me.notify_enabled);
      setNotifyNewsEnabled(me.notify_news_enabled);
      setNotifyPushActive(me.notify_push_active);
      const fullAccess = me.subscription_active || me.is_admin || me.can_publish_main_feed;
      fullAccessRef.current = fullAccess;
      setSubActive(me.subscription_active);
      setCanWriteReview(me.can_write_review);
      setReviewWriteBlockedReason(me.review_write_blocked_reason);
      setDaysUntilReview(me.days_until_review);
    } catch {
      /* ignore */
    }
  }, []);

  const reloadTrackersOnly = useCallback(async () => {
    if (trackersFetchedRef.current) await loadTrackers();
  }, [loadTrackers]);

  const loadBootstrap = useCallback(async () => {
    try {
      const me = await fetchMe();
      setIsAdmin(me.is_admin);
      setIsSuperAdmin(me.is_super_admin);
      setCanPublishMainFeed(me.can_publish_main_feed);
      setCanPublishCandidate(me.can_publish_candidate);
      setMyId(me.telegram_user_id);
      setNotifyEnabled(me.notify_enabled);
      setNotifyNewsEnabled(me.notify_news_enabled);
      setNotifyPushActive(me.notify_push_active);
      setError(null);
      const fullAccess = me.subscription_active || me.is_admin || me.can_publish_main_feed;
      fullAccessRef.current = fullAccess;
      setSubActive(me.subscription_active);
      setCanWriteReview(me.can_write_review);
      setReviewWriteBlockedReason(me.review_write_blocked_reason);
      setDaysUntilReview(me.days_until_review);
      if (me.can_publish_main_feed) {
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
      const [boardResult, firedResult, candidatesResult, channelsResult] = await Promise.allSettled([
        fetchLeaderboard(),
        fetchFiredLeaderboard(),
        fetchCultCandidates(),
        fetchCultChannels(),
      ]);
      if (boardResult.status === "fulfilled") {
        setTraders(boardResult.value);
      } else {
        setTraders([]);
        setError(
          boardResult.reason instanceof Error
            ? boardResult.reason.message
            : "Ошибка рейтинга",
        );
      }
      if (firedResult.status === "fulfilled") {
        setFiredTraders(firedResult.value);
      } else {
        setFiredTraders([]);
      }
      if (candidatesResult.status === "fulfilled") {
        setCultCandidates(candidatesResult.value);
      } else {
        setCultCandidates([]);
      }
      if (channelsResult.status === "fulfilled") {
        setCultChannels(channelsResult.value);
      } else {
        setCultChannels([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка рейтинга");
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (tab === "feed") {
        trackersFetchedRef.current = true;
        await Promise.all([refreshSignalsFull(), loadTrackers(), refreshMe()]);
        setFeedRefreshKey((k) => k + 1);
      } else if (tab === "tracker") {
        trackersFetchedRef.current = true;
        await Promise.all([loadTrackers(), refreshSignalsFull(), refreshMe()]);
        setFeedRefreshKey((k) => k + 1);
      } else if (tab === "top") {
        await Promise.all([loadTop(), refreshMe()]);
      } else if (tab === "news") {
        await refreshMe();
        setNewsRefreshKey((k) => k + 1);
      } else if (tab === "reviews") {
        await refreshMe();
        setReviewsRefreshKey((k) => k + 1);
      } else if (tab === "pay") {
        await refreshMe();
        setPayRefreshKey((k) => k + 1);
      }
      WebApp.HapticFeedback.impactOccurred("light");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, tab, refreshSignalsFull, loadTrackers, loadTop, refreshMe]);

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
    if (loading || tab !== "feed") return;
    const id = window.setInterval(() => void refreshSignalsOnly(), FEED_POLL_MS);
    return () => clearInterval(id);
  }, [loading, tab, refreshSignalsOnly]);

  const hasMyTracker =
    myId != null && trackers.some((t) => t.owner_telegram_id === myId);

  const openSettings = (tracker: ChallengeDashboard) => {
    setTrackerSettings(tracker);
    setTrackerSettingsOpen(true);
  };

  const openCreateTracker = () => {
    setTrackerSettings(null);
    setTrackerSettingsOpen(true);
  };

  const toggleSignalNotify = async () => {
    try {
      const me = await setNotifications({ notify_enabled: !notifyEnabled });
      setNotifyEnabled(me.notify_enabled);
      setNotifyPushActive(me.notify_push_active);
    } catch {
      /* */
    }
  };

  const toggleNewsNotify = async () => {
    try {
      const me = await setNotifications({ notify_news_enabled: !notifyNewsEnabled });
      setNotifyNewsEnabled(me.notify_news_enabled);
      setNotifyPushActive(me.notify_push_active);
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
  const inMarketSignalCount = useMemo(
    () => signals.filter(isSignalInMarket).length,
    [signals],
  );
  const awaitingEntrySignalCount = useMemo(
    () => signals.filter(isSignalAwaitingEntry).length,
    [signals],
  );
  const feedStatsLabel = [
    inMarketSignalCount > 0 ? `${inMarketSignalCount} в рынке` : null,
    awaitingEntrySignalCount > 0 ? `${awaitingEntrySignalCount} ожидание входа` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const splitFeedStats = inMarketSignalCount > 0 && awaitingEntrySignalCount > 0;
  const showDisclaimer = disclaimerReady && !disclaimerAccepted && !loading;

  const acceptDisclaimer = () => {
    if (myId == null) return;
    markDisclaimerAccepted(myId);
    setDisclaimerAccepted(true);
  };

  return (
    <div className={`app${loading ? " app--booting" : ""}`}>
      {loading && (
        <div className="app-boot" role="status" aria-live="polite">
          <p className="app-boot__title">Volnovoi Cult</p>
          <p className="app-boot__meta">Загрузка…</p>
        </div>
      )}
      <header className={`topbar${tab === "feed" ? " topbar--feed" : ""}`}>
        <div className="topbar__titles">
          {tab === "feed" ? (
            <p
              className="topbar__marketplace"
              aria-label={feedStatsLabel ? `${PRODUCT_TAGLINE}, ${feedStatsLabel}` : PRODUCT_TAGLINE}
            >
              <span className="topbar__marketplace-kicker">Marketplace</span>
              <span
                className={`topbar__marketplace-body${splitFeedStats ? "" : " topbar__marketplace-body--single"}`}
              >
                {splitFeedStats ? (
                  <>
                    <span className="topbar__marketplace-row">
                      <span className="topbar__marketplace-word">крипто-</span>
                      <span className="topbar__marketplace-live" aria-hidden>
                        <span className="topbar__marketplace-count">{inMarketSignalCount}</span>
                        <span className="topbar__marketplace-live-label">в рынке</span>
                      </span>
                    </span>
                    <span className="topbar__marketplace-row">
                      <span className="topbar__marketplace-word">сделок</span>
                      <span className="topbar__marketplace-live topbar__marketplace-live--awaiting" aria-hidden>
                        <span className="topbar__marketplace-count topbar__marketplace-count--awaiting">
                          {awaitingEntrySignalCount}
                        </span>
                        <span className="topbar__marketplace-live-label">ожидание входа</span>
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="topbar__marketplace-row">
                    <span className="topbar__marketplace-word">крипто-сделок</span>
                    {inMarketSignalCount > 0 && (
                      <span className="topbar__marketplace-live" aria-hidden>
                        <span className="topbar__marketplace-count">{inMarketSignalCount}</span>
                        <span className="topbar__marketplace-live-label">в рынке</span>
                      </span>
                    )}
                    {awaitingEntrySignalCount > 0 && (
                      <span className="topbar__marketplace-live topbar__marketplace-live--awaiting" aria-hidden>
                        <span className="topbar__marketplace-count topbar__marketplace-count--awaiting">
                          {awaitingEntrySignalCount}
                        </span>
                        <span className="topbar__marketplace-live-label">ожидание входа</span>
                      </span>
                    )}
                  </span>
                )}
              </span>
            </p>
          ) : (
            <>
              <h1>{head.title}</h1>
              {head.sub ? <p className="topbar__sub">{head.sub}</p> : null}
            </>
          )}
        </div>
        <div className="topbar__actions">
          {tab !== "feed" && tab !== "news" && <ThemeToggle />}
          {isSuperAdmin && tab === "news" && (
            <button type="button" className="fab-top" onClick={openNewNews} aria-label="Новая новость">
              +
            </button>
          )}
          {tab === "feed" && (
            <button
              type="button"
              className={`disclaimer-btn${feedDisclaimerOpen ? " disclaimer-btn--paused" : ""}`}
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
        <NotifySettingsPanel enabled={notifyEnabled} onToggle={() => void toggleSignalNotify()} />
      )}
      {tab === "news" && (
        <NotifySettingsPanel enabled={notifyNewsEnabled} onToggle={() => void toggleNewsNotify()} />
      )}

      {error && <p className="err">{error}</p>}

      <main className="content">
        {tab === "feed" && (
          <FeedTab
            signals={signals}
            trackers={trackers}
            loading={loading}
            isAdmin={isAdmin}
            canPublishMainFeed={canPublishMainFeed}
            myId={myId}
            subscriptionActive={subActive}
            refreshKey={feedRefreshKey}
            onChanged={reloadAfterSignalChange}
            onReloadTrackers={reloadTrackersOnly}
            onEdit={setEditSignal}
            onSupplement={setSupplementSignal}
            onPatch={patchSignal}
            onOpenPay={() => setTab("pay")}
            onOpenTracker={() => setTab("tracker")}
          />
        )}
        <Suspense fallback={<p className="meta">Загрузка…</p>}>
          {tab === "tracker" && (
            <TrackerTab
              trackers={trackers}
              signals={signals}
              myId={myId}
              canPublishMainFeed={canPublishMainFeed}
              onSettings={openSettings}
              onCreateTracker={openCreateTracker}
            />
          )}
          {tab === "top" && (
            <LeaderboardTab
              traders={traders}
              firedTraders={firedTraders}
              cultCandidates={cultCandidates}
              canPublishCandidate={canPublishCandidate}
              cultChannels={cultChannels}
              loading={
                loading &&
                !traders.length &&
                !firedTraders.length &&
                !cultCandidates.length &&
                !cultChannels.length
              }
              myId={myId}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              onCultChannelsChange={() => void loadTop()}
              onCultCandidatesChange={() => void loadTop()}
              onRosterChange={() => void loadTop()}
            />
          )}
          {tab === "reviews" && (
            <ReviewsTab
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              canWriteReview={canWriteReview}
              reviewWriteBlockedReason={reviewWriteBlockedReason}
              daysUntilReview={daysUntilReview}
              refreshKey={reviewsRefreshKey}
            />
          )}
          {tab === "news" && (
            <NewsTab isSuperAdmin={isSuperAdmin} onEdit={openEditNews} refreshKey={newsRefreshKey} />
          )}
          {tab === "pay" && (
            <SubscriptionTab onPaid={() => void loadBootstrap()} refreshKey={payRefreshKey} />
          )}
        </Suspense>
      </main>

      {canPublishMainFeed && hasMyTracker && tab === "feed" && (
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
      />

      <Suspense fallback={null}>
        <EditSignalModal
          signal={editSignal}
          onClose={() => setEditSignal(null)}
          onUpdated={reloadAfterSignalChange}
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
          open={trackerSettingsOpen}
          tracker={trackerSettings}
          createMode={trackerSettings === null}
          onClose={() => setTrackerSettingsOpen(false)}
          onSaved={() => {
            void loadTrackers();
          }}
        />
      </Suspense>

      {showDisclaimer && <DisclaimerModal onAccept={acceptDisclaimer} />}
      {feedDisclaimerOpen && !showDisclaimer && (
        <DisclaimerModal variant="info" onClose={() => setFeedDisclaimerOpen(false)} />
      )}
    </div>
  );
}
