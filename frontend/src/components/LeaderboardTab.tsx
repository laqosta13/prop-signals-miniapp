import { useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  closeCultCandidateSignalAtMarket,
  fetchCultCandidateSignal,
  type CultCandidate,
  type CultCandidateClosedSignal,
  type CultChannel,
  type Signal,
  type Trader,
} from "../api";
import { EquityCurve } from "./EquityCurve";
import { CultCandidateCard } from "./CultCandidateCard";
import { CultCandidateJoinPanel } from "./CultCandidateJoinPanel";
import { CultCandidateSignalDetailModal } from "./CultCandidateSignalDetailModal";
import { CultCandidateSignalModal } from "./CultCandidateSignalModal";
import { CultChannelAdminPanel } from "./CultChannelAdminPanel";
import { CultChannelCard } from "./CultChannelCard";
import { RankBadge } from "./RankBadge";
import { RankGuide } from "./RankGuide";
import { TraderProfileModal } from "./TraderProfileModal";
import { TraderRosterActions, type TraderRosterPlacement } from "./TraderRosterActions";
import { VolnovoiCopyPanel } from "./VolnovoiCopyPanel";
import { VolnovoiMarketingBadge } from "./VolnovoiMarketingBadge";
import { authorProfile } from "../utils";
import {
  TOP_CANDIDATES_EMPTY,
  TOP_EMPTY,
  TOP_INTRO,
  TOP_LABEL_CANDIDATES,
  TOP_LABEL_FIRED,
  TOP_LABEL_TRADERS,
} from "../data/appCopy";
import { isVolnovoiTrader, VOLNOVOI_SUBTITLE } from "../utils/volnovoi";
import { Avatar } from "./Avatar";

type Props = {
  traders: Trader[];
  firedTraders: Trader[];
  cultCandidates: CultCandidate[];
  canPublishCandidate: boolean;
  cultChannels: CultChannel[];
  loading: boolean;
  myId: number | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onCultChannelsChange: () => void;
  onCultCandidatesChange: () => void;
  onRosterChange: () => void;
};

function TopTraderCard({
  trader,
  onOpen,
  fired = false,
  isSuperAdmin = false,
  rosterPlacement,
  onRosterChange,
}: {
  trader: Trader;
  onOpen: () => void;
  fired?: boolean;
  isSuperAdmin?: boolean;
  rosterPlacement?: TraderRosterPlacement;
  onRosterChange?: () => void;
}) {
  const aggregate = isVolnovoiTrader(trader);

  return (
    <li className={aggregate ? "top-list__item--aggregate" : undefined}>
      <div
        className={`top-card${aggregate ? " top-card--aggregate" : ""}${fired ? " top-card--fired" : ""}`}
      >
        <button type="button" className="top-card__head-btn" onClick={onOpen}>
          <div className="top-card__head">
            <span
              className={`top-rank${aggregate ? " top-rank--aggregate" : ""}${fired ? " top-rank--fired" : ""}`}
            >
              {aggregate ? "∑" : fired ? "—" : `#${trader.rank}`}
            </span>
            <Avatar url={trader.avatar_url} displayName={trader.display_name} username={trader.username} size={44} />
            <div className="top-body">
              <div className="top-name-row">
                <p className="top-name">{authorProfile(trader.display_name, trader.username).title}</p>
                {aggregate ? (
                  <VolnovoiMarketingBadge trader={trader} />
                ) : (
                  trader.trader_rank && <RankBadge rank={trader.trader_rank} featured />
                )}
              </div>
              {aggregate && trader.trader_rank && (
                <div className="top-aggregate-rank">
                  <RankBadge rank={trader.trader_rank} featured />
                </div>
              )}
              {aggregate && <p className="top-aggregate-hint">{VOLNOVOI_SUBTITLE}</p>}
              <p className={`top-score ${trader.rating_percent >= 0 ? "up" : "down"}`}>
                {trader.rating_percent >= 0 ? "+" : ""}
                {trader.rating_percent.toFixed(2)}%
              </p>
              <p className="top-meta">
                {fired && trader.trader_rank != null ? (
                  <>
                    Неделя: {trader.trader_rank.weekly_pct >= 0 ? "+" : ""}
                    {trader.trader_rank.weekly_pct.toFixed(1)}% · минус. подряд:{" "}
                    {trader.trader_rank.consecutive_loss_weeks >= 2
                      ? trader.trader_rank.consecutive_loss_weeks
                      : trader.trader_rank.consecutive_loss_weeks + (trader.trader_rank.weekly_pct < 0 ? 1 : 0)}{" "}
                    · W {trader.wins} · L {trader.losses}
                  </>
                ) : (
                  <>W {trader.wins} · L {trader.losses} · WR {trader.win_rate}%</>
                )}
              </p>
            </div>
          </div>
        </button>

        {trader.daily_stats.length > 0 && <EquityCurve dailyStats={trader.daily_stats} />}

        {isSuperAdmin && rosterPlacement && onRosterChange && !aggregate && (
          <TraderRosterActions
            telegramId={trader.telegram_id}
            placement={rosterPlacement}
            onChanged={onRosterChange}
          />
        )}
      </div>
    </li>
  );
}

