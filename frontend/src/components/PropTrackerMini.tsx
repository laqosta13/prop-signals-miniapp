import type { ChallengeDashboard } from "../api";
import { useAppTheme } from "../hooks/useAppTheme";
import { formatUsd } from "../utils";
import { resolveAuthorProfile } from "../utils/punkCodename";

type Props = { trackers: ChallengeDashboard[]; onOpen: () => void };

export function PropTrackerMini({ trackers, onOpen }: Props) {
  const theme = useAppTheme();

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
        const unlimited = !!data.profit_target_unlimited;
        const progress = unlimited
          ? Math.min(100, data.profit_pct > 0 ? 100 : 0)
          : Math.min(100, Math.max(0, (data.profit_pct / data.profit_target_pct) * 100));
        const owner = resolveAuthorProfile(
          theme,
          data.owner_display_name,
          data.owner_username,
          data.owner_telegram_id,
        );
        return (
          <div key={data.owner_telegram_id} className="prop-mini__item">
            <p className="prop-mini__owner">{owner.title}</p>
            <p className="prop-mini__balance">{formatUsd(data.balance)}</p>
            <p className={`prop-mini__pct ${data.profit_pct >= 0 ? "up" : "down"}`}>
              {data.profit_pct >= 0 ? "+" : ""}
              {data.profit_pct.toFixed(1)}%
              {!unlimited && ` / ${data.profit_target_pct}%`}
              {unlimited && " · ∞"}
            </p>
            {!unlimited && (
              <div className="progress">
                <span className="progress__fill" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
