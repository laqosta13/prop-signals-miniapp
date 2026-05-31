import { useEffect, useId, useRef, useState } from "react";
import type { Trader } from "../api";
import { volnovoiCopyPitch } from "../utils/volnovoiPitch";

type Props = {
  trader: Pick<Trader, "total_pnl_usd" | "rating_percent">;
  className?: string;
};

export function VolnovoiMarketingBadge({ trader, className = "" }: Props) {
  const pitch = volnovoiCopyPitch(trader);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`volnovoi-marketing${open ? " volnovoi-marketing--open" : ""} ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`volnovoi-marketing__badge${pitch.positive ? " volnovoi-marketing__badge--up" : ""}`}
        aria-expanded={open}
        aria-describedby={tipId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="volnovoi-marketing__badge-icon" aria-hidden>
          {pitch.positive ? "💰" : "📈"}
        </span>
        <span>{pitch.badgeLabel}</span>
      </button>

      <div id={tipId} role="tooltip" className="volnovoi-marketing__tip">
        <p className="volnovoi-marketing__tip-head">{pitch.headline}</p>
        <p className={`volnovoi-marketing__tip-profit${pitch.positive ? " up" : " down"}`}>{pitch.profitLine}</p>
        <p className="volnovoi-marketing__tip-body">{pitch.depositLine}</p>
        <p className="volnovoi-marketing__tip-cta">Подключите Bybit под карточкой ↓</p>
      </div>
    </div>
  );
}
