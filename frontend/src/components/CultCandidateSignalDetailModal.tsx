import type { Signal } from "../api";
import { calcRR, formatTakeProfits, formatTime, formatUsd } from "../utils";
import {
  signalEntryStakePct,
  signalPriceMovePct,
  signalRealizedPnl,
  signalStopMovePct,
  signalTrackerBalanceUsd,
} from "../utils/signalPnl";
import { formatSignedMovePct, signalOutcomeDisplay } from "../utils/signalChartLevels";
import { SignalChart } from "./SignalChart";
import { SignalLevelsGrid } from "./SignalLevelsGrid";

type Props = {
  signal: Signal | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

export function CultCandidateSignalDetailModal({ signal, loading = false, error = null, onClose }: Props) {
  if (!signal && !loading && !error) return null;

  const s = signal;
  const entry = s ? s.entry_low || s.entry_high || "—" : "—";
  const target = s ? formatTakeProfits(s.take_profits) : "—";
  const isLong = s?.direction === "long";
  const stake = s ? signalEntryStakePct(s) : 0;
  const trackerUsd = s ? signalTrackerBalanceUsd(s) : 0;
  const movePct = s ? signalPriceMovePct(s) : null;
  const pnl = s ? signalRealizedPnl(s) ?? s.realized_pnl : null;
  const outcome = s
    ? signalOutcomeDisplay(
        s.status,
        true,
        s.close_reason,
        s.closed_exit_price,
        s.entry_low,
        s.entry_high,
        s.stop_loss,
        s.take_profits,
      )
    : null;
  const rr = s ? calcRR(entry === "—" ? null : entry, s.stop_loss, s.take_profits) : "—";
  const stopMovePct = s ? signalStopMovePct(s) : null;

  return (
    <div className="modal-backdrop modal-backdrop--sheet" role="presentation" onClick={onClose}>
      <div className="modal cult-candidate-signal-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{s ? s.symbol : "Сделка"}</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        {loading && <p className="meta">Загрузка…</p>}
        {error && <p className="err">{error}</p>}

        {s && (
          <article className="signal-card signal-card--readonly">
            <header className="signal-card__top">
              <div className="signal-card__sym">
                <span className="signal-number">#{s.number}</span>
                <span className={`dir-badge ${isLong ? "long" : "short"}`}>
                  {isLong ? "↑ LONG" : "↓ SHORT"}
                </span>
              </div>
              <div className="signal-card__perf">
                {outcome && <span className={`outcome outcome--head ${outcome.className}`}>{outcome.label}</span>}
                {(pnl != null || movePct != null) && (
                  <div className={`signal-card__result ${(pnl ?? movePct ?? 0) >= 0 ? "up" : "down"}`}>
                    {pnl != null && (
                      <span className="signal-card__result-usd">
                        {pnl >= 0 ? "+" : ""}
                        {formatUsd(pnl)}
                      </span>
                    )}
                    {movePct != null && (
                      <span className="signal-card__result-pct">{formatSignedMovePct(movePct)}</span>
                    )}
                  </div>
                )}
              </div>
            </header>

            <time className="signal-card__time">
              {formatTime(s.created_at)}
              {s.closed_at ? ` → ${formatTime(s.closed_at)}` : ""}
            </time>

            <div className="signal-card__params">
              <div className="signal-param">
                <span className="signal-param__label">Вход</span>
                <span className="signal-param__value">{stake}%</span>
              </div>
              <div className="signal-param">
                <span className="signal-param__label">Счёт</span>
                <span className="signal-param__value">{trackerUsd > 0 ? formatUsd(trackerUsd) : "—"}</span>
              </div>
              <div className="signal-param">
                <span className="signal-param__label">Плечо</span>
                <span className="signal-param__value">{s.leverage ?? 1}x</span>
              </div>
              <div className="signal-param">
                <span className="signal-param__label">RR</span>
                <span className="signal-param__value">{rr}</span>
              </div>
            </div>

            <SignalChart
              symbol={s.symbol}
              direction={isLong ? "long" : "short"}
              createdAt={s.created_at}
              entryLow={s.entry_low}
              entryHigh={s.entry_high}
              stopLoss={s.stop_loss}
              takeProfits={s.take_profits}
              closedAt={s.closed_at}
              closeReason={s.close_reason}
              closedExitPrice={s.closed_exit_price}
              status={s.status}
              entryFilledAt={s.entry_filled_at}
              entryPrice={s.published_market_price}
              frozen
              eager
            />

            <SignalLevelsGrid entry={entry} stopLoss={s.stop_loss} target={target} stopMovePct={stopMovePct} />

            {s.comment && <p className="signal-card__comment">{s.comment}</p>}
          </article>
        )}
      </div>
    </div>
  );
}
