import { useState } from "react";
import type { CultCandidate, CultCandidateClosedSignal } from "../api";
import { formatUsd } from "../utils";
import { useAuthorProfile } from "../hooks/useAuthorProfile";
import { Avatar } from "./Avatar";
import { CultCandidateActiveTrades } from "./CultCandidateActiveTrades";
import { CultCandidateClosedTrades } from "./CultCandidateClosedTrades";
import { EquityCurve } from "./EquityCurve";
import { RankBadge } from "./RankBadge";
import { TopPlaceMedal } from "./TopPlaceMedal";
import { TraderRosterActions } from "./TraderRosterActions";
import { VolnovoiStylePanel } from "./VolnovoiStylePanel";

type Props = {
  candidate: CultCandidate;
  showActiveTrades?: boolean;
  onTrade?: () => void;
  onOpenClosedTrade?: (trade: CultCandidateClosedSignal) => void;
  onCloseAtMarket?: (signalId: number) => void;
  onEditSignal?: (signalId: number) => void;
  onDeleteSignal?: (signalId: number) => void;
  closingSignalId?: number | null;
  isSuperAdmin?: boolean;
  onRosterChange?: () => void;
};

export function CultCandidateCard({
  candidate,
  showActiveTrades = false,
  onTrade,
  onOpenClosedTrade,
  onCloseAtMarket,
  onEditSignal,
  onDeleteSignal,
  closingSignalId = null,
  isSuperAdmin = false,
  onRosterChange,
}: Props) {
  const profile = useAuthorProfile(candidate.display_name, candidate.username, candidate.telegram_user_id);
  const [opened, setOpened] = useState(false);
  const expanded = candidate.is_me || opened;
  const activeCount = candidate.active_signals.length;
  const closedCount = candidate.closed_signals?.length ?? 0;
  const topPlace = candidate.rank >= 1 && candidate.rank <= 3 ? (candidate.rank as 1 | 2 | 3) : null;
  const showTradePills =
    !expanded && ((showActiveTrades && activeCount > 0) || closedCount > 0);

  const headContent = (
    <div className="top-card__head">
      <Avatar
        url={candidate.avatar_url}
        displayName={candidate.display_name}
        username={candidate.username}
        telegramId={candidate.telegram_user_id}
        rankId={
          candidate.trader_rank && candidate.wins + candidate.losses > 0
            ? candidate.trader_rank.current_rank_id
            : undefined
        }
        size={44}
      />
      <div className="top-body">
        <div className="top-name-row">
          <div className="top-name-line">
            {topPlace ? (
              <TopPlaceMedal place={topPlace} />
            ) : (
              <span className="top-rank-plain">{candidate.rank}</span>
            )}
            <p className="top-name">{profile.title}</p>
            {candidate.outside_trade && (
              <span className="outside-trade-badge">ЛУДКА</span>
            )}
          </div>
          {!candidate.is_me && (
            <span className="top-card__chevron" aria-hidden>
              {expanded ? "▴" : "▾"}
            </span>
          )}
        </div>
        {(candidate.trader_rank || showTradePills) && (
          <div className="top-candidate-meta">
            {candidate.trader_rank && candidate.wins + candidate.losses > 0 && (
              <RankBadge rank={candidate.trader_rank} card />
            )}
            {showTradePills && (
              <div className="candidate-trades-pills">
                {showActiveTrades && activeCount > 0 && (
                  <span className="candidate-trades-pill candidate-trades-pill--active">
                    <span className="candidate-trades-pill__dot" aria-hidden />
                    {activeCount} в игре
                  </span>
                )}
                {closedCount > 0 && (
                  <span className="candidate-trades-pill candidate-trades-pill--closed">
                    <span className="candidate-trades-pill__dot" aria-hidden />
                    {closedCount} закр.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        <p className={`top-score ${candidate.rating_percent >= 0 ? "up" : "down"}`}>
          {candidate.rating_percent >= 0 ? "+" : ""}
          {candidate.rating_percent.toFixed(2)}%
        </p>
        <p className="top-meta">
          <span className="top-meta__w">W {candidate.wins}</span>
          {" · "}
          <span className="top-meta__l">L {candidate.losses}</span>
          {" · "}WR {candidate.win_rate}%
        </p>
      </div>
    </div>
  );

  const poolShare = candidate.pool_share_usd ?? 0;

  return (
    <li className={candidate.is_me ? "top-list__item--me" : undefined}>
      <div
        className={`top-card top-card--candidate${candidate.is_me ? " top-card--candidate-me" : ""}${expanded ? " top-card--candidate-expanded" : " top-card--candidate-collapsed"}`}
      >
        {topPlace != null && poolShare > 0 && (
          <div className="pool-share-badge">
            <span className="pool-share-badge__label">нед.</span>
            <span className="pool-share-badge__value">{formatUsd(poolShare)}</span>
          </div>
        )}
        {candidate.is_me ? (
          headContent
        ) : (
          <button
            type="button"
            className="top-card__head-btn top-card__head-btn--candidate"
            aria-expanded={expanded}
            onClick={() => setOpened((v) => !v)}
          >
            {headContent}
          </button>
        )}

        {candidate.volnovoi_style && (
          <VolnovoiStylePanel style={candidate.volnovoi_style} stopPropagation />
        )}

        {candidate.daily_stats.length > 0 && (
          <EquityCurve dailyStats={candidate.daily_stats} />
        )}

        {expanded && showActiveTrades && candidate.active_signals.length > 0 && (
          <CultCandidateActiveTrades
            trades={candidate.active_signals}
            showDetails
            canClose={candidate.is_me}
            canEdit={candidate.is_me}
            closingId={closingSignalId}
            onCloseAtMarket={onCloseAtMarket}
            onEdit={onEditSignal}
            onDelete={onDeleteSignal}
          />
        )}

        {expanded && (candidate.closed_signals?.length ?? 0) > 0 && onOpenClosedTrade && (
          <CultCandidateClosedTrades trades={candidate.closed_signals ?? []} onOpen={onOpenClosedTrade} />
        )}

        {expanded && candidate.is_me && candidate.bybit_balance_usd != null && (
          <p className="cult-candidate-bybit-balance">
            Bybit USDT: <strong>${candidate.bybit_balance_usd.toFixed(2)}</strong>
          </p>
        )}

        {expanded && candidate.is_me && onTrade && (
          <button type="button" className="btn-primary cult-candidate-trade-btn" onClick={onTrade}>
            + Сделка
          </button>
        )}

        {expanded && isSuperAdmin && onRosterChange && (
          <TraderRosterActions
            telegramId={candidate.telegram_user_id}
            placement="candidate"
            onChanged={onRosterChange}
          />
        )}
      </div>
    </li>
  );
}
