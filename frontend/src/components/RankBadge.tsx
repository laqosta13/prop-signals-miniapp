import type { TraderRank } from "../api";
import { rankStyle } from "../utils/ranks";

type Props = {
  rank: TraderRank;
  compact?: boolean;
};

export function RankBadge({ rank, compact }: Props) {
  const st = rankStyle(rank.current_rank_id);
  return (
    <span className={`rank-badge${compact ? " rank-badge--compact" : ""}`}>
      <span
        className="rank-badge__pill"
        style={{ background: st.bg, color: st.color }}
      >
        {st.icon && <span className="rank-badge__icon">{st.icon}</span>}
        {rank.current_rank_name}
        {rank.shield_active && <span className="rank-badge__shield" title="Страховка">🛡</span>}
      </span>
      {rank.pending_rank_penalty && !rank.is_confirmed && (
        <span className="rank-badge__warn">−1 ранг</span>
      )}
    </span>
  );
}
