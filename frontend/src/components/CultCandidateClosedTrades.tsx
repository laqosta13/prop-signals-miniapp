import { useState } from "react";
import type { CultCandidateClosedSignal } from "../api";
import { formatTradePrice } from "../utils/formatTradePrice";
import { CoinLogo } from "./CoinLogo";

const COLLAPSED_COUNT = 3;

type Props = {
  trades: CultCandidateClosedSignal[];
  onOpen: (trade: CultCandidateClosedSignal) => void;
};

export function CultCandidateClosedTrades({ trades, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!trades.length) return null;

  const visible = expanded ? trades : trades.slice(0, COLLAPSED_COUNT);
  const hasMore = trades.length > COLLAPSED_COUNT;

  return (
    <div className="cult-closed-trades" onClick={(e) => e.stopPropagation()}>
      <p className="cult-closed-trades__title">Закрытые сделки</p>
      <ul className="cult-closed-trades__list">
        {visible.map((t) => {
          const up = t.move_pct >= 0;
          return (
            <li key={t.id}>
              <button type="button" className="cult-closed-trades__row" onClick={() => onOpen(t)}>
                <CoinLogo symbol={t.symbol} size={32} showLabel className="cult-closed-trades__coin" />
                <span className="cult-closed-trades__meta">
                  <span className={`cult-closed-trades__price${up ? " cult-closed-trades__price--up" : " cult-closed-trades__price--down"}`}>
                    {formatTradePrice(t.exit_price)}
                  </span>
                  <span className={`cult-closed-trades__move${up ? " up" : " down"}`}>
                    {up ? "▲" : "▼"} {up ? "+" : ""}
                    {t.move_pct.toFixed(2)}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="cult-closed-trades__toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Свернуть" : `Ещё ${trades.length - COLLAPSED_COUNT}`}
        </button>
      )}
    </div>
  );
}
