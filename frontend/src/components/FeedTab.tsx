import { useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { closeSignalAtMarket, deleteSignal, type ChallengeDashboard, type Signal } from "../api";
import { FEED_LABEL_ACTIVE, FEED_LABEL_CLOSED, testModeBannerText } from "../data/appCopy";
import { formatDateTimeMsk } from "../utils";
import { canViewActiveSignals, visibleFeedSignals } from "../utils/signalActions";
import { splitFeedSignals } from "../utils/sortFeedSignals";
import { PropTrackerMini } from "./PropTrackerMini";
import { SignalCard } from "./SignalCard";

type Props = {
  signals: Signal[];
  trackers: ChallengeDashboard[];
  loading: boolean;
  isAdmin: boolean;
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const feedTrader = isAdmin || canPublishMainFeed;
  const hasActiveAccess = canViewActiveSignals(subscriptionActive, feedTrader);
  const visible = visibleFeedSignals(signals, subscriptionActive, feedTrader);
  const { active: activeSignals, closed: closedSignals } = useMemo(
    () => splitFeedSignals(visible),
    [visible],
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этот сигнал?")) return;
    setDeletingId(id);
    try {
      await deleteSignal(id);
      WebApp.HapticFeedback.notificationOccurred("success");
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseAtMarket = async (id: number) => {
    if (!confirm("Закрыть сигнал по текущей рыночной цене?")) return;
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
        <div className="sub-banner sub-banner--test-mode">
          <p>
            {testModeBannerText(testModeUntil, testModeDaysLeft)}
            {testModeUntil ? ` До ${formatDateTimeMsk(testModeUntil)} МСК.` : ""}
          </p>
        </div>
      )}
      {!hasActiveAccess && (
        <div className="sub-banner">
          <p>Активные сигналы доступны по подписке. Оформите доступ во вкладке «Подписка».</p>
          <button type="button" className="ghost-btn" onClick={onOpenPay}>
            Оплата и подписка →
          </button>
        </div>
      )}
      {loading && <p className="meta">Загрузка…</p>}
      {!loading && visible.length === 0 && (
        <p className="meta">{hasActiveAccess ? "Пока нет сигналов." : "Пока нет отработанных сигналов."}</p>
      )}

      {showActiveBlock && !loading && (
        <section className="feed-block feed-block--active" aria-label={FEED_LABEL_ACTIVE}>
          <h2 className="feed-block__label feed-block__label--active">{FEED_LABEL_ACTIVE}</h2>
          {activeSignals.length > 0 ? (
            renderCards(activeSignals)
          ) : (
            <p className="meta feed-block__empty">Нет активных сделок</p>
          )}
        </section>
      )}

      {showClosedBlock && !loading && (
        <section
          className={`feed-block feed-block--closed${showActiveBlock ? " feed-block--closed-after-active" : ""}`}
          aria-label={FEED_LABEL_CLOSED}
        >
          <h2 className="feed-block__label feed-block__label--closed">{FEED_LABEL_CLOSED}</h2>
          {renderCards(closedSignals)}
        </section>
      )}

      {trackers.length > 0 && <PropTrackerMini trackers={trackers} onOpen={onOpenTracker} />}
    </>
  );
}
