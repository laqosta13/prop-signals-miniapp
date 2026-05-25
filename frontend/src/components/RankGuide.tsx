import { useState } from "react";
import { RANK_RULES, RANK_TIERS, rankStyle } from "../utils/ranks";

export function RankGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rank-guide">
      <button
        type="button"
        className={`rank-guide__toggle${open ? " rank-guide__toggle--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Описание рангов</span>
        <span className="rank-guide__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="rank-guide__panel">
          <p className="rank-guide__intro">
            Доходность за неделю определяет, в каком диапазоне вы находитесь. Текущий ранг — отдельно, он меняется по
            правилам ниже.
          </p>
          <ul className="rank-guide__tiers">
            {RANK_TIERS.map((tier) => {
              const st = rankStyle(tier.id);
              return (
                <li key={tier.id} className="rank-guide__tier">
                  <span className="rank-guide__tier-pill" style={{ background: st.bg, color: st.color }}>
                    {st.icon && <span className="rank-guide__tier-icon">{st.icon}</span>}
                    {tier.name}
                  </span>
                  <span className="rank-guide__tier-range">{tier.rangeLabel}</span>
                </li>
              );
            })}
          </ul>
          <ul className="rank-guide__rules">
            {RANK_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
