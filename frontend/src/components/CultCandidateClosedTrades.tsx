import type { CultCandidateClosedSignal } from "../api";
import { formatTradePrice } from "../utils/formatTradePrice";

type Props = {
  trades: CultCandidateClosedSignal[];
  onOpen: (trade: CultCandidateClosedSignal) => void;
};

function symbolBase(symbol: string): string {
  return symbol.replace(/USDT$/i, "").replace(/USD$/i, "") || symbol;
}

function symbolHue(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  return h;
}

export function CultCandidateClosedTrades({ trades, onOpen }: Props) {
  if (!trades.length) return null;

  return (
    <div className="cult-closed-trades" onClick={(e) => e.stopPropagation()}>
      <p className="cult-closed-trades__title">Закрытые сделки</p>
      <ul className="cult-closed-trades__list">
        {trades.map((t) => {
          const up = t.move_pct >= 0;
          const base = symbolBase(t.symbol);
          return (
            <li key={t.id}>
              <button type="button" className="cult-closed-trades__row" onClick={() => onOpen(t)}>
                <span
                  className="cult-closed-trades__icon"
                  style={{ background: `hsl(${symbolHue(t.symbol)} 55% 38%)` }}
                  aria-hidden
                >
                  {base.slice(0, 3)}
                </span>
                <span className="cult-closed-trades__sym">{base}</span>
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
    </div>
  );
}
