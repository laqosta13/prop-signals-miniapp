import type { Trader } from "../api";
import { EquityCurve } from "./EquityCurve";
import { formatDayLabel, formatUsd, traderName } from "../utils";
import { Avatar } from "./Avatar";

type Props = { traders: Trader[]; loading: boolean };

export function LeaderboardTab({ traders, loading }: Props) {
  if (loading) return <p className="meta">Загрузка…</p>;
  if (!traders.length) return <p className="meta">Рейтинг появится после закрытых сигналов.</p>;

  return (
    <ol className="top-list">
      {traders.map((t) => (
        <li key={t.telegram_id} className="top-card">
          <span className="top-rank">#{t.rank}</span>
          <Avatar url={t.avatar_url} username={t.username} telegramId={t.telegram_id} size={44} />
          <div className="top-body">
            <p className="top-name">{traderName(t.username, t.telegram_id)}</p>
            <p className="top-score">
              {t.rating_percent >= 0 ? "+" : ""}
              {t.rating_percent.toFixed(2)}%
            </p>
            <p className="top-meta">
              <span className={t.total_pnl_usd >= 0 ? "pnl-win" : "pnl-lose"}>{formatUsd(t.total_pnl_usd)}</span> · W{" "}
              {t.wins} · L {t.losses} · WR {t.win_rate}%
            </p>
            <EquityCurve dailyStats={t.daily_stats} />
            {t.daily_stats.length > 0 && (
              <ul className="day-stats">
                {t.daily_stats.map((d) => (
                  <li key={d.date}>
                    <span>{formatDayLabel(d.date)}</span>
                    <span className={d.pnl_usd >= 0 ? "pnl-win" : "pnl-lose"}>
                      {d.pnl_usd >= 0 ? "+" : ""}
                      {formatUsd(d.pnl_usd)}
                    </span>
                    <span className={d.rating_delta >= 0 ? "pnl-win" : "pnl-lose"}>
                      {d.rating_delta >= 0 ? "+" : ""}
                      {d.rating_delta.toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
