import { useLayoutEffect, useRef, useState } from "react";
import type { VolnovoiStyle } from "../api";

type Props = {
  style: VolnovoiStyle | null | undefined;
  /** Не разворачивать кликом по всей карточке (кандидаты). */
  stopPropagation?: boolean;
};

function StyleHeadline({ text }: { text: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [marquee, setMarquee] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;

    const check = () => {
      setMarquee(measure.scrollWidth > wrap.clientWidth + 1);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span
      ref={wrapRef}
      className={`volnovoi-style__headline${marquee ? " volnovoi-style__headline--marquee" : ""}`}
    >
      <span ref={measureRef} className="volnovoi-style__headline-measure" aria-hidden>
        {text}
      </span>
      {marquee ? (
        <span className="volnovoi-style__marquee-track" aria-hidden>
          <span className="volnovoi-style__marquee-chunk">{text}</span>
          <span className="volnovoi-style__marquee-chunk">{text}</span>
        </span>
      ) : (
        <span className="volnovoi-style__headline-text">{text}</span>
      )}
      <span className="volnovoi-style__headline-sr">{text}</span>
    </span>
  );
}

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
          <StyleHeadline text={style.headline} />
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
