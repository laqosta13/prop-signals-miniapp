import type { CultCandidateClosedSignal } from "../api";
import { formatTradePrice } from "../utils/formatTradePrice";
import { CoinLogo } from "./CoinLogo";

type Props = {
  trades: CultCandidateClosedSignal[];
  onOpen: (trade: CultCandidateClosedSignal) => void;
};

export function CultCandidateClosedTrades({ trades, onOpen }: Props) {
  if (!trades.length) return null;

  return (
    <div className="cult-closed-trades" onClick={(e) => e.stopPropagation()}>
      <p className="cult-closed-trades__title">Закрытые сделки</p>
      <ul className="cult-closed-trades__list">
        {trades.map((t) => {
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
    </div>
  );
}
