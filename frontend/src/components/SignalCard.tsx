import type { Signal } from "../api";
import { calcRR, formatTakeProfits, formatTime, formatUsd } from "../utils";

type Props = {
  signal: Signal;
  isAdmin?: boolean;
  onDelete?: (id: number) => void;
  deleting?: boolean;
};

export function SignalCard({ signal: s, isAdmin, onDelete, deleting }: Props) {
  const entry = s.entry_low || s.entry_high || "—";
  const target = formatTakeProfits(s.take_profits);
  const isLong = s.direction === "long";
  const pnl = s.realized_pnl;
  const risk = s.risk_percent ?? s.points_percent ?? 1;

  let statusBadge = "Активен";
  let statusClass = "active";
  if (s.status === "win") {
    statusBadge = "Цель достигнута";
    statusClass = "win";
  } else if (s.status === "lose") {
    statusBadge = "Стоп";
    statusClass = "lose";
  }

  return (
    <article className="signal-card">
      <header className="signal-card__head">
        <div>
          <h3>{s.symbol}</h3>
          <span className={`dir-badge ${isLong ? "long" : "short"}`}>
            {isLong ? "↑ LONG" : "↓ SHORT"}
          </span>
        </div>
        <div className="signal-card__actions">
          <span className="risk-tag">Риск {risk}%</span>
          {isAdmin && s.status === "active" && onDelete && (
            <button
              type="button"
              className="delete-btn"
              disabled={deleting}
              onClick={() => onDelete(s.id)}
            >
              Удалить
            </button>
          )}
        </div>
      </header>
      <p className="signal-card__time">{formatTime(s.created_at)}</p>
      <div className="levels-grid">
        <div>
          <span>вход</span>
          <strong>{entry}</strong>
        </div>
        <div className="stop">
          <span>стоп</span>
          <strong>{s.stop_loss || "—"}</strong>
        </div>
        <div className="target">
          <span>цель</span>
          <strong>{target}</strong>
        </div>
      </div>
      {s.comment && <p className="signal-card__comment">{s.comment}</p>}
      <footer className="signal-card__foot">
        <span>Плечо {s.leverage ?? 5}x</span>
        <span>RR {calcRR(entry === "—" ? null : entry, s.stop_loss, s.take_profits)}</span>
        {pnl != null && (
          <span className={pnl >= 0 ? "pnl-win" : "pnl-lose"}>
            {pnl >= 0 ? "+" : ""}
            {formatUsd(pnl)}
          </span>
        )}
        <span className={`outcome ${statusClass}`}>{statusBadge}</span>
      </footer>
    </article>
  );
}
