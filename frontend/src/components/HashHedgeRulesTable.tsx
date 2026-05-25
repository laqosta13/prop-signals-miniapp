import { useState } from "react";
import type { HashHedgeRules } from "../api";

type Props = {
  rules: HashHedgeRules | null;
  loading?: boolean;
};

export function HashHedgeRulesTable({ rules, loading }: Props) {
  const [openHint, setOpenHint] = useState<string | null>(null);

  if (loading) return <p className="meta hashhedge-rules__loading">Загрузка правил…</p>;
  if (!rules) return null;

  const toggleHint = (id: string) => setOpenHint((cur) => (cur === id ? null : id));

  return (
    <section className="hashhedge-rules">
      <div className="hashhedge-rules__table" role="table" aria-label="Правила Hash Hedge">
        <div className="hashhedge-rules__row hashhedge-rules__row--head" role="row">
          <div className="hashhedge-rules__cell hashhedge-rules__cell--label" role="columnheader">
            <span className="hashhedge-rules__brand">
              <span className="hashhedge-rules__logo" aria-hidden>
                ◆
              </span>
              HASH HEDGE
            </span>
          </div>
          {rules.stages.map((s) => (
            <div key={s.stage} className="hashhedge-rules__cell hashhedge-rules__cell--stage" role="columnheader">
              ЭТАП {s.stage}
            </div>
          ))}
        </div>

        {rules.table_rows.map((row) => (
          <div key={row.id} className="hashhedge-rules__row-group">
            <div className="hashhedge-rules__row" role="row">
              <div className="hashhedge-rules__cell hashhedge-rules__cell--label" role="rowheader">
                <button
                  type="button"
                  className="hashhedge-rules__info"
                  aria-expanded={openHint === row.id}
                  aria-label={`Подсказка: ${row.label}`}
                  onClick={() => toggleHint(row.id)}
                >
                  ?
                </button>
                <span>{row.label}</span>
              </div>
              {row.values.map((val, i) => (
                <div key={`${row.id}-${i}`} className="hashhedge-rules__cell hashhedge-rules__cell--val" role="cell">
                  {val}
                </div>
              ))}
            </div>
            {openHint === row.id && (
              <p className="hashhedge-rules__hint">{row.hint}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
