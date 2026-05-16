import type { Trader } from "../api";
import { traderName } from "../utils";
import { Avatar } from "./Avatar";

type Props = { traders: Trader[]; loading: boolean };

export function LeaderboardTab({ traders, loading }: Props) {
  if (loading) return <p className="meta">Загрузка…</p>;
  if (traders.length === 0) {
    return <p className="meta">Рейтинг появится после закрытых сигналов WIN/LOSE.</p>;
  }

  return (
    <ol className="top-list">
      {traders.map((t) => (
        <li key={t.telegram_id} className="top-card">
          <span className="top-rank">#{t.rank}</span>
          <Avatar url={t.avatar_url} username={t.username} telegramId={t.telegram_id} size={44} />
          <div className="top-body">
            <p className="top-name">{traderName(t.username, t.telegram_id)}</p>
            <p className="top-score">{t.rating_percent.toFixed(1)}%</p>
            <p className="top-meta">
              <span className="pnl-win">W {t.wins}</span> · <span className="pnl-lose">L {t.losses}</span> · WR{" "}
              {t.win_rate}%
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
