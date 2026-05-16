import type { ChallengeDashboard, Signal } from "../api";
import { formatTakeProfits, formatTime, formatUsd } from "../utils";

type Props = {
  data: ChallengeDashboard;
  signals: Signal[];
  onSettings: () => void;
};

export function TrackerTab({ data, signals, onSettings }: Props) {
  const progress = Math.min(100, Math.max(0, (data.profit_pct / data.profit_target_pct) * 100));
  const ddProgress = Math.min(100, (data.drawdown_pct / data.max_drawdown_pct) * 100);
  const dayProgress = Math.min(
    100,
    ((data.max_daily_loss_pct - data.daily_loss_pct) / data.max_daily_loss_pct) * 100,
  );
  const recent = signals.filter((s) => s.status !== "active").slice(0, 5);

  return (
    <>
      <div className="tracker-hero">
        <p className="label">Текущий баланс</p>
        <h2>{formatUsd(data.balance)}</h2>
        <p className={`hero-pct ${data.profit_pct >= 0 ? "up" : "down"}`}>
          {data.profit_pct >= 0 ? "+" : ""}
          {data.profit_pct.toFixed(2)}%
        </p>
        <div className="progress large">
          <span className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="tracker-hero__row">
          <span>Старт: {formatUsd(data.account_size)}</span>
          <span>Цель: {formatUsd(data.goal_balance)}</span>
        </div>
        <p className="stage-tag">Этап {data.stage} · Hash Hedge</p>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <span className="label">Просадка</span>
          <strong>
            {data.drawdown_pct.toFixed(1)}% / {data.max_drawdown_pct}%
          </strong>
          <div className="progress thin danger">
            <span className="progress__fill danger" style={{ width: `${ddProgress}%` }} />
          </div>
        </div>
        <div className="metric-card">
          <span className="label">Лимит дня</span>
          <strong>{formatUsd(data.daily_remaining_usd)} осталось</strong>
          <div className="progress thin">
            <span className="progress__fill" style={{ width: `${dayProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <span>Сделок</span>
          <strong>{data.trades_count}</strong>
        </div>
        <div className="stat">
          <span>Винрейт</span>
          <strong>{data.winrate}%</strong>
        </div>
        <div className="stat">
          <span>P/L</span>
          <strong className={data.total_pnl >= 0 ? "up" : "down"}>
            {data.total_pnl >= 0 ? "+" : ""}
            {formatUsd(data.total_pnl)}
          </strong>
        </div>
      </div>

      <button type="button" className="ghost-btn" onClick={onSettings}>
        Настроить счёт и этап
      </button>

      <h3 className="section-title">Последние сделки</h3>
      <ul className="trade-list">
        {recent.map((s) => (
          <li key={s.id}>
            <div>
              <strong>{s.symbol}</strong>
              <span className="muted"> {s.direction.toUpperCase()} · {formatTime(s.closed_at || s.created_at)}</span>
            </div>
            <span className={s.realized_pnl && s.realized_pnl >= 0 ? "pnl-win" : "pnl-lose"}>
              {s.realized_pnl != null
                ? `${s.realized_pnl >= 0 ? "+" : ""}${formatUsd(s.realized_pnl)}`
                : formatTakeProfits(s.take_profits)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
