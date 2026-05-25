import { useEffect, useState } from "react";
import type { Trader, TraderRank } from "../api";
import { activateRankShield, confirmMyRank, fetchTraderRank } from "../api";
import { authorProfile } from "../utils";
import { rankStyle } from "../utils/ranks";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";

type Props = {
  trader: Trader;
  isMe: boolean;
  onClose: () => void;
};

export function TraderProfileModal({ trader, isMe, onClose }: Props) {
  const [rank, setRank] = useState<TraderRank | null>(trader.trader_rank ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTraderRank(trader.telegram_id)
      .then(setRank)
      .catch(() => setRank(trader.trader_rank ?? null));
  }, [trader.telegram_id, trader.trader_rank]);

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

  const onShield = async () => {
    setBusy(true);
    try {
      setRank(await activateRankShield());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Страховка недоступна");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trader-profile-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="trader-profile-sheet__head">
          <Avatar url={trader.avatar_url} displayName={trader.display_name} username={trader.username} size={56} />
          <div>
            <p className="trader-profile-sheet__name">{profile.title}</p>
            {trader.username && <p className="trader-profile-sheet__login">@{trader.username}</p>}
          </div>
        </div>

        {rank && (
          <div className="trader-profile-sheet__rank-block" style={{ background: st.bg }}>
            <RankBadge rank={rank} />
            <p className="trader-profile-sheet__weekly">
              Неделя: {rank.weekly_pct >= 0 ? "+" : ""}
              {rank.weekly_pct.toFixed(1)}%
            </p>
            {isMe && !rank.is_confirmed && !rank.rank_applied_this_week && (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void onConfirm()}>
                Подтвердить результат
              </button>
            )}
            {isMe && !rank.shield_used_this_month && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void onShield()}>
                Активировать страховку
              </button>
            )}
          </div>
        )}

        {rank && rank.rank_history.length > 0 && (
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
