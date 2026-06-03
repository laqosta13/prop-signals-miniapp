import { useState, type MouseEvent } from "react";
import type { TraderRank } from "../api";
import { rankStyle } from "../utils/ranks";
import { RankGuideModal } from "./RankGuideModal";

type Props = {
  rank: TraderRank;
  /** Устарело: используйте featured. */
  compact?: boolean;
  /** Крупный бейдж с акцентной анимацией (ТОП, профиль). */
  featured?: boolean;
  /** Открыть описание рангов по нажатию (по умолчанию true). */
  interactive?: boolean;
};

export function RankBadge({ rank, compact, featured, interactive = true }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const st = rankStyle(rank.current_rank_id);
  const isFeatured = featured ?? !compact;

  const pill = (
    <span
      className={`rank-badge__pill${isFeatured ? " rank-badge__pill--featured" : ""}`}
      style={{ background: st.bg, color: st.color }}
    >
      {st.icon && <span className="rank-badge__icon">{st.icon}</span>}
      <span className="rank-badge__name">{rank.current_rank_name}</span>
      {rank.shield_active && (
        <span className="rank-badge__shield" title="Страховка">
          🛡
        </span>
      )}
    </span>
  );

  const warn =
    rank.pending_rank_penalty && !rank.is_confirmed ? (
      <span className="rank-badge__warn">−1 ранг</span>
    ) : null;

  const openGuide = (e: MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    setGuideOpen(true);
  };

  const body = interactive ? (
    <button
      type="button"
      className={`rank-badge rank-badge--btn${isFeatured ? " rank-badge--featured" : ""}`}
      onClick={openGuide}
      aria-label={`Ранг ${rank.current_rank_name}. Описание рангов`}
    >
      {pill}
      {warn}
    </button>
  ) : (
    <span className={`rank-badge${isFeatured ? " rank-badge--featured" : ""}`}>
      {pill}
      {warn}
    </span>
  );

  return (
    <>
      {body}
      {guideOpen && (
        <RankGuideModal
          highlightRankId={rank.current_rank_id}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </>
  );
}
