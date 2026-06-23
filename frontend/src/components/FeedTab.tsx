import { useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { closeSignalAtMarket, deleteSignal, type ChallengeDashboard, type Signal } from "../api";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { canViewActiveSignals, visibleFeedSignals } from "../utils/signalActions";
import { splitFeedSignals } from "../utils/sortFeedSignals";
import { PropTrackerMini } from "./PropTrackerMini";
import { SignalCard } from "./SignalCard";
import { DeleteSignalModal } from "./DeleteSignalModal";

const CLOSED_FEED_BATCH = 3;

type Props = {
  signals: Signal[];
  trackers: ChallengeDashboard[];
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  canPublishMainFeed: boolean;
  myId: number | null;
  subscriptionActive: boolean;
  onChanged: () => void;
  onReloadTrackers?: () => void | Promise<void>;
  onEdit: (signal: Signal) => void;
  onSupplement: (signal: Signal) => void;
  onPatch: (id: number, patch: Partial<Signal>) => void;
  onOpenPay: () => void;
  onOpenTracker: () => void;
  refreshKey?: number;
  testModeActive?: boolean;
  testModeUntil?: string | null;
  testModeDaysLeft?: number;
};

export function FeedTab({
  signals,
  trackers,
  loading,
  isAdmin,
  isSuperAdmin = false,
  canPublishMainFeed,
  myId,
  subscriptionActive,
  onChanged,
  onReloadTrackers,
  onEdit,
  onSupplement,
  onPatch,
  onOpenPay,
  onOpenTracker,
  refreshKey = 0,
  testModeActive = false,
  testModeUntil = null,
  testModeDaysLeft = 0,
}: Props) {
  const copy = useThemedCopy();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Signal | null>(null);
  const [closedVisibleCount, setClosedVisibleCount] = useState(CLOSED_FEED_BATCH);
  const feedTrader = isAdmin || canPublishMainFeed;
  const hasActiveAccess = canViewActiveSignals(subscriptionActive, feedTrader);
  const visible = visibleFeedSignals(signals, subscriptionActive, feedTrader);
  const { active: activeSignals, closed: closedSignals } = useMemo(
    () => splitFeedSignals(visible),
    [visible],
  );

  useEffect(() => {
    setClosedVisibleCount((prev) => {
      if (closedSignals.length === 0) return CLOSED_FEED_BATCH;
      return Math.min(prev, closedSignals.length);
    });
  }, [closedSignals.length]);

  const visibleClosedSignals = useMemo(
    () => closedSignals.slice(0, closedVisibleCount),
    [closedSignals, closedVisibleCount],
  );
  const closedHiddenCount = Math.max(0, closedSignals.length - closedVisibleCount);
  const nextClosedBatch = Math.min(CLOSED_FEED_BATCH, closedHiddenCount);

  const handleDelete = (id: number) => {
    const signal = signals.find((s) => s.id === id) ?? null;
    if (isSuperAdmin) {
      setDeleteTarget(signal);
    } else {
      void confirmAndDelete(id);
    }
  };

  const confirmAndDelete = async (id: number, reason?: string) => {
    if (!reason && !confirm("Удалить эту сделку?")) return;
    setDeletingId(id);
    try {
      await deleteSignal(id, reason);
      WebApp.HapticFeedback.notificationOccurred("success");
      setDeleteTarget(null);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseAtMarket = async (id: number) => {
    if (!confirm("Закрыть сделку по текущей рыночной цене?")) return;
    setClosingId(id);
    try {
      const updated = await closeSignalAtMarket(id);
      onPatch(id, updated);
      WebApp.HapticFeedback.notificationOccurred("success");
      void onReloadTrackers?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось закрыть");
      void onChanged();
    } finally {
      setClosingId(null);
    }
  };

  const renderCards = (list: Signal[]) =>
    list.map((s) => (
      <SignalCard
        key={`${s.id}-${s.status}-${s.closed_at ?? "open"}-${refreshKey}`}
        signal={s}
        liveTrackerBalance={trackers.find((t) => t.owner_telegram_id === s.author_telegram_id)?.balance}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        myId={myId}
        canEngage={true}
        deleting={deletingId === s.id}
        closing={closingId === s.id}
        onEdit={onEdit}
        onSupplement={onSupplement}
        onCloseAtMarket={handleCloseAtMarket}
        onDelete={handleDelete}
        onPatch={onPatch}
      />
    ));

  const showActiveBlock = hasActiveAccess;
  const showClosedBlock = closedSignals.length > 0;

  return (
    <>
      {testModeActive && (
        <div className="trial-banner">
          <span className="trial-banner__days">{testModeDaysLeft} дн.</span>
          <span className="trial-banner__label">{copy.formatTestModeBanner(testModeUntil, testModeDaysLeft)}</span>
        </div>
      )}
      {!hasActiveAccess && (
        <div className="sub-banner">
          <p>{copy.feedSubBanner}</p>
          <button type="button" className="ghost-btn" onClick={onOpenPay}>
            {copy.feedSubBannerBtn}
          </button>
        </div>
      )}
      {loading && <p className="meta">{copy.loading}</p>}
      {!loading && visible.length === 0 && (
        <p className="meta">{hasActiveAccess ? copy.feedEmpty : copy.feedEmptyClosed}</p>
      )}

      {showActiveBlock && !loading && (
        <section className="feed-block feed-block--active" aria-label={copy.feedLabelActive}>
          <h2 className="feed-block__label feed-block__label--active">{copy.feedLabelActive}</h2>
          {activeSignals.length > 0 ? (
            renderCards(activeSignals)
          ) : (
            <p className="meta feed-block__empty">{copy.feedEmptyActive}</p>
          )}
        </section>
      )}

      {showClosedBlock && !loading && (
        <section
          className={`feed-block feed-block--closed${showActiveBlock ? " feed-block--closed-after-active" : ""}`}
          aria-label={copy.feedLabelClosed}
        >
          <h2 className="feed-block__label feed-block__label--closed">{copy.feedLabelClosed}</h2>
          {renderCards(visibleClosedSignals)}
          {closedHiddenCount > 0 && (
            <button
              type="button"
              className="ghost-btn feed-block__more"
              onClick={() =>
                setClosedVisibleCount((count) =>
                  Math.min(count + CLOSED_FEED_BATCH, closedSignals.length),
                )
              }
            >
              {copy.formatFeedShowMoreClosed(nextClosedBatch)}
            </button>
          )}
        </section>
      )}

      {trackers.length > 0 && <PropTrackerMini trackers={trackers} onOpen={onOpenTracker} />}

      <DeleteSignalModal
        signal={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(id, reason) => void confirmAndDelete(id, reason)}
        deleting={deleteTarget !== null && deletingId === deleteTarget.id}
      />
    </>
  );
}
