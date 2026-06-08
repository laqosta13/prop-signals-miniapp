type Props = {
  inMarketCount: number;
  awaitingCount: number;
  inMarketLabel: string;
  awaitingLabel: string;
};

export function FeedHeaderStats({ inMarketCount, awaitingCount, inMarketLabel, awaitingLabel }: Props) {
  if (inMarketCount <= 0 && awaitingCount <= 0) return null;

  return (
    <span className="topbar__feed-stats" aria-hidden>
      {inMarketCount > 0 && (
        <span className="topbar__feed-chip topbar__feed-chip--live">
          <span className="topbar__feed-chip-dot" />
          <span className="topbar__feed-chip-count">{inMarketCount}</span>
          <span className="topbar__feed-chip-label">{inMarketLabel}</span>
        </span>
      )}
      {awaitingCount > 0 && (
        <span className="topbar__feed-chip topbar__feed-chip--queue">
          <span className="topbar__feed-chip-dot" />
          <span className="topbar__feed-chip-count">{awaitingCount}</span>
          <span className="topbar__feed-chip-label">{awaitingLabel}</span>
        </span>
      )}
    </span>
  );
}
