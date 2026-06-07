type Place = 1 | 2 | 3;

type Props = {
  place: Place;
  className?: string;
};

export function TopPlaceMedal({ place, className = "" }: Props) {
  return (
    <span
      className={`top-place-chip top-place-chip--${place}${className ? ` ${className}` : ""}`}
      aria-label={`${place} место`}
    >
      {place}
    </span>
  );
}
