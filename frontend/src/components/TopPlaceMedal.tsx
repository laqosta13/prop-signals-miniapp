import { useId } from "react";
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

  const uid = useId().replace(/:/g, "");

  if (punk) {
    return (
      <span className={cls} aria-label={`${place} место`}>
        <PunkPlaceFrame place={place} uid={uid} />
        <span className="top-place-medal__digit" aria-hidden>
          {String(place).padStart(2, "0")}
        </span>
      </span>
    );
  }

  return (
    <span className={cls} aria-label={`${place} место`}>
      <ClassicPlaceFrame place={place} uid={uid} />
      <span className="top-place-medal__digit" aria-hidden>
        {place}
      </span>
    </span>
  );
}

function ClassicPlaceFrame({ place, uid }: { place: Place; uid: string }) {
  if (place === 1) {
    const g = `cl-gold-${uid}`;
    return (
      <svg className="top-place-medal__frame" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id={g} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff4c4" />
            <stop offset="45%" stopColor="#ffd84a" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${g})`}
          d="M16 3l1.8 4.2 4.5.6-3.3 2.9 1 4.4-4-2.4-4 2.4 1-4.4-3.3-2.9 4.5-.6L16 3z"
        />
        <circle cx="16" cy="19" r="10" fill={`url(#${g})`} stroke="#fff8dc" strokeWidth="1.2" />
        <circle cx="16" cy="19" r="7.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
      </svg>
    );
  }
  if (place === 2) {
    const g = `cl-silver-${uid}`;
    return (
      <svg className="top-place-medal__frame" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id={g} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#c5d0dc" />
            <stop offset="100%" stopColor="#6b7f94" />
          </linearGradient>
        </defs>
        <rect x="5" y="7" width="22" height="22" rx="7" fill={`url(#${g})`} stroke="#eef3f8" strokeWidth="1.2" />
        <path
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="0.9"
          d="M10 16h12M16 10v12"
        />
        <circle cx="16" cy="16" r="5.5" fill="none" stroke="rgba(129,140,248,0.55)" strokeWidth="1" />
      </svg>
    );
  }
  const g = `cl-bronze-${uid}`;
  return (
    <svg className="top-place-medal__frame" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={g} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d0a8" />
          <stop offset="50%" stopColor="#cd7f32" />
          <stop offset="100%" stopColor="#7a4518" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${g})`}
        stroke="#ffd4a8"
        strokeWidth="1.1"
        d="M16 5l9 4.5v8.2c0 5.8-4 9.8-9 11.3-5-1.5-9-5.5-9-11.3V9.5L16 5z"
      />
      <path fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" d="M16 11v10M12 15h8" />
    </svg>
  );
}

function PunkPlaceFrame({ place, uid }: { place: Place; uid: string }) {
  const g = place === 1 ? `pk-gold-${uid}` : place === 2 ? `pk-cyan-${uid}` : `pk-ember-${uid}`;
  const stops =
    place === 1
      ? ["#fff9b0", "#ffb800"]
      : place === 2
        ? ["#b8ffff", "#00e5ff"]
        : ["#ff9a5a", "#bc13fe"];
  return (
    <svg className="top-place-medal__frame" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={g} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="100%" stopColor={stops[1]} />
        </linearGradient>
      </defs>
      <polygon
        points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5"
        fill="none"
        stroke={`url(#${g})`}
        strokeWidth="2"
      />
      <polygon
        points="16,7 23.5,11.5 23.5,20.5 16,25 8.5,20.5 8.5,11.5"
        fill="rgba(8,6,16,0.85)"
        stroke={`url(#${g})`}
        strokeWidth="1"
        opacity="0.95"
      />
      <line x1="8" y1="16" x2="24" y2="16" stroke={`url(#${g})`} strokeWidth="0.6" opacity="0.45" />
      <line x1="16" y1="8" x2="16" y2="24" stroke={`url(#${g})`} strokeWidth="0.6" opacity="0.35" />
    </svg>
  );
}
