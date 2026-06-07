type Place = 1 | 2 | 3;

type Props = {
  place: Place;
  className?: string;
};

const MEDAL_SRC: Record<Place, string> = {
  1: "/ranks/top-place-1.png",
  2: "/ranks/top-place-2.png",
  3: "/ranks/top-place-3.png",
};

export function TopPlaceMedal({ place, className = "" }: Props) {
  return (
    <span
      className={`top-place-medal top-place-medal--${place}${className ? ` ${className}` : ""}`}
      aria-label={`${place} место`}
      role="img"
    >
      <img src={MEDAL_SRC[place]} alt="" width={41} height={52} decoding="async" draggable={false} />
    </span>
  );
}
