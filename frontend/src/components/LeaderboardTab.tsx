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

type CandidateItem =
  | { kind: "trader"; rating: number; trader: Trader }
  | { kind: "channel"; rating: number; channel: CultChannel };

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
  const adminCandidates = traders.filter((t) => !isVolnovoiTrader(t));

  const candidates = useMemo(() => {
    const items: CandidateItem[] = [
      ...adminCandidates.map((trader) => ({ kind: "trader" as const, rating: trader.rating_percent, trader })),
      ...cultChannels.map((channel) => ({ kind: "channel" as const, rating: channel.rating_percent, channel })),
    ];
    return items.sort((a, b) => b.rating - a.rating);
  }, [adminCandidates, cultChannels]);

  if (loading) return <p className="meta">Загрузка…</p>;

  return (
    <div className="top-panel">
      {!traders.length && !cultChannels.length && (
        <p className="meta">Рейтинг появится после закрытых сигналов.</p>
      )}

      <div className="top-panel__main">
        <RankGuide />

        {volnovoi && (
          <section className="top-cult-block top-cult-block--traders">
            <p className="top-cult-label top-cult-label--traders">ТРЕЙДЕРЫ CULT/A</p>
            <ol className="top-list top-list--solo">
              <TopTraderCard trader={volnovoi} onOpen={() => setProfileTrader(volnovoi)} />
            </ol>
            <VolnovoiCopyPanel />
          </section>
        )}
      </div>

      <section className="top-cult-block top-cult-block--candidates">
        <p className="top-cult-label top-cult-label--candidates">КОНДИДАТЫ В CULT</p>
        {candidates.length > 0 ? (
          <ol className="top-list">
            {candidates.map((item) =>
              item.kind === "trader" ? (
                <TopTraderCard
                  key={`t-${item.trader.telegram_id}`}
                  trader={item.trader}
                  onOpen={() => setProfileTrader(item.trader)}
                />
              ) : (
                <CultChannelCard key={`c-${item.channel.id}`} channel={item.channel} />
              ),
            )}
          </ol>
        ) : (
          <p className="meta">Кандидаты появятся после сделок или подключения каналов.</p>
        )}
        {isAdmin && <CultChannelAdminPanel channels={cultChannels} onChange={onCultChannelsChange} />}
      </section>

      {profileTrader && (
        <TraderProfileModal
          trader={profileTrader}
          isMe={myId === profileTrader.telegram_id}
          isAdmin={isAdmin}
          onClose={() => setProfileTrader(null)}
        />
      )}
    </div>
  );
}
