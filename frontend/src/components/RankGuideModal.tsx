import { createPortal } from "react-dom";
import { RANK_GUIDE_INTRO, RANK_GUIDE_POOL, RANK_GUIDE_TITLE } from "../data/appCopy";
import { useAppTheme } from "../hooks/useAppTheme";
import {
  isPunkTheme,
  PUNK_RANK_GUIDE_INTRO,
  PUNK_RANK_GUIDE_POOL,
  PUNK_RANK_GUIDE_TITLE,
  resolveRankName,
} from "../utils/punkTheme";
import {
  RANK_RULES,
  RANK_TIERS,
  rankMaxLeverage,
  rankMaxStakePct,
  rankStyle,
  rankTierExtraClass,
} from "../utils/ranks";
import { RankIcon } from "./RankIcon";

type Props = {
  onClose: () => void;
  highlightRankId?: number;
};

export function RankGuideModal({ onClose, highlightRankId }: Props) {
  const theme = useAppTheme();
  const punk = isPunkTheme(theme);
  const guideTitle = punk ? PUNK_RANK_GUIDE_TITLE : RANK_GUIDE_TITLE;
  const guideIntro = punk ? PUNK_RANK_GUIDE_INTRO : RANK_GUIDE_INTRO;
  const guidePool = punk ? PUNK_RANK_GUIDE_POOL : RANK_GUIDE_POOL;

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--rank"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-guide-title"
      onClick={onClose}
    >
      <div className={`rank-guide-sheet${punk ? " rank-guide-sheet--punk" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="rank-guide-title">{guideTitle}</h2>
        <p className="rank-guide-sheet__intro">{guideIntro}</p>
        <p className="rank-guide-sheet__pool">{guidePool}</p>
        <ul className="rank-guide__tiers rank-guide__tiers--modal">
          {RANK_TIERS.map((tier) => {
            const st = rankStyle(tier.id);
            const highlighted = highlightRankId === tier.id;
            return (
              <li
                key={tier.id}
                className={`rank-guide__tier${rankTierExtraClass(tier.id)}${highlighted ? " rank-guide__tier--current" : ""}`}
              >
                <span className="rank-guide__tier-pill" style={{ background: st.bg, color: st.color }}>
                  {st.iconId && <RankIcon id={st.iconId} size={18} className="rank-guide__tier-icon" />}
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
          {RANK_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <button type="button" className="submit-btn" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>,
    document.body,
  );
}
