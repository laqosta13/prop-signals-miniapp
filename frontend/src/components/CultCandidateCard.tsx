import type { CultCandidate, CultCandidateClosedSignal } from "../api";
import { Avatar } from "./Avatar";
import { CultCandidateClosedTrades } from "./CultCandidateClosedTrades";
import { EquityCurve } from "./EquityCurve";

type Props = {
  candidate: CultCandidate;
  onTrade?: () => void;
  onOpenClosedTrade?: (trade: CultCandidateClosedSignal) => void;
};

export function CultCandidateCard({ candidate, onTrade, onOpenClosedTrade }: Props) {
  const dirLabel = (d: string) => (d.toLowerCase() === "long" ? "LONG" : "SHORT");

  return (
    <li className={candidate.is_me ? "top-list__item--me" : undefined}>
      <div className={`top-card top-card--candidate${candidate.is_me ? " top-card--candidate-me" : ""}`}>
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
              <p className="top-name">{candidate.display_name}</p>
            </div>
            {candidate.username && <p className="top-aggregate-hint">@{candidate.username}</p>}
            <p className={`top-score ${candidate.rating_percent >= 0 ? "up" : "down"}`}>
              {candidate.rating_percent >= 0 ? "+" : ""}
              {candidate.rating_percent.toFixed(2)}%
            </p>
            <p className="top-meta">
              W {candidate.wins} · L {candidate.losses} · WR {candidate.win_rate}%
            </p>
          </div>
        </div>

        {candidate.active_signals.length > 0 && (
          <ul className="cult-candidate-trades">
            {candidate.active_signals.map((s) => (
              <li key={s.id} className="cult-candidate-trades__row">
                <span className="cult-candidate-trades__sym">{s.symbol}</span>
                <span className="cult-candidate-trades__dir">{dirLabel(s.direction)}</span>
                <span className="cult-candidate-trades__entry">вход {s.entry}</span>
                <span className="cult-candidate-trades__level">{s.level_label}</span>
                <span className="cult-candidate-trades__pct">{s.stake_percent}%</span>
              </li>
            ))}
          </ul>
        )}

        {(candidate.closed_signals?.length ?? 0) > 0 && onOpenClosedTrade && (
          <CultCandidateClosedTrades trades={candidate.closed_signals ?? []} onOpen={onOpenClosedTrade} />
        )}

        {candidate.daily_stats.length > 0 && (
          <EquityCurve dailyStats={candidate.daily_stats} percentOnly showDayList />
        )}

        {candidate.is_me && onTrade && (
          <button type="button" className="btn-primary cult-candidate-trade-btn" onClick={onTrade}>
            + Сделка
          </button>
        )}
      </div>
    </li>
  );
}
