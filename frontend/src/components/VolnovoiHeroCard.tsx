import type { Trader } from "../api";
import { useAuthorProfile } from "../hooks/useAuthorProfile";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { traderClosedDealsCount, traderRankAvatarId } from "../utils/traderRankDisplay";
import { Avatar } from "./Avatar";
import { CultCandidateActiveTrades } from "./CultCandidateActiveTrades";
import { EquityCurve } from "./EquityCurve";
import { RankBadge } from "./RankBadge";
import { VolnovoiMarketingBadge } from "./VolnovoiMarketingBadge";

type Props = {
  trader: Trader;
  onOpen: () => void;
};

export function VolnovoiHeroCard({ trader, onOpen }: Props) {
  const copy = useThemedCopy();
  const profile = useAuthorProfile(trader.display_name, trader.username, trader.telegram_id);
  const hasClosedDeals = traderClosedDealsCount(trader) > 0;
  const hasActive = (trader.active_signals?.length ?? 0) > 0;

  return (
    <article className="volnovoi-hero__card">
      <button type="button" className="volnovoi-hero__open" onClick={onOpen}>
        <header className="volnovoi-hero__head">
          <Avatar
            url={trader.avatar_url}
            displayName={trader.display_name}
            username={trader.username}
            telegramId={trader.telegram_id}
            rankId={traderRankAvatarId(trader)}
            size={52}
          />
          <div className="volnovoi-hero__identity">
            <div className="volnovoi-hero__title-row">
              <span className="volnovoi-hero__symbol" aria-hidden>
                ∑
              </span>
              <h2 className="volnovoi-hero__name">{profile.title}</h2>
            </div>
            <p className="volnovoi-hero__tagline">{copy.volnovoiSubtitle}</p>
            <div className="volnovoi-hero__badges">
              {trader.trader_rank ? <RankBadge rank={trader.trader_rank} featured /> : null}
              <VolnovoiMarketingBadge trader={trader} />
            </div>
          </div>
        </header>

        {hasActive && (
          <div className="volnovoi-hero__active">
            <CultCandidateActiveTrades trades={trader.active_signals!} />
          </div>
        )}

        <div className="volnovoi-hero__stats">
          <p className={`volnovoi-hero__rating ${(trader.rating_percent ?? 0) >= 0 ? "up" : "down"}`}>
            {(trader.rating_percent ?? 0) >= 0 ? "+" : ""}
            {(trader.rating_percent ?? 0).toFixed(2)}%
          </p>
          <p className="volnovoi-hero__meta">
            {!hasClosedDeals ? (
              <>
                {trader.trader_rank != null ? "Неделя: +0.0% · " : null}
                W 0 · L 0
              </>
            ) : trader.trader_rank != null ? (
              <>
                Неделя: {trader.trader_rank.weekly_pct >= 0 ? "+" : ""}
                {trader.trader_rank.weekly_pct.toFixed(1)}% · W {trader.wins} · L {trader.losses} · WR{" "}
                {trader.win_rate}%
              </>
            ) : (
              <>W {trader.wins} · L {trader.losses} · WR {trader.win_rate}%</>
            )}
          </p>
        </div>
      </button>

      {(trader.daily_stats?.length ?? 0) > 0 && (
        <div className="volnovoi-hero__chart">
          <EquityCurve dailyStats={trader.daily_stats!} />
        </div>
      )}
    </article>
  );
}
