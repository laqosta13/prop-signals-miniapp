import { useState, type MouseEvent } from "react";
import type { TraderRank } from "../api";
import { rankPillExtraClass, rankStyle } from "../utils/ranks";
import { RankGuideModal } from "./RankGuideModal";
import { RankIcon } from "./RankIcon";

type Props = {
  rank: TraderRank;
  /** Устарело: используйте featured. */
  compact?: boolean;
  /** Крупный бейдж с акцентной анимацией (ТОП, профиль). */
  featured?: boolean;
  /** Средний бейдж на карточке сигнала. */
  card?: boolean;
  /** Открыть описание рангов по нажатию (по умолчанию true). */
  interactive?: boolean;
};

export function RankBadge({ rank, compact, featured, card, interactive = true }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const st = rankStyle(rank.current_rank_id);
  const isCard = !!card;
  const isFeatured = !isCard && (featured ?? !compact);

  const pill = (
    <span
      className={`rank-badge__pill ${rankPillExtraClass(rank.current_rank_id, isFeatured)}${isCard ? " rank-badge__pill--card" : ""}`.trim()}
      style={{ background: st.bg, color: st.color }}
    >
      {st.iconId && (
        <RankIcon id={st.iconId} size={isFeatured ? 20 : isCard ? 18 : 16} className="rank-badge__icon" />
      )}
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
      className={`rank-badge rank-badge--btn${isFeatured ? " rank-badge--featured" : ""}${isCard ? " rank-badge--card" : ""}`}
      onClick={openGuide}
      aria-label={`Ранг ${rank.current_rank_name}. Описание рангов`}
    >
      {pill}
      {warn}
    </button>
  ) : (
    <span className={`rank-badge${isFeatured ? " rank-badge--featured" : ""}${isCard ? " rank-badge--card" : ""}`}>
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
