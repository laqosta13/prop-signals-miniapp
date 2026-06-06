import { useState } from "react";
import type { CultCandidate, CultCandidateClosedSignal } from "../api";
import { authorProfile } from "../utils";
import { Avatar } from "./Avatar";
import { CultCandidateActiveTrades } from "./CultCandidateActiveTrades";
import { CultCandidateClosedTrades } from "./CultCandidateClosedTrades";
import { EquityCurve } from "./EquityCurve";
import { RankBadge } from "./RankBadge";
import { TraderRosterActions } from "./TraderRosterActions";

type Props = {
  candidate: CultCandidate;
  onTrade?: () => void;
  onOpenClosedTrade?: (trade: CultCandidateClosedSignal) => void;
  onCloseAtMarket?: (signalId: number) => void;
  closingSignalId?: number | null;
  isSuperAdmin?: boolean;
  onRosterChange?: () => void;
};

export function CultCandidateCard({
  candidate,
  onTrade,
  onOpenClosedTrade,
  onCloseAtMarket,
  closingSignalId = null,
  isSuperAdmin = false,
  onRosterChange,
}: Props) {
  const [opened, setOpened] = useState(false);
  const expanded = candidate.is_me || opened;
  const activeCount = candidate.active_signals.length;
  const closedCount = candidate.closed_signals?.length ?? 0;
  const tradesHint =
    activeCount + closedCount > 0
      ? `${activeCount > 0 ? `${activeCount} акт.` : ""}${activeCount > 0 && closedCount > 0 ? " · " : ""}${closedCount > 0 ? `${closedCount} закр.` : ""}`
      : null;

  const headContent = (
    <div className="top-card__head">
      <span className="top-rank top-rank--candidate">#{candidate.rank}</span>
      <Avatar
        url={candidate.avatar_url}
        displayName={candidate.display_name}
        username={candidate.username}
        size={44}
      />
      <div className="top-body">
        <div className="top-name-row">
          <p className="top-name">{authorProfile(candidate.display_name, candidate.username).title}</p>
          {candidate.trader_rank && <RankBadge rank={candidate.trader_rank} featured />}
          {!expanded && tradesHint && <span className="top-card__trades-hint">{tradesHint}</span>}
          {!candidate.is_me && (
            <span className="top-card__chevron" aria-hidden>
              {expanded ? "▴" : "▾"}
            </span>
          )}
        </div>
        <p className={`top-score ${candidate.rating_percent >= 0 ? "up" : "down"}`}>
          {candidate.rating_percent >= 0 ? "+" : ""}
          {candidate.rating_percent.toFixed(2)}%
        </p>
        <p className="top-meta">
          W {candidate.wins} · L {candidate.losses} · WR {candidate.win_rate}%
        </p>
      </div>
    </div>
  );

  return (
    <li className={candidate.is_me ? "top-list__item--me" : undefined}>
      <div
        className={`top-card top-card--candidate${candidate.is_me ? " top-card--candidate-me" : ""}${expanded ? " top-card--candidate-expanded" : " top-card--candidate-collapsed"}`}
      >
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

        {expanded && candidate.active_signals.length > 0 && (
          <CultCandidateActiveTrades
            trades={candidate.active_signals}
            canClose={candidate.is_me}
            closingId={closingSignalId}
            onCloseAtMarket={onCloseAtMarket}
          />
        )}

        {expanded && (candidate.closed_signals?.length ?? 0) > 0 && onOpenClosedTrade && (
          <CultCandidateClosedTrades trades={candidate.closed_signals ?? []} onOpen={onOpenClosedTrade} />
        )}

        {expanded && candidate.daily_stats.length > 0 && (
          <EquityCurve dailyStats={candidate.daily_stats} percentOnly showDayList />
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
