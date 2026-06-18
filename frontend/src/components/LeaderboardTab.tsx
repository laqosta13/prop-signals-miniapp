import { useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  closeCultCandidateSignalAtMarket,
  fetchCultCandidateSignal,
  fetchPoolStats,
  type CultCandidate,
  type CultCandidateClosedSignal,
  type CultChannel,
  type Signal,
  type Trader,
} from "../api";

function fmtShare(v: number): string {
  return "$" + Math.round(v).toLocaleString("ru-RU");
}
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
import { VolnovoiHeroCard } from "./VolnovoiHeroCard";
import { VolnovoiStylePanel } from "./VolnovoiStylePanel";
import { useAuthorProfile } from "../hooks/useAuthorProfile";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { shouldShowTraderRankBadge, traderClosedDealsCount, traderRankAvatarId } from "../utils/traderRankDisplay";
import { canViewActiveSignals, canViewCandidateActiveTrades } from "../utils/signalActions";
import { isVolnovoiTrader } from "../utils/volnovoi";
import { Avatar } from "./Avatar";
import { TopPlaceMedal } from "./TopPlaceMedal";

type Props = {
  traders: Trader[];
  firedTraders: Trader[];
  rosterDemotedAdmins: Trader[];
  cultCandidates: CultCandidate[];
  canPublishCandidate: boolean;
  cultChannels: CultChannel[];
  loading: boolean;
  myId: number | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  subscriptionActive: boolean;
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
  onTrade,
}: {
  trader: Trader;
  onOpen: () => void;
  fired?: boolean;
  isSuperAdmin?: boolean;
  rosterPlacement?: TraderRosterPlacement;
  onRosterChange?: () => void;
  onTrade?: () => void;
}) {
  const profile = useAuthorProfile(trader.display_name, trader.username, trader.telegram_id);
  const showRankBadge = shouldShowTraderRankBadge(trader);
  const hasClosedDeals = traderClosedDealsCount(trader) > 0;
  const topChip = !fired && trader.rank >= 1 && trader.rank <= 3;

  const poolShare = !fired ? (trader.pool_share_usd ?? 0) : 0;

  return (
    <li>
      <div className={`top-card${fired ? " top-card--fired" : ""}`}>
        {poolShare > 0 && (
          <div className="pool-share-badge">
            <span className="pool-share-badge__label">нед.</span>
            <span className="pool-share-badge__value">{fmtShare(poolShare)}</span>
          </div>
        )}
        <button type="button" className="top-card__head-btn" onClick={onOpen}>
          <div className="top-card__head">
            <Avatar
              url={trader.avatar_url}
              displayName={trader.display_name}
              username={trader.username}
              telegramId={trader.telegram_id}
              rankId={traderRankAvatarId(trader)}
              size={44}
            />
            <div className="top-body">
              <div className="top-name-row top-name-row--stacked">
                <div className="top-name-line">
                  {topChip ? (
                    <TopPlaceMedal place={trader.rank as 1 | 2 | 3} />
                  ) : (
                    <span className={`top-rank-inline${fired ? " top-rank-inline--fired" : ""}`}>
                      {fired ? "—" : `#${trader.rank}`}
                    </span>
                  )}
                  <p className="top-name">{profile.title}</p>
                </div>
                {showRankBadge && trader.trader_rank && (
                  <div className="top-trader-rank">
                    <RankBadge rank={trader.trader_rank} featured />
                  </div>
                )}
              </div>
              <p className={`top-score ${trader.rating_percent >= 0 ? "up" : "down"}`}>
                {trader.rating_percent >= 0 ? "+" : ""}
                {trader.rating_percent.toFixed(2)}%
              </p>
              <p className="top-meta">
                {!hasClosedDeals ? (
                  <>
                    {trader.trader_rank != null ? "Неделя: +0.0% · " : null}
                    W 0 · L 0
                  </>
                ) : trader.trader_rank != null ? (
                  <>
                    Неделя: {trader.trader_rank.weekly_pct >= 0 ? "+" : ""}
                    {trader.trader_rank.weekly_pct.toFixed(1)}%
                    {fired ? (
                      <>
                        {" "}
                        · минус. подряд:{" "}
                        {trader.trader_rank.consecutive_loss_weeks >= 2
                          ? trader.trader_rank.consecutive_loss_weeks
                          : trader.trader_rank.consecutive_loss_weeks +
                            (trader.trader_rank.weekly_pct < 0 ? 1 : 0)}
                      </>
                    ) : null}
                    {" · "}W {trader.wins} · L {trader.losses}
                    {!fired ? <> · WR {trader.win_rate}%</> : null}
                  </>
                ) : (
                  <>W {trader.wins} · L {trader.losses} · WR {trader.win_rate}%</>
                )}
              </p>
            </div>
          </div>
        </button>

        {trader.volnovoi_style && <VolnovoiStylePanel style={trader.volnovoi_style} />}

        {trader.daily_stats.length > 0 && <EquityCurve dailyStats={trader.daily_stats} />}

        {isSuperAdmin && rosterPlacement && onRosterChange && (
          <TraderRosterActions
            telegramId={trader.telegram_id}
            placement={rosterPlacement}
            onChanged={onRosterChange}
          />
        )}
        {onTrade && (
          <button type="button" className="btn-primary cult-candidate-trade-btn" onClick={onTrade}>
            Опубликовать сделку
          </button>
        )}
      </div>
    </li>
  );
}

