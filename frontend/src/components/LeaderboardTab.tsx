import { useState } from "react";
import type { Trader } from "../api";
import { EquityCurve } from "./EquityCurve";
import { RankBadge } from "./RankBadge";
import { RankGuide } from "./RankGuide";
import { TraderProfileModal } from "./TraderProfileModal";
import { authorProfile, formatDayLabel, formatUsd } from "../utils";
import { Avatar } from "./Avatar";

type Props = {
  traders: Trader[];
  loading: boolean;
  myId: number | null;
};

export function LeaderboardTab({ traders, loading, myId }: Props) {
  const [profileTrader, setProfileTrader] = useState<Trader | null>(null);

  if (loading) return <p className="meta">Загрузка…</p>;

  return (
    <>
      {!traders.length && <p className="meta">Рейтинг появится после закрытых сигналов.</p>}

      {traders.length > 0 && (
      <ol className="top-list">
        {traders.map((t) => (
          <li key={t.telegram_id}>
            <button type="button" className="top-card top-card--btn" onClick={() => setProfileTrader(t)}>
              <div className="top-card__head">
                <span className="top-rank">#{t.rank}</span>
                <Avatar url={t.avatar_url} displayName={t.display_name} username={t.username} size={44} />
                <div className="top-body">
                  <p className="top-name">{authorProfile(t.display_name, t.username).title}</p>
                  {t.username && <p className="top-login">@{t.username}</p>}
                  <p className="top-score">
                    {t.rating_percent >= 0 ? "+" : ""}
                    {t.rating_percent.toFixed(2)}%
                  </p>
                  <p className="top-meta top-meta--ranks">
                    {t.trader_rank && <RankBadge rank={t.trader_rank} compact />}
                    <span>
                      W {t.wins} · L {t.losses} · WR {t.win_rate}%
                    </span>
                  </p>
                </div>
              </div>

              {t.daily_stats.length > 0 && (
                <>
                  <EquityCurve dailyStats={t.daily_stats} />
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
                </>
              )}
            </button>
          </li>
        ))}
      </ol>
      )}

      <RankGuide />

      {profileTrader && (
        <TraderProfileModal
          trader={profileTrader}
          isMe={myId === profileTrader.telegram_id}
          onClose={() => setProfileTrader(null)}
        />
      )}
    </>
  );
}
