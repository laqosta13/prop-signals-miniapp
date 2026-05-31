import { useEffect, useState } from "react";
import type { Trader, TraderRank } from "../api";
import { activateRankShield, confirmMyRank, fetchTraderRank } from "../api";
import { authorProfile, formatUsd } from "../utils";
import { isVolnovoiTrader, VOLNOVOI_SUBTITLE } from "../utils/volnovoi";
import { rankStyle } from "../utils/ranks";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";
import { VolnovoiMarketingBadge } from "./VolnovoiMarketingBadge";

type Props = {
  trader: Trader;
  isMe: boolean;
  isAdmin: boolean;
  onClose: () => void;
};

export function TraderProfileModal({ trader, isMe, isAdmin, onClose }: Props) {
  const aggregate = isVolnovoiTrader(trader);
  const [rank, setRank] = useState<TraderRank | null>(trader.trader_rank ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (aggregate) {
      setRank(trader.trader_rank ?? null);
      return;
    }
    void fetchTraderRank(trader.telegram_id)
      .then(setRank)
      .catch(() => setRank(trader.trader_rank ?? null));
  }, [aggregate, trader.telegram_id, trader.trader_rank]);

  const st = rank ? rankStyle(rank.current_rank_id) : rankStyle(8);
  const profile = authorProfile(trader.display_name, trader.username);

  const onConfirm = async () => {
    setBusy(true);
    try {
      setRank(await confirmMyRank());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const onShieldClick = () => {
    void (async () => {
      setBusy(true);
      try {
        setRank(await activateRankShield());
      } catch (e) {
        alert(e instanceof Error ? e.message : "Страховка недоступна");
      } finally {
        setBusy(false);
      }
    })();
  };

  const showOwnShield = !aggregate && isMe && isAdmin && rank && !rank.shield_used_this_month;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trader-profile-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="trader-profile-sheet__head">
          <Avatar url={trader.avatar_url} displayName={trader.display_name} username={trader.username} size={56} />
          <div className="trader-profile-sheet__who">
            <div className="trader-profile-sheet__name-row">
              <p className="trader-profile-sheet__name">{profile.title}</p>
              {rank && <RankBadge rank={rank} compact />}
            </div>
            {aggregate && <p className="trader-profile-sheet__sub">{VOLNOVOI_SUBTITLE}</p>}
          </div>
        </div>

        {aggregate && (
          <VolnovoiMarketingBadge trader={trader} className="volnovoi-marketing--profile" />
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

        {rank && (
          <div className="trader-profile-sheet__rank-block" style={{ background: st.bg }}>
            <p className="trader-profile-sheet__weekly">
              Неделя: {rank.weekly_pct >= 0 ? "+" : ""}
              {rank.weekly_pct.toFixed(1)}%
            </p>
            {!aggregate && isMe && !rank.is_confirmed && !rank.rank_applied_this_week && (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void onConfirm()}>
                Подтвердить результат
              </button>
            )}
            {showOwnShield && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={onShieldClick}>
                Страховка
              </button>
            )}
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
                  <span className="rank-history__status">{h.confirmed ? "✓" : "—"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
