import type { ChallengeDashboard } from "../api";
import { authorProfile, formatUsd } from "../utils";

type Props = { trackers: ChallengeDashboard[]; onOpen: () => void };

export function PropTrackerMini({ trackers, onOpen }: Props) {
  if (trackers.length === 0) return null;

  return (
    <section className="prop-mini">
      <div className="prop-mini__head">
        <span>Проп-трекеры</span>
        <button type="button" className="link-btn" onClick={onOpen}>
          Все →
        </button>
      </div>
      {trackers.slice(0, 2).map((data) => {
        const progress = Math.min(100, Math.max(0, (data.profit_pct / data.profit_target_pct) * 100));
        return (
          <div key={data.owner_telegram_id} className="prop-mini__item">
            <p className="prop-mini__owner">{authorProfile(data.owner_display_name, data.owner_username).title}</p>
            {data.owner_username && <p className="prop-mini__login">@{data.owner_username}</p>}
            <p className="prop-mini__balance">{formatUsd(data.balance)}</p>
            <p className={`prop-mini__pct ${data.profit_pct >= 0 ? "up" : "down"}`}>
              {data.profit_pct >= 0 ? "+" : ""}
              {data.profit_pct.toFixed(1)}%
            </p>
            <div className="progress">
              <span className="progress__fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
