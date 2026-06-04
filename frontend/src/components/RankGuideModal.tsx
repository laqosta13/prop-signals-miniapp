import { createPortal } from "react-dom";
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
  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--rank"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-guide-title"
      onClick={onClose}
    >
      <div className="rank-guide-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="rank-guide-title">Система рангов</h2>
        <p className="rank-guide-sheet__intro">Недельный % → ранг. Выше ранг — больше вход и плечо.</p>
        <p className="rank-guide-sheet__pool">
          Пример: 1 трейдер 50%, 2 трейдер 50% в сделке 100% депо. 3 трейдер не может дать сделку.
        </p>
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
                  {tier.name}
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
