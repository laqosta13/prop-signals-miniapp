import { useMemo } from "react";
import type { ChallengeDashboard, Signal } from "../api";
import { HASHHEDGE_RULES } from "../data/hashhedgeRules";
import { authorProfile, formatTakeProfits, formatUsd } from "../utils";
import { Avatar } from "./Avatar";
import { HashHedgeRulesTable } from "./HashHedgeRulesTable";

type Props = {
  trackers: ChallengeDashboard[];
  signals: Signal[];
  myId: number | null;
  isAdmin: boolean;
  onSettings: () => void;
};

export function TrackerTab({ trackers, signals, myId, isAdmin, onSettings }: Props) {
  const dayLossLimitPct = 5;
  const todayLossUsd = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    return signals.reduce((sum, s) => {
      if (s.status === "active" || s.realized_pnl == null || s.realized_pnl >= 0) return sum;
      const at = s.closed_at || s.created_at;
      const ts = new Date(at).getTime();
      if (!Number.isFinite(ts) || ts < dayStart || ts >= dayEnd) return sum;
      return sum + Math.abs(s.realized_pnl);
    }, 0);
  }, [signals]);
  const totalAccountUsd = useMemo(
    () => trackers.reduce((sum, t) => sum + (Number.isFinite(t.account_size) ? t.account_size : 0), 0),
    [trackers],
  );
  const dayLimitUsd = totalAccountUsd * (dayLossLimitPct / 100);
  const dayRemainingPct = dayLimitUsd > 0 ? Math.max(0, 100 - (todayLossUsd / dayLimitUsd) * 100) : 0;
  const dayRemainingUsd = Math.max(0, dayLimitUsd - todayLossUsd);

  return (
    <>
      <HashHedgeRulesTable rules={HASHHEDGE_RULES} />
      <section className="tracker-global-limit">
        <div className="tracker-global-limit__head">
          <p className="tracker-global-limit__title">ЛИМИТ ДНЯ ДЛЯ ВСЕХ ТРЕЙДЕРОВ</p>
          <strong>{dayLossLimitPct}%</strong>
        </div>
        <div className="tracker-global-limit__row">
          <span>Потери за день: {formatUsd(todayLossUsd)}</span>
          <span>Лимит: {formatUsd(dayLimitUsd)}</span>
        </div>
        <div className="progress thin">
          <span className="progress__fill" style={{ width: `${dayRemainingPct}%` }} />
        </div>
        <p className="tracker-global-limit__foot">
          Остаток {formatUsd(dayRemainingUsd)} из общей базы {formatUsd(totalAccountUsd)}
        </p>
      </section>

      {!trackers.length && (
        <p className="meta tracker-empty">Трекеры админов появятся после настройки TELEGRAM_ADMIN_IDS.</p>
      )}

      {trackers.map((d) => {
        const profitUnlimited = !!d.profit_target_unlimited;
        const progress = profitUnlimited
          ? Math.min(100, Math.max(0, d.profit_pct > 0 ? 100 : 0))
          : Math.min(100, Math.max(0, (d.profit_pct / d.profit_target_pct) * 100));
        const dd = Math.min(100, (d.drawdown_pct / d.max_drawdown_pct) * 100);
        const day = Math.min(100, ((d.max_daily_loss_pct - d.daily_loss_pct) / d.max_daily_loss_pct) * 100);
        const recent = signals
          .filter((s) => s.author_telegram_id === d.owner_telegram_id && s.status !== "active")
          .slice(0, 5);
        const canEdit = isAdmin && myId === d.owner_telegram_id;
        const minDaysLabel = d.min_trading_days_unlimited ? "∞" : String(d.min_trading_days);

        return (
          <section key={d.owner_telegram_id} className="tracker-block">
            <header className="tracker-block__head">
              <Avatar url={d.owner_avatar_url} displayName={d.owner_display_name} username={d.owner_username} size={40} />
              <div>
                <p className="tracker-block__name">{authorProfile(d.owner_display_name, d.owner_username).title}</p>
                {d.owner_username && <p className="tracker-block__sub">@{d.owner_username}</p>}
                <p className="tracker-block__sub">
                  Этап {d.stage} · плечо {d.max_leverage}
                </p>
              </div>
            </header>

            <div className="tracker-hero">
              <p className="label">Баланс</p>
              <h2>{formatUsd(d.balance)}</h2>
              <p className={`hero-pct ${d.profit_pct >= 0 ? "up" : "down"}`}>
                {d.profit_pct >= 0 ? "+" : ""}
                {d.profit_pct.toFixed(2)}%
              </p>
              {!profitUnlimited && (
                <div className="progress large">
                  <span className="progress__fill" style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className="tracker-hero__row">
                <span>Старт {formatUsd(d.account_size)}</span>
                <span>
                  Цель {profitUnlimited ? "∞" : formatUsd(d.goal_balance)} (
                  {profitUnlimited ? "∞" : `${d.profit_target_pct}%`})
                </span>
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
                <span>Торговые дни</span>
                <strong>
                  {d.trading_days} / {minDaysLabel}
                </strong>
              </div>
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
