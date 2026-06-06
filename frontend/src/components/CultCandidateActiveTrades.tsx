import type { CultCandidateActiveSignal } from "../api";

type Props = {
  trades: CultCandidateActiveSignal[];
  canClose?: boolean;
  closingId?: number | null;
  onCloseAtMarket?: (id: number) => void;
};

function symbolBase(symbol: string): string {
  return symbol.replace(/USDT$/i, "").replace(/USD$/i, "") || symbol;
}

function symbolHue(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  return h;
}

function dirLabel(direction: string): string {
  return direction.toLowerCase() === "long" ? "LONG" : "SHORT";
}

function statusClass(trade: CultCandidateActiveSignal): string {
  if (trade.awaiting_entry) return "cult-active-trades__status--wait";
  if (trade.in_market) return "cult-active-trades__status--live";
  return "cult-active-trades__status--idle";
}

export function CultCandidateActiveTrades({
  trades,
  canClose = false,
  closingId = null,
  onCloseAtMarket,
}: Props) {
  if (!trades.length) return null;

  return (
    <div className="cult-active-trades" onClick={(e) => e.stopPropagation()}>
      <p className="cult-active-trades__title">Активные сделки</p>
      <ul className="cult-active-trades__list">
        {trades.map((t) => {
          const base = symbolBase(t.symbol);
          const isLong = t.direction.toLowerCase() === "long";
          const showClose = canClose && t.in_market && onCloseAtMarket;
          return (
            <li key={t.id} className="cult-active-trades__item">
              <div className="cult-active-trades__row">
                <span
                  className="cult-active-trades__icon"
                  style={{ background: `hsl(${symbolHue(t.symbol)} 55% 38%)` }}
                  aria-hidden
                >
                  {base.slice(0, 3)}
                </span>
                <div className="cult-active-trades__main">
                  <div className="cult-active-trades__head">
                    <span className="cult-active-trades__sym">{base}</span>
                    <span className={`cult-active-trades__dir${isLong ? " cult-active-trades__dir--long" : " cult-active-trades__dir--short"}`}>
                      {dirLabel(t.direction)}
                    </span>
                    <span className="cult-active-trades__size">
                      {t.stake_percent}% · {t.leverage}×
                    </span>
                  </div>
                  <div className="cult-active-trades__levels">
                    <span className="cult-active-trades__entry">вход {t.entry}</span>
                    <span className={`cult-active-trades__status ${statusClass(t)}`}>{t.level_label}</span>
                  </div>
                </div>
              </div>
              {showClose && (
                <button
                  type="button"
                  className="ghost-btn cult-active-trades__close"
                  disabled={closingId === t.id}
                  onClick={() => onCloseAtMarket(t.id)}
                >
                  {closingId === t.id ? "Закрытие…" : "Закрыть по рынку"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
