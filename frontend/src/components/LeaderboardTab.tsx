import { useState } from "react";
import type { Trader, TraderRank } from "../api";
import { activateRankShield } from "../api";
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
};

function TopTraderCard({
  trader,
  onOpen,
  myRank,
  onShield,
  shieldBusy,
}: {
  trader: Trader;
  onOpen: () => void;
  myRank?: TraderRank | null;
  onShield?: () => void;
  shieldBusy?: boolean;
}) {
  const aggregate = isVolnovoiTrader(trader);

  return (
    <li className={aggregate ? "top-list__item--aggregate" : undefined}>
      <div className={`top-card${aggregate ? " top-card--aggregate" : ""}`}>
        <button type="button" className="top-card__head-btn" onClick={onOpen}>
          <div className="top-card__head">
            <span className={`top-rank${aggregate ? " top-rank--aggregate" : ""}`}>
              {aggregate ? "∑" : `#${trader.rank}`}
            </span>
            <Avatar url={trader.avatar_url} displayName={trader.display_name} username={trader.username} size={44} />
            <div className="top-body">
              <div className="top-name-row">
                <p className="top-name">{authorProfile(trader.display_name, trader.username).title}</p>
                {trader.trader_rank && <RankBadge rank={trader.trader_rank} compact />}
              </div>
              {aggregate && <p className="top-aggregate-hint">Копирует · все сделки трейдеров</p>}
              <p className={`top-score ${trader.rating_percent >= 0 ? "up" : "down"}`}>
                {trader.rating_percent >= 0 ? "+" : ""}
                {trader.rating_percent.toFixed(2)}%
              </p>
              <p className="top-meta">
                W {trader.wins} · L {trader.losses} · WR {trader.win_rate}%
              </p>
            </div>
          </div>
        </button>

        {trader.daily_stats.length > 0 && <EquityCurve dailyStats={trader.daily_stats} />}

        {aggregate && myRank && !myRank.shield_used_this_month && onShield && (
          <button type="button" className="btn-ghost top-card__shield" disabled={shieldBusy} onClick={onShield}>
            Страховка
          </button>
        )}
      </div>
    </li>
  );
}

export function LeaderboardTab({ traders, loading, myId }: Props) {
  const [profileTrader, setProfileTrader] = useState<Trader | null>(null);
  const [myRankOverride, setMyRankOverride] = useState<TraderRank | null>(null);
  const [shieldBusy, setShieldBusy] = useState(false);

  const volnovoi = traders.find((t) => isVolnovoiTrader(t));
  const candidates = traders.filter((t) => !isVolnovoiTrader(t));
  const myTrader = traders.find((t) => t.telegram_id === myId);
  const myRank = myRankOverride ?? myTrader?.trader_rank ?? null;

  const onActivateShield = () => {
    void (async () => {
      setShieldBusy(true);
      try {
        setMyRankOverride(await activateRankShield());
      } catch (e) {
        alert(e instanceof Error ? e.message : "Страховка недоступна");
      } finally {
        setShieldBusy(false);
      }
    })();
  };

  if (loading) return <p className="meta">Загрузка…</p>;

  return (
    <>
      {!traders.length && <p className="meta">Рейтинг появится после закрытых сигналов.</p>}

      {volnovoi && (
        <section className="top-cult-block top-cult-block--traders">
          <ol className="top-list top-list--solo">
            <TopTraderCard
              trader={volnovoi}
              onOpen={() => setProfileTrader(volnovoi)}
              myRank={myRank}
              onShield={onActivateShield}
              shieldBusy={shieldBusy}
            />
          </ol>
          <VolnovoiCopyPanel />
          <p className="top-cult-label top-cult-label--traders">ТРЕЙДЕРЫ CULT</p>
        </section>
      )}

      <RankGuide />

      {(candidates.length > 0 || traders.length > 0) && (
        <section className="top-cult-block top-cult-block--candidates">
          <p className="top-cult-label top-cult-label--candidates">КОНДИДАТЫ В CULT</p>
          {candidates.length > 0 ? (
            <ol className="top-list">
              {candidates.map((t) => (
                <TopTraderCard key={t.telegram_id} trader={t} onOpen={() => setProfileTrader(t)} />
              ))}
            </ol>
          ) : (
            !volnovoi && <p className="meta">Рейтинг появится после закрытых сигналов.</p>
          )}
        </section>
      )}

      {profileTrader && (
        <TraderProfileModal
          trader={profileTrader}
          isMe={myId === profileTrader.telegram_id}
          myRank={myRank}
          onShield={onActivateShield}
          shieldBusy={shieldBusy}
          onClose={() => setProfileTrader(null)}
        />
      )}
    </>
  );
}
