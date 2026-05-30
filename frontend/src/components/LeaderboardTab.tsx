import { useState } from "react";
import type { Trader } from "../api";
import { EquityCurve } from "./EquityCurve";
import { RankBadge } from "./RankBadge";
import { RankGuide } from "./RankGuide";
import { TraderProfileModal } from "./TraderProfileModal";
import { VolnovoiCopyPanel } from "./VolnovoiCopyPanel";
import { authorProfile } from "../utils";
import { isVolnovoiTrader } from "../utils/volnovoi";
import { Avatar } from "./Avatar";

type Props = {
  traders: Trader[];
  loading: boolean;
  myId: number | null;
  subscriptionActive: boolean;
};

export function LeaderboardTab({ traders, loading, myId, subscriptionActive }: Props) {
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
          <li key={t.telegram_id} className={aggregate ? "top-list__item--aggregate" : undefined}>
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
                  <div className="top-name-row">
                    <p className="top-name">{authorProfile(t.display_name, t.username).title}</p>
                    {t.trader_rank && <RankBadge rank={t.trader_rank} compact />}
                  </div>
                  {aggregate && <p className="top-aggregate-hint">Аккаунт · все сделки трейдеров</p>}
                  <p className={`top-score ${t.rating_percent >= 0 ? "up" : "down"}`}>
                    {t.rating_percent >= 0 ? "+" : ""}
                    {t.rating_percent.toFixed(2)}%
                  </p>
                  <p className="top-meta">
                    W {t.wins} · L {t.losses} · WR {t.win_rate}%
                  </p>
                </div>
              </div>

              {t.daily_stats.length > 0 && <EquityCurve dailyStats={t.daily_stats} />}
            </button>
            {aggregate && <VolnovoiCopyPanel subscriptionActive={subscriptionActive} />}
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
