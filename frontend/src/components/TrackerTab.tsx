import type { ChallengeDashboard, Signal } from "../api";
import { formatTakeProfits, formatUsd, traderName } from "../utils";
import { Avatar } from "./Avatar";

type Props = {
  trackers: ChallengeDashboard[];
  signals: Signal[];
  myId: number | null;
  isAdmin: boolean;
  onSettings: () => void;
};

export function TrackerTab({ trackers, signals, myId, isAdmin, onSettings }: Props) {
  if (!trackers.length) return <p className="meta">Трекеры админов появятся после настройки TELEGRAM_ADMIN_IDS.</p>;

  return (
    <>
      {trackers.map((d) => {
        const progress = Math.min(100, Math.max(0, (d.profit_pct / d.profit_target_pct) * 100));
        const dd = Math.min(100, (d.drawdown_pct / d.max_drawdown_pct) * 100);
        const day = Math.min(100, ((d.max_daily_loss_pct - d.daily_loss_pct) / d.max_daily_loss_pct) * 100);
        const recent = signals.filter((s) => s.author_telegram_id === d.owner_telegram_id && s.status !== "active").slice(0, 5);
        const canEdit = isAdmin && myId === d.owner_telegram_id;

        return (
          <section key={d.owner_telegram_id} className="tracker-block">
            <header className="tracker-block__head">
              <Avatar url={d.owner_avatar_url} username={d.owner_username} telegramId={d.owner_telegram_id} size={40} />
              <div>
                <p className="tracker-block__name">{traderName(d.owner_username, d.owner_telegram_id)}</p>
                <p className="tracker-block__sub">Этап {d.stage}</p>
              </div>
            </header>

            <div className="tracker-hero">
              <p className="label">Баланс</p>
              <h2>{formatUsd(d.balance)}</h2>
              <p className={`hero-pct ${d.profit_pct >= 0 ? "up" : "down"}`}>
                {d.profit_pct >= 0 ? "+" : ""}
                {d.profit_pct.toFixed(2)}%
              </p>
              <div className="progress large">
                <span className="progress__fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="tracker-hero__row">
                <span>Старт {formatUsd(d.account_size)}</span>
                <span>Цель {formatUsd(d.goal_balance)}</span>
              </div>
            </div>

            <div className="metric-row">
              <div className="metric-card">
                <span className="label">Просадка</span>
                <strong>
                  {d.drawdown_pct.toFixed(1)}% / {d.max_drawdown_pct}%
                </strong>
                <div className="progress thin danger">
                  <span className="progress__fill danger" style={{ width: `${dd}%` }} />
                </div>
              </div>
              <div className="metric-card">
                <span className="label">Лимит дня</span>
                <strong>{formatUsd(d.daily_remaining_usd)}</strong>
                <div className="progress thin">
                  <span className="progress__fill" style={{ width: `${day}%` }} />
                </div>
              </div>
            </div>

            <div className="stats-row">
              <div className="stat">
                <span>Сделок</span>
                <strong>{d.trades_count}</strong>
              </div>
              <div className="stat">
                <span>WR</span>
                <strong>{d.winrate}%</strong>
              </div>
              <div className="stat">
                <span>P/L</span>
                <strong className={d.total_pnl >= 0 ? "up" : "down"}>
                  {d.total_pnl >= 0 ? "+" : ""}
                  {formatUsd(d.total_pnl)}
                </strong>
              </div>
            </div>

            {canEdit && (
              <button type="button" className="ghost-btn" onClick={onSettings}>
                Настройки
              </button>
            )}

            {recent.length > 0 && (
              <ul className="trade-list">
                {recent.map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.symbol}</strong>
                      <span className="muted"> {s.direction.toUpperCase()}</span>
                    </div>
                    <span className={s.realized_pnl != null && s.realized_pnl >= 0 ? "pnl-win" : "pnl-lose"}>
                      {s.realized_pnl != null
                        ? `${s.realized_pnl >= 0 ? "+" : ""}${formatUsd(s.realized_pnl)}`
                        : formatTakeProfits(s.take_profits)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
