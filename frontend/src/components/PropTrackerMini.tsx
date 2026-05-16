import type { ChallengeDashboard } from "../api";
import { formatUsd } from "../utils";

type Props = { data: ChallengeDashboard; onOpen: () => void };

export function PropTrackerMini({ data, onOpen }: Props) {
  const progress = Math.min(100, Math.max(0, (data.profit_pct / data.profit_target_pct) * 100));

  return (
    <section className="prop-mini">
      <div className="prop-mini__head">
        <span>Проп-трекер · Hash Hedge</span>
        <button type="button" className="link-btn" onClick={onOpen}>
          Подробнее →
        </button>
      </div>
      <p className="prop-mini__balance">{formatUsd(data.balance)}</p>
      <p className={`prop-mini__pct ${data.profit_pct >= 0 ? "up" : "down"}`}>
        {data.profit_pct >= 0 ? "+" : ""}
        {data.profit_pct.toFixed(1)}%
      </p>
      <div className="progress">
        <span className="progress__fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="prop-mini__labels">
        <span>Старт: {formatUsd(data.account_size)}</span>
        <span>Цель: {formatUsd(data.goal_balance)}</span>
      </div>
    </section>
  );
}
