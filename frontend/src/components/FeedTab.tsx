import type { ChallengeDashboard, Signal } from "../api";
import { PropTrackerMini } from "./PropTrackerMini";
import { SignalCard } from "./SignalCard";

type Props = {
  signals: Signal[];
  challenge: ChallengeDashboard | null;
  loading: boolean;
  onOpenTracker: () => void;
};

export function FeedTab({ signals, challenge, loading, onOpenTracker }: Props) {
  return (
    <>
      {loading && <p className="meta">Загрузка…</p>}
      {!loading && signals.length === 0 && <p className="meta">Пока нет сигналов.</p>}
      {signals.map((s) => (
        <SignalCard key={s.id} signal={s} />
      ))}
      {challenge && <PropTrackerMini data={challenge} onOpen={onOpenTracker} />}
    </>
  );
}
