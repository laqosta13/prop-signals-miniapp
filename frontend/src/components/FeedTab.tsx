import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { closeSignalAtMarket, deleteSignal, type ChallengeDashboard, type Signal } from "../api";
import { canViewActiveSignals, visibleFeedSignals } from "../utils/signalActions";
import { PropTrackerMini } from "./PropTrackerMini";
import { SignalCard } from "./SignalCard";

type Props = {
  signals: Signal[];
  trackers: ChallengeDashboard[];
  loading: boolean;
  isAdmin: boolean;
  myId: number | null;
  subscriptionActive: boolean;
  onChanged: () => void;
  onReloadTrackers?: () => void | Promise<void>;
  onEdit: (signal: Signal) => void;
  onSupplement: (signal: Signal) => void;
  onPatch: (id: number, patch: Partial<Signal>) => void;
  onOpenPay: () => void;
  onOpenTracker: () => void;
};

export function FeedTab({
  signals,
  trackers,
  loading,
  isAdmin,
  myId,
  subscriptionActive,
  onChanged,
  onReloadTrackers,
  onEdit,
  onSupplement,
  onPatch,
  onOpenPay,
  onOpenTracker,
}: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const hasActiveAccess = canViewActiveSignals(subscriptionActive, isAdmin);
  const visible = visibleFeedSignals(signals, subscriptionActive, isAdmin);
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

  return (
    <>
      {!hasActiveAccess && (
        <div className="sub-banner">
          <p>Всё бесплатно, кроме активных сигналов — они по подписке.</p>
          <button type="button" className="ghost-btn" onClick={onOpenPay}>
            Оплата и подписка →
          </button>
        </div>
      )}
      {loading && <p className="meta">Загрузка…</p>}
      {!loading && visible.length === 0 && (
        <p className="meta">{hasActiveAccess ? "Пока нет сигналов." : "Пока нет отработанных сигналов."}</p>
      )}
      {visible.map((s) => (
        <SignalCard
          key={s.id}
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
      ))}
      {trackers.length > 0 && <PropTrackerMini trackers={trackers} onOpen={onOpenTracker} />}
    </>
  );
}
