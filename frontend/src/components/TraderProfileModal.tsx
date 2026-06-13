import { useEffect, useState } from "react";
import type { Trader, TraderRank } from "../api";
import { fetchTraderRank } from "../api";
import { useAuthorProfile } from "../hooks/useAuthorProfile";
import { formatUsd } from "../utils";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { isVolnovoiTrader } from "../utils/volnovoi";
import { shouldShowTraderRankBadge, traderClosedDealsCount, traderRankAvatarId } from "../utils/traderRankDisplay";
import { useAppTheme } from "../hooks/useAppTheme";
import { resolveRankStyle } from "../utils/ranks";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";
import { VolnovoiMarketingBadge } from "./VolnovoiMarketingBadge";
import { VolnovoiStylePanel } from "./VolnovoiStylePanel";
import { CultCandidateActiveTrades } from "./CultCandidateActiveTrades";

type Props = {
  trader: Trader;
  isMe: boolean;
  isAdmin: boolean;
  showActiveTrades?: boolean;
  onClose: () => void;
};

export function TraderProfileModal({ trader, onClose, showActiveTrades = false }: Props) {
  const theme = useAppTheme();
  const copy = useThemedCopy();
  const aggregate = isVolnovoiTrader(trader);
  const showRankBadge = shouldShowTraderRankBadge(trader);
  const hasClosedDeals = traderClosedDealsCount(trader) > 0;
  const [rank, setRank] = useState<TraderRank | null>(trader.trader_rank ?? null);

  useEffect(() => {
    if (aggregate) {
      setRank(trader.trader_rank ?? null);
      return;
    }
    void fetchTraderRank(trader.telegram_id)
      .then(setRank)
      .catch(() => setRank(trader.trader_rank ?? null));
  }, [aggregate, trader.telegram_id, trader.trader_rank]);

  const st = resolveRankStyle(rank?.current_rank_id ?? 7, theme);
  const profile = useAuthorProfile(trader.display_name, trader.username, trader.telegram_id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trader-profile-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="trader-profile-sheet__head">
          <Avatar
            url={trader.avatar_url}
            displayName={trader.display_name}
            username={trader.username}
            telegramId={trader.telegram_id}
            rankId={traderRankAvatarId(trader)}
            size={56}
          />
          <div className="trader-profile-sheet__who">
            <div className="trader-profile-sheet__name-row">
              <p className="trader-profile-sheet__name">{profile.title}</p>
            </div>
            {showRankBadge && rank && (
              <div className="trader-profile-sheet__rank">
                <RankBadge rank={rank} featured />
              </div>
            )}
            {aggregate && <p className="trader-profile-sheet__sub trader-profile-sheet__sub--volnovoi">{copy.volnovoiSubtitle}</p>}
          </div>
        </div>

        {aggregate && (
          <VolnovoiMarketingBadge trader={trader} className="volnovoi-marketing--profile" />
        )}

        {aggregate && showActiveTrades && (trader.active_signals?.length ?? 0) > 0 && (
          <CultCandidateActiveTrades trades={trader.active_signals!} />
        )}

        {!aggregate && trader.volnovoi_style && (
          <VolnovoiStylePanel style={trader.volnovoi_style} />
        )}

        {aggregate && (
          <div className="trader-profile-sheet__stats">
            <p>
              Рейтинг{" "}
              <strong className={trader.rating_percent >= 0 ? "up" : "down"}>
                {trader.rating_percent >= 0 ? "+" : ""}
                {trader.rating_percent.toFixed(2)}%
              </strong>
            </p>
            <p>
              P/L{" "}
              <strong className={trader.total_pnl_usd >= 0 ? "up" : "down"}>{formatUsd(trader.total_pnl_usd)}</strong>
            </p>
            <p>
              W {trader.wins} · L {trader.losses} · WR {trader.win_rate}%
            </p>
          </div>
        )}

        {!aggregate && !hasClosedDeals && (
          <p className="trader-profile-sheet__rank-pending meta">{copy.rankAfterFirstClose}</p>
        )}

        {showRankBadge && rank && (
          <div className="trader-profile-sheet__rank-block" style={{ background: st.bg }}>
            <p className="trader-profile-sheet__weekly">
              Неделя: {rank.weekly_pct >= 0 ? "+" : ""}
              {rank.weekly_pct.toFixed(1)}%
            </p>
          </div>
        )}

        {rank && !aggregate && rank.rank_history.length > 0 && (
          <section className="rank-history">
            <h3>История рангов</h3>
            <ul>
              {rank.rank_history.slice(0, 5).map((h, i) => (
                <li key={`${h.week_label}-${i}`}>
                  <span>{h.week_label}</span>
                  <span className={h.weekly_pct >= 0 ? "pnl-win" : "pnl-lose"}>
                    {h.weekly_pct >= 0 ? "+" : ""}
                    {h.weekly_pct.toFixed(1)}%
                  </span>
                  <span>{h.rank_name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
