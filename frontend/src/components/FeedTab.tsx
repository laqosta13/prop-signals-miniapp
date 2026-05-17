import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { deleteSignal, type ChallengeDashboard, type Signal } from "../api";
import { PropTrackerMini } from "./PropTrackerMini";
import { SignalCard } from "./SignalCard";

type Props = {
  signals: Signal[];
  challenge: ChallengeDashboard | null;
  loading: boolean;
  isAdmin: boolean;
  onOpenTracker: () => void;
  onChanged: () => void;
  onEdit: (signal: Signal) => void;
  onPatch: (id: number, patch: Partial<Signal>) => void;
};

export function FeedTab({ signals, challenge, loading, isAdmin, onOpenTracker, onChanged, onEdit, onPatch }: Props) {
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
      {loading && <p className="meta">Загрузка…</p>}
      {!loading && signals.length === 0 && <p className="meta">Пока нет сигналов.</p>}
      {signals.map((s) => (
        <SignalCard
          key={s.id}
          signal={s}
          isAdmin={isAdmin}
          deleting={deletingId === s.id}
          onEdit={onEdit}
          onDelete={handleDelete}
          onPatch={onPatch}
        />
      ))}
      {challenge && <PropTrackerMini data={challenge} onOpen={onOpenTracker} />}
    </>
  );
}
