import { createPortal } from "react-dom";
import { useAppTheme } from "../hooks/useAppTheme";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { resolveRankName } from "../utils/punkTheme";
import { isPunkTheme } from "../utils/punkTheme";
import {
  RANK_TIERS,
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
            return (
              <li
                key={tier.id}
                className={`rank-guide__tier${rankTierExtraClass(tier.id)}${highlighted ? " rank-guide__tier--current" : ""}`}
              >
                <span
                  className={`rank-guide__tier-pill${punk ? " rank-guide__tier-pill--punk" : ""}`}
                  style={{ background: st.bg, color: st.color }}
                >
                  {st.iconId &&
                    (punk ? (
                      <PunkRankIcon id={st.iconId} size={18} className="rank-guide__tier-icon" />
                    ) : (
                      <RankIcon id={st.iconId} size={18} className="rank-guide__tier-icon" />
                    ))}
                  {resolveRankName(tier.id, tier.name, theme)}
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
