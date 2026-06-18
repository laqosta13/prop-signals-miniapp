import { createPortal } from "react-dom";
import { useAppTheme } from "../hooks/useAppTheme";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { resolveRankName } from "../utils/punkTheme";
import { isPunkTheme } from "../utils/punkTheme";
import {
  RANK_TIERS,
  RANKS_WORST_TO_BEST,
  rankMaxLeverage,
  rankMaxStakePct,
  rankTierExtraClass,
  resolveRankStyle,
} from "../utils/ranks";
import { PunkRankIcon } from "./PunkRankIcon";
import { RankIcon } from "./RankIcon";

type Props = {
  onClose: () => void;
  highlightRankId?: number;
};

function rankQualityIndex(rankId: number): number {
  const idx = RANKS_WORST_TO_BEST.indexOf(rankId as (typeof RANKS_WORST_TO_BEST)[number]);
  return idx < 0 ? 0 : idx;
}

function isRankAboveCurrent(tierId: number, currentRankId: number): boolean {
  return rankQualityIndex(tierId) > rankQualityIndex(currentRankId);
}

export function RankGuideModal({ onClose, highlightRankId }: Props) {
  const theme = useAppTheme();
  const copy = useThemedCopy();
  const punk = isPunkTheme(theme);

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--rank"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-guide-title"
      onClick={onClose}
    >
      <div className={`rank-guide-sheet${copy.punk ? " rank-guide-sheet--punk" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="rank-guide-title">{copy.rankGuideTitle}</h2>
        <p className="rank-guide-sheet__intro">{copy.rankGuideIntro}</p>
        <p className="rank-guide-sheet__pool">{copy.rankGuidePool}</p>
        <ul className="rank-guide__tiers rank-guide__tiers--modal">
          {RANK_TIERS.map((tier) => {
            const st = resolveRankStyle(tier.id, theme);
            const highlighted = highlightRankId === tier.id;
            const locked = highlightRankId != null && isRankAboveCurrent(tier.id, highlightRankId);
            return (
              <li
                key={tier.id}
                className={`rank-guide__tier${rankTierExtraClass(tier.id)}${highlighted ? " rank-guide__tier--current" : ""}${locked ? " rank-guide__tier--locked" : ""}`}
              >
                <span
                  className={`rank-guide__tier-pill${punk ? " rank-guide__tier-pill--punk" : ""}${locked ? " rank-guide__tier-pill--locked" : ""}`}
                  style={locked ? undefined : { background: st.bg, color: st.color }}
                >
                  {!locked && st.iconId &&
                    (punk ? (
                      <PunkRankIcon id={st.iconId} size={18} className="rank-guide__tier-icon" />
                    ) : (
                      <RankIcon id={st.iconId} size={18} className="rank-guide__tier-icon" />
                    ))}
                  {locked ? (
                    <span className="rank-guide__tier-locked-name">🔒 ████████</span>
                  ) : (
                    resolveRankName(tier.id, tier.name, theme)
                  )}
                </span>
                <div className="rank-guide__tier-meta">
                  <span className="rank-guide__tier-range">неделя {tier.rangeLabel}</span>
                  <span className="rank-guide__tier-stake">
                    {tier.maxStakePct}% · {tier.maxLeverage}×
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {highlightRankId != null && (
          <p className="rank-guide-sheet__your-cap">
            Сейчас: <strong>{rankMaxStakePct(highlightRankId)}%</strong> вход ·{" "}
            <strong>{rankMaxLeverage(highlightRankId)}×</strong> плечо.
          </p>
        )}
        <ul className="rank-guide__rules">
          {copy.rankRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <button type="button" className="submit-btn" onClick={onClose}>
          {copy.rankUnderstood}
        </button>
      </div>
    </div>,
    document.body,
  );
}
