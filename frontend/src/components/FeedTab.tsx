import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { deleteSignal, type ChallengeDashboard, type Signal } from "../api";
import { PropTrackerMini } from "./PropTrackerMini";
import { SignalCard } from "./SignalCard";

type Props = {
  signals: Signal[];
  trackers: ChallengeDashboard[];
  loading: boolean;
  isAdmin: boolean;
  subscriptionActive: boolean;
  onChanged: () => void;
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
  subscriptionActive,
  onChanged,
  onEdit,
  onSupplement,
  onPatch,
  onOpenPay,
  onOpenTracker,
}: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  return (
    <>
      {!subscriptionActive && !isAdmin && (
        <div className="sub-banner">
          <p>Нужна подписка для просмотра сигналов.</p>
          <button type="button" className="ghost-btn" onClick={onOpenPay}>
            Оплата и подписка →
          </button>
        </div>
      )}
      {loading && <p className="meta">Загрузка…</p>}
      {!loading && subscriptionActive && signals.length === 0 && <p className="meta">Пока нет сигналов.</p>}
      {signals.map((s) => (
        <SignalCard
          key={s.id}
          signal={s}
          isAdmin={isAdmin}
          canEngage={subscriptionActive || isAdmin}
          deleting={deletingId === s.id}
          onEdit={onEdit}
          onSupplement={onSupplement}
          onDelete={handleDelete}
          onPatch={onPatch}
        />
      ))}
      {trackers.length > 0 && <PropTrackerMini trackers={trackers} onOpen={onOpenTracker} />}
    </>
  );
}
