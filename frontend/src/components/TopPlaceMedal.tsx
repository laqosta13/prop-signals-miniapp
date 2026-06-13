import { useAppTheme } from "../hooks/useAppTheme";
import { isPunkTheme } from "../utils/punkTheme";

type Place = 1 | 2 | 3;

type Props = {
  place: Place;
  className?: string;
};

export function TopPlaceMedal({ place, className = "" }: Props) {
  const punk = isPunkTheme(useAppTheme());
  const base = `top-place-medal top-place-medal--${punk ? "punk" : "classic"} top-place-medal--${place}`;
  const cls = className ? `${base} ${className}` : base;

  return (
    <span className={cls} aria-label={`${place} место`}>
      <span className="top-place-medal__digit" aria-hidden>
        {place}
      </span>
    </span>
  );
}
