import { useState } from "react";
import type { VolnovoiStyle } from "../api";

type Props = {
  style: VolnovoiStyle | null | undefined;
  /** Не разворачивать кликом по всей карточке (кандидаты). */
  stopPropagation?: boolean;
};

export function VolnovoiStylePanel({ style, stopPropagation = false }: Props) {
  const [open, setOpen] = useState(false);

  if (!style) return null;

  const toggle = () => setOpen((v) => !v);

  return (
    <div className={`volnovoi-style${open ? " volnovoi-style--open" : ""}`}>
      <button
        type="button"
        className="volnovoi-style__toggle"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          toggle();
        }}
        aria-expanded={open}
      >
        <span className="volnovoi-style__label">Стиль volnovoi</span>
        {style.ready ? (
          <span className="volnovoi-style__headline">{style.headline}</span>
        ) : (
          <span className="volnovoi-style__headline volnovoi-style__headline--muted">качается</span>
        )}
        <span className="volnovoi-style__chevron" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="volnovoi-style__body">
          <p className="volnovoi-style__desc">{style.description}</p>
          {style.stats_line ? <p className="volnovoi-style__stats">{style.stats_line}</p> : null}
        </div>
      )}
    </div>
  );
}
