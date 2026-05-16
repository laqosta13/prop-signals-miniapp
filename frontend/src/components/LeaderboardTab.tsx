import type { Trader } from "../api";
import { traderName } from "../utils";

type Props = {
  traders: Trader[];
  loading: boolean;
};

export function LeaderboardTab({ traders, loading }: Props) {
  if (loading) return <p className="meta">Загрузка…</p>;
  if (traders.length === 0) {
    return <p className="meta">Пока нет закрытых сигналов — рейтинг появится после WIN/LOSE.</p>;
  }

  return (
    <ol className="leaderboard">
      {traders.map((t) => (
        <li key={t.telegram_id} className="leader-card">
          <span className="rank">#{t.rank}</span>
          <div className="leader-body">
            <div className="leader-name">{traderName(t.username, t.telegram_id)}</div>
            <div className="leader-score">{t.rating_percent.toFixed(1)}%</div>
            <div className="leader-stats">
              <span className="stat-win">Побед: {t.wins}</span>
              <span className="stat-lose">Поражений: {t.losses}</span>
              <span>Win rate: {t.win_rate}%</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