export function LeaderboardTab({
  traders,
  firedTraders,
  cultCandidates,
  canPublishCandidate,
  cultChannels,
  loading,
  myId,
  isAdmin,
  isSuperAdmin,
  onCultChannelsChange,
  onCultCandidatesChange,
  onRosterChange,
}: Props) {
  const [profileTrader, setProfileTrader] = useState<Trader | null>(null);
  const [signalModalOpen, setSignalModalOpen] = useState(false);
  const [closedTradeDetail, setClosedTradeDetail] = useState<Signal | null>(null);
  const [closedTradeLoading, setClosedTradeLoading] = useState(false);
  const [closedTradeError, setClosedTradeError] = useState<string | null>(null);
  const [closingSignalId, setClosingSignalId] = useState<number | null>(null);

  const handleCloseCandidateAtMarket = async (signalId: number) => {
    if (!confirm("Закрыть сделку по текущей рыночной цене?")) return;
    setClosingSignalId(signalId);
    try {
      await closeCultCandidateSignalAtMarket(signalId);
      WebApp.HapticFeedback.notificationOccurred("success");
      onCultCandidatesChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось закрыть");
      onCultCandidatesChange();
    } finally {
      setClosingSignalId(null);
    }
  };

  const openClosedTrade = (trade: CultCandidateClosedSignal) => {
    setClosedTradeDetail(null);
    setClosedTradeError(null);
    setClosedTradeLoading(true);
    void fetchCultCandidateSignal(trade.id)
      .then((s) => {
        setClosedTradeDetail(s);
        setClosedTradeError(null);
      })
      .catch((e) => {
        setClosedTradeError(e instanceof Error ? e.message : "Не удалось загрузить сделку");
      })
      .finally(() => setClosedTradeLoading(false));
  };

  const volnovoi = traders.find((t) => isVolnovoiTrader(t));
  const traderCandidates = useMemo(
    () =>
      traders
        .filter((t) => !isVolnovoiTrader(t))
        .sort((a, b) => b.rating_percent - a.rating_percent),
    [traders],
  );
  const userCandidates = useMemo(
    () => [...cultCandidates].sort((a, b) => b.rating_percent - a.rating_percent),
    [cultCandidates],
  );
  const myCandidate = useMemo(() => userCandidates.find((c) => c.is_me), [userCandidates]);
  const otherUserCandidates = useMemo(
    () => userCandidates.filter((c) => !c.is_me),
    [userCandidates],
  );
  const channelCandidates = useMemo(
    () => [...cultChannels].sort((a, b) => b.rating_percent - a.rating_percent),
    [cultChannels],
  );
  const firedList = useMemo(
    () =>
      [...firedTraders].sort(
        (a, b) =>
          (a.trader_rank?.weekly_pct ?? 0) - (b.trader_rank?.weekly_pct ?? 0) ||
          a.rating_percent - b.rating_percent,
      ),
    [firedTraders],
  );

  const showTradersBlock = Boolean(volnovoi || traderCandidates.length > 0);
  const showCandidatesBlock =
    userCandidates.length > 0 || channelCandidates.length > 0 || isAdmin || myId != null;
  const showFiredBlock = firedList.length > 0;

  if (loading) return <p className="meta">Загрузка…</p>;

  return (
    <>
      {!traders.length && !firedList.length && !userCandidates.length && !cultChannels.length && (
        <p className="meta">{TOP_EMPTY}</p>
      )}

      <p className="meta top-marketplace-intro">{TOP_INTRO}</p>
      <RankGuide />

      {showTradersBlock && (
        <section className="top-cult-block top-cult-block--traders">
          <p className="top-cult-label top-cult-label--traders">{TOP_LABEL_TRADERS}</p>
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
                  isSuperAdmin={isSuperAdmin}
                  rosterPlacement="top"
                  onRosterChange={onRosterChange}
                />
              ))}
            </ol>
          )}
        </section>
      )}

      {showCandidatesBlock && (
        <section className="top-cult-block top-cult-block--candidates">
          <p className="top-cult-label top-cult-label--candidates">{TOP_LABEL_CANDIDATES}</p>
          {myId != null && (
            <CultCandidateJoinPanel onJoined={onCultCandidatesChange} />
          )}
          {(myCandidate || otherUserCandidates.length > 0) && (
            <ol className="top-list top-list--user-candidates">
              {myCandidate && (
                <CultCandidateCard
                  key={`me-${myCandidate.telegram_user_id}`}
                  candidate={myCandidate}
                  onTrade={canPublishCandidate ? () => setSignalModalOpen(true) : undefined}
                  onOpenClosedTrade={openClosedTrade}
                  onCloseAtMarket={handleCloseCandidateAtMarket}
                  closingSignalId={closingSignalId}
                  isSuperAdmin={isSuperAdmin}
                  onRosterChange={onRosterChange}
                />
              )}
              {otherUserCandidates.map((candidate) => (
                <CultCandidateCard
                  key={candidate.telegram_user_id}
                  candidate={candidate}
                  onOpenClosedTrade={openClosedTrade}
                  isSuperAdmin={isSuperAdmin}
                  onRosterChange={onRosterChange}
                />
              ))}
            </ol>
          )}
          {channelCandidates.length > 0 && (
            <ol className="top-list">
              {channelCandidates.map((channel) => (
                <CultChannelCard key={channel.id} channel={channel} />
              ))}
            </ol>
          )}
          {userCandidates.length === 0 && channelCandidates.length === 0 && !isAdmin && (
            <p className="meta">{TOP_CANDIDATES_EMPTY}</p>
          )}
          {isSuperAdmin && <CultChannelAdminPanel channels={cultChannels} onChange={onCultChannelsChange} />}
        </section>
      )}

      <CultCandidateSignalModal
        open={signalModalOpen}
        onClose={() => setSignalModalOpen(false)}
        onCreated={onCultCandidatesChange}
      />

      <CultCandidateSignalDetailModal
        signal={closedTradeDetail}
        loading={closedTradeLoading}
        error={closedTradeError}
        onClose={() => {
          setClosedTradeDetail(null);
          setClosedTradeError(null);
          setClosedTradeLoading(false);
        }}
      />

      {showFiredBlock && (
        <section className="top-cult-block top-cult-block--fired">
          <p className="top-cult-label top-cult-label--fired">{TOP_LABEL_FIRED}</p>
          <ol className="top-list">
            {firedList.map((trader) => (
              <TopTraderCard
                key={trader.telegram_id}
                trader={trader}
                fired
                onOpen={() => setProfileTrader(trader)}
                isSuperAdmin={isSuperAdmin}
                rosterPlacement="fired"
                onRosterChange={onRosterChange}
              />
            ))}
          </ol>
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
