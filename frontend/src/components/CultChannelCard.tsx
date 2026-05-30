import type { CultChannel } from "../api";
import { EquityCurve } from "./EquityCurve";

type Props = {
  channel: CultChannel;
};

export function CultChannelCard({ channel }: Props) {
  return (
    <li>
      <div className="top-card top-card--channel">
        <a
          className="top-card__head-btn top-card__head-btn--link"
          href={channel.channel_url}
          target="_blank"
          rel="noreferrer"
        >
          <div className="top-card__head">
            <span className="top-rank top-rank--channel">#{channel.rank}</span>
            <span className="cult-channel__avatar" aria-hidden>
              TG
            </span>
            <div className="top-body">
              <div className="top-name-row">
                <p className="top-name">{channel.title}</p>
              </div>
              <p className="top-aggregate-hint">@{channel.username} · только %</p>
              <p className={`top-score ${channel.rating_percent >= 0 ? "up" : "down"}`}>
                {channel.rating_percent >= 0 ? "+" : ""}
                {channel.rating_percent.toFixed(2)}%
              </p>
              <p className="top-meta">
                W {channel.wins} · L {channel.losses} · WR {channel.win_rate}%
              </p>
            </div>
          </div>
        </a>

        {channel.daily_stats.length > 0 && (
          <EquityCurve dailyStats={channel.daily_stats} percentOnly showDayList />
        )}
      </div>
    </li>
  );
}
