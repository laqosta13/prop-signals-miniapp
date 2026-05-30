import { useMemo, useState } from "react";
import type { CultChannel, Trader } from "../api";
import { EquityCurve } from "./EquityCurve";
import { CultChannelAdminPanel } from "./CultChannelAdminPanel";
import { CultChannelCard } from "./CultChannelCard";
import { RankBadge } from "./RankBadge";
import { RankGuide } from "./RankGuide";
import { TraderProfileModal } from "./TraderProfileModal";
import { VolnovoiCopyPanel } from "./VolnovoiCopyPanel";
import { authorProfile } from "../utils";
import { isVolnovoiTrader } from "../utils/volnovoi";
import { Avatar } from "./Avatar";

type Props = {
  traders: Trader[];
  cultChannels: CultChannel[];
  loading: boolean;
  myId: number | null;
  isAdmin: boolean;
  onCultChannelsChange: () => void;
};

function TopTraderCard({ trader, onOpen }: { trader: Trader; onOpen: () => void }) {
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
      </div>
    </li>
  );
}

export function LeaderboardTab({
  traders,
  cultChannels,
  loading,
  myId,
  isAdmin,
  onCultChannelsChange,
}: Props) {
  const [profileTrader, setProfileTrader] = useState<Trader | null>(null);

  const volnovoi = traders.find((t) => isVolnovoiTrader(t));
  const traderCandidates = useMemo(
    () =>
      traders
        .filter((t) => !isVolnovoiTrader(t))
        .sort((a, b) => b.rating_percent - a.rating_percent),
    [traders],
  );
  const channelCandidates = useMemo(
    () => [...cultChannels].sort((a, b) => b.rating_percent - a.rating_percent),
    [cultChannels],
  );

  const showTradersBlock = Boolean(volnovoi || traderCandidates.length > 0);
  const showCandidatesBlock = channelCandidates.length > 0 || isAdmin;

  if (loading) return <p className="meta">Загрузка…</p>;

  return (
    <>
      {!traders.length && !cultChannels.length && (
        <p className="meta">Рейтинг появится после закрытых сигналов.</p>
      )}

      <RankGuide />

      {showTradersBlock && (
        <section className="top-cult-block top-cult-block--traders">
          <p className="top-cult-label top-cult-label--traders">ТРЕЙДЕРЫ CULT/A</p>
          {volnovoi && (
            <ol className="top-list top-list--solo">
              <TopTraderCard trader={volnovoi} onOpen={() => setProfileTrader(volnovoi)} />
            </ol>
          )}
          {volnovoi && <VolnovoiCopyPanel />}
          {traderCandidates.length > 0 && (
            <ol className={`top-list${volnovoi ? " top-list--after-volnovoi" : ""}`}>
              {traderCandidates.map((trader) => (
                <TopTraderCard
                  key={trader.telegram_id}
                  trader={trader}
                  onOpen={() => setProfileTrader(trader)}
                />
              ))}
            </ol>
          )}
        </section>
      )}

      {showCandidatesBlock && (
        <section className="top-cult-block top-cult-block--candidates">
          <p className="top-cult-label top-cult-label--candidates">КОНДИДАТЫ В CULT</p>
          {channelCandidates.length > 0 ? (
            <ol className="top-list">
              {channelCandidates.map((channel) => (
                <CultChannelCard key={channel.id} channel={channel} />
              ))}
            </ol>
          ) : (
            !isAdmin && <p className="meta">Кандидаты появятся после подключения каналов.</p>
          )}
          {isAdmin && <CultChannelAdminPanel channels={cultChannels} onChange={onCultChannelsChange} />}
        </section>
      )}

      {profileTrader && (
        <TraderProfileModal
          trader={profileTrader}
          isMe={myId === profileTrader.telegram_id}
          isAdmin={isAdmin}
          onClose={() => setProfileTrader(null)}
        />
      )}
    </>
  );
}
