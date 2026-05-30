import { useState } from "react";
import type { Trader } from "../api";
import { EquityCurve } from "./EquityCurve";
import { RankBadge } from "./RankBadge";
import { RankGuide } from "./RankGuide";
import { TraderProfileModal } from "./TraderProfileModal";
import { authorProfile } from "../utils";
import { isVolnovoiTrader } from "../utils/volnovoi";
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
        {traders.map((t) => {
          const aggregate = isVolnovoiTrader(t);
          return (
          <li key={t.telegram_id}>
            <button
              type="button"
              className={`top-card top-card--btn${aggregate ? " top-card--aggregate" : ""}`}
              onClick={() => setProfileTrader(t)}
            >
              <div className="top-card__head">
                <span className={`top-rank${aggregate ? " top-rank--aggregate" : ""}`}>
                  {aggregate ? "∑" : `#${t.rank}`}
                </span>
                <Avatar url={t.avatar_url} displayName={t.display_name} username={t.username} size={44} />
                <div className="top-body">
                  <p className="top-name">{authorProfile(t.display_name, t.username).title}</p>
                  {aggregate && <p className="top-aggregate-hint">Аккаунт · все сделки трейдеров</p>}
                  <p className={`top-score ${t.rating_percent >= 0 ? "up" : "down"}`}>
                    {t.rating_percent >= 0 ? "+" : ""}
                    {t.rating_percent.toFixed(2)}%
                  </p>
                  <p className="top-meta top-meta--ranks">
                    {t.trader_rank && (
                      <span className="top-rank-row">
                        <span className="top-rank-row__label">Ранг:</span>
                        <RankBadge rank={t.trader_rank} compact />
                      </span>
                    )}
                    <span className="top-meta__stats">
                      W {t.wins} · L {t.losses} · WR {t.win_rate}%
                    </span>
                  </p>
                </div>
              </div>

              {t.daily_stats.length > 0 && <EquityCurve dailyStats={t.daily_stats} />}
            </button>
          </li>
          );
        })}
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