export function LeaderboardTab({
  traders,
  firedTraders,
  rosterDemotedAdmins,
  cultCandidates,
  canPublishCandidate,
  cultChannels,
  loading,
  myId,
  isAdmin,
  isSuperAdmin,
  subscriptionActive,
  onCultChannelsChange,
  onCultCandidatesChange,
  onRosterChange,
}: Props) {
  const copy = useThemedCopy();
  const [poolBalance, setPoolBalance] = useState<number | undefined>(undefined);
  const [profileTrader, setProfileTrader] = useState<Trader | null>(null);
  const [signalModalOpen, setSignalModalOpen] = useState(false);

  useEffect(() => {
    fetchPoolStats()
      .then((s) => setPoolBalance(s.balance))
      .catch(() => {});
  }, []);
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
  const myCandidate = useMemo(() => cultCandidates.find((c) => c.is_me), [cultCandidates]);
  const myRankId = useMemo(() => {
    const myTrader = traders.find((t) => t.telegram_id === myId);
    return (
      myTrader?.trader_rank?.current_rank_id ??
      myCandidate?.trader_rank?.current_rank_id
    );
  }, [traders, myId, myCandidate]);
  const otherCandidates = useMemo(
    () => [...cultCandidates].filter((c) => !c.is_me).sort((a, b) => a.rank - b.rank),
    [cultCandidates],
  );
  const cultCandidateIds = useMemo(
    () => new Set(cultCandidates.map((c) => c.telegram_user_id)),
    [cultCandidates],
  );
  const visibleDemotedAdmins = useMemo(
    () => rosterDemotedAdmins.filter((t) => !cultCandidateIds.has(t.telegram_id)),
    [rosterDemotedAdmins, cultCandidateIds],
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

  const showTradersBlock = traderCandidates.length > 0;
  const showCandidatesBlock =
    cultCandidates.length > 0 || channelCandidates.length > 0 || rosterDemotedAdmins.length > 0 || isAdmin || myId != null;
  const showFiredBlock = firedList.length > 0;

  const showVolnovoiActiveTrades = canViewActiveSignals(subscriptionActive, isAdmin);

  if (loading) return <p className="meta">{copy.loading}</p>;

  return (
    <>
      {!traders.length && !firedList.length && !cultCandidates.length && !cultChannels.length && (
        <p className="meta">{copy.topEmpty}</p>
      )}

      <p className="meta top-marketplace-intro">{copy.topIntro}</p>

      {volnovoi && (
        <section className="volnovoi-hero" aria-label="volnovoi">
          <VolnovoiHeroCard
            trader={volnovoi}
            onOpen={() => setProfileTrader(volnovoi)}
            showActiveTrades={showVolnovoiActiveTrades}
            poolBalance={poolBalance}
          />
          <VolnovoiCopyPanel />
        </section>
      )}

      <RankGuide myRankId={myRankId} />

      {showTradersBlock && (
        <section className="top-cult-block top-cult-block--traders">
          <p className="top-cult-label top-cult-label--traders">{copy.topLabelTraders}</p>
          <ol className="top-list">
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
        </section>
      )}

      {showCandidatesBlock && (
        <section className="top-cult-block top-cult-block--candidates">
          <p className="top-cult-label top-cult-label--candidates">{copy.topLabelCandidates}</p>
          {myId != null && (
            <CultCandidateJoinPanel onJoined={onCultCandidatesChange} />
          )}
          {(myCandidate || otherCandidates.length > 0) && (
            <ol className="top-list top-list--user-candidates">
              {myCandidate && (
                <CultCandidateCard
                  key={`me-${myCandidate.telegram_user_id}`}
                  candidate={myCandidate}
                  showActiveTrades={canViewCandidateActiveTrades(subscriptionActive, isAdmin, true)}
                  onTrade={canPublishCandidate ? () => setSignalModalOpen(true) : undefined}
                  onOpenClosedTrade={openClosedTrade}
                  onCloseAtMarket={handleCloseCandidateAtMarket}
                  closingSignalId={closingSignalId}
                  isSuperAdmin={isSuperAdmin}
                  onRosterChange={onRosterChange}
                />
              )}
              {otherCandidates.map((candidate) => (
                <CultCandidateCard
                  key={candidate.telegram_user_id}
                  candidate={candidate}
                  showActiveTrades={canViewCandidateActiveTrades(subscriptionActive, isAdmin, false)}
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
          {visibleDemotedAdmins.length > 0 && (
            <ol className="top-list">
              {visibleDemotedAdmins.map((trader) => (
                <TopTraderCard
                  key={trader.telegram_id}
                  trader={trader}
                  onOpen={() => setProfileTrader(trader)}
                  isSuperAdmin={isSuperAdmin}
                  rosterPlacement="candidate"
                  onRosterChange={onRosterChange}
                  onTrade={
                    trader.telegram_id === myId && canPublishCandidate
                      ? () => setSignalModalOpen(true)
                      : undefined
                  }
                />
              ))}
            </ol>
          )}
          {cultCandidates.length === 0 && channelCandidates.length === 0 && rosterDemotedAdmins.length === 0 && !isAdmin && (
            <p className="meta">{copy.topCandidatesEmpty}</p>
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
          <p className="top-cult-label top-cult-label--fired">{copy.topLabelFired}</p>
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
          showActiveTrades={
            isVolnovoiTrader(profileTrader)
              ? showVolnovoiActiveTrades
              : canViewCandidateActiveTrades(subscriptionActive, isAdmin, myId === profileTrader.telegram_id)
          }
          onClose={() => setProfileTrader(null)}
        />
      )}
    </>
  );
}
