import type { CultCandidateActiveSignal } from "../api";
import { CoinLogo } from "./CoinLogo";
import { SignalChart } from "./SignalChart";

type Props = {
  trades: CultCandidateActiveSignal[];
  showDetails?: boolean;
  canClose?: boolean;
  canEdit?: boolean;
  closingId?: number | null;
  onCloseAtMarket?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
};

function dirLabel(direction: string): string {
  return direction.toLowerCase() === "long" ? "LONG" : "SHORT";
}

function firstTarget(takeProfits: string | null): string | null {
  if (!takeProfits) return null;
  const value = takeProfits.split(",")[0]?.trim();
  return value || null;
}

function statusLabel(trade: CultCandidateActiveSignal): string | null {
  if (trade.awaiting_entry) return "ожидание входа";
  return null;
}

export function CultCandidateActiveTrades({
  trades,
  showDetails = true,
  canClose = false,
  canEdit = false,
  closingId = null,
  onCloseAtMarket,
  onEdit,
  onDelete,
}: Props) {
  if (!trades.length || !showDetails) return null;

  return (
    <div className="cult-active-trades" onClick={(e) => e.stopPropagation()}>
      <p className="cult-active-trades__title">Активные сделки</p>
      <ul className="cult-active-trades__list">
        {trades.map((t) => {
          const isLong = t.direction.toLowerCase() === "long";
          const target = firstTarget(t.take_profits);
          const status = statusLabel(t);
          const showClose = canClose && t.in_market && onCloseAtMarket;
          const showEditDelete = canEdit && t.awaiting_entry;

          return (
            <li key={t.id} className="cult-active-trades__item">
              <div className="cult-active-trades__row">
                <CoinLogo symbol={t.symbol} size={28} showLabel className="cult-active-trades__coin" />
                <div className="cult-active-trades__main">
                  <div className="cult-active-trades__head">
                    <span
                      className={`cult-active-trades__dir${isLong ? " cult-active-trades__dir--long" : " cult-active-trades__dir--short"}`}
                    >
                      {dirLabel(t.direction)}
                    </span>
                    <span className="cult-active-trades__size-pill">
                      <span className="cult-active-trades__size-part">{t.stake_percent}%</span>
                      <span className="cult-active-trades__size-sep" aria-hidden>
                        ·
                      </span>
                      <span className="cult-active-trades__size-part">{t.leverage}×</span>
                    </span>
                  </div>

                  <div className="cult-active-trades__metrics">
                    <div className="cult-active-trades__metric cult-active-trades__metric--entry">
                      <span className="cult-active-trades__metric-label">Вход</span>
                      <span className="cult-active-trades__metric-value">{t.entry}</span>
                    </div>
                    <div className="cult-active-trades__metric cult-active-trades__metric--stop">
                      <span className="cult-active-trades__metric-label">Стоп</span>
                      <span className="cult-active-trades__metric-value">{t.stop_loss ?? "—"}</span>
                    </div>
                    <div className="cult-active-trades__metric cult-active-trades__metric--target">
                      <span className="cult-active-trades__metric-label">Цель</span>
                      <span className="cult-active-trades__metric-value">{target ?? "—"}</span>
                    </div>
                  </div>

                  {status && (
                    <span className="cult-active-trades__status cult-active-trades__status--wait">{status}</span>
                  )}
                </div>
              </div>
              {showEditDelete && (
                <div className="cult-active-trades__edit-row">
                  {onEdit && (
                    <button
                      type="button"
                      className="ghost-btn cult-active-trades__edit"
                      onClick={() => onEdit(t.id)}
                    >
                      Изменить
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="ghost-btn cult-active-trades__delete"
                      onClick={() => onDelete(t.id)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              )}
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
              <SignalChart
                key={t.id}
                symbol={t.symbol}
                direction={t.direction.toLowerCase() === "short" ? "short" : "long"}
                createdAt={t.created_at}
                entryLow={t.entry_low}
                entryHigh={t.entry_high}
                stopLoss={t.stop_loss}
                takeProfits={t.take_profits}
                entryFilledAt={t.entry_filled_at}
                status="active"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
