import { useState, type MouseEvent } from "react";
import type { TraderRank } from "../api";
import { useAppTheme } from "../hooks/useAppTheme";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { isPunkTheme, resolveRankName } from "../utils/punkTheme";
import { rankPillExtraClass, resolveRankStyle } from "../utils/ranks";
import { PunkRankIcon } from "./PunkRankIcon";
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
  const theme = useAppTheme();
  const copy = useThemedCopy();
  const punk = isPunkTheme(theme);
  const [guideOpen, setGuideOpen] = useState(false);
  const st = resolveRankStyle(rank.current_rank_id, theme);
  const rankName = resolveRankName(rank.current_rank_id, rank.current_rank_name, theme);
  const isCard = !!card;
  const isFeatured = !isCard && (featured ?? !compact);
  const iconSize = isFeatured ? 20 : isCard ? 18 : 16;

  const pill = (
    <span
      className={`rank-badge__pill ${rankPillExtraClass(rank.current_rank_id, isFeatured)}${isCard ? " rank-badge__pill--card" : ""}${punk ? " rank-badge__pill--punk" : ""}`.trim()}
      style={{ background: st.bg, color: st.color }}
    >
      {st.iconId &&
        (punk ? (
          <PunkRankIcon id={st.iconId} size={iconSize} className="rank-badge__icon" />
        ) : (
          <RankIcon id={st.iconId} size={iconSize} className="rank-badge__icon" />
        ))}
      <span className="rank-badge__name">{rankName}</span>
      {rank.shield_active && (
        <span className="rank-badge__shield" title="Страховка">
          🛡
        </span>
      )}
    </span>
  );

  const needsWeeklyConfirm =
    !rank.is_confirmed && !rank.rank_applied_this_week && rank.weekly_pct !== 0;
  const warn = needsWeeklyConfirm ? (
    <span className="rank-badge__warn">
      {rank.pending_rank_penalty ? copy.rankPenaltyWarn : copy.rankConfirmPending}
    </span>
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
      className={`rank-badge rank-badge--btn${isFeatured ? " rank-badge--featured" : ""}${isCard ? " rank-badge--card" : ""}${punk ? " rank-badge--punk" : ""}`}
      onClick={openGuide}
      aria-label={`Ранг ${rankName}. Описание рангов`}
    >
      {pill}
      {warn}
    </button>
  ) : (
    <span className={`rank-badge${isFeatured ? " rank-badge--featured" : ""}${isCard ? " rank-badge--card" : ""}${punk ? " rank-badge--punk" : ""}`}>
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
