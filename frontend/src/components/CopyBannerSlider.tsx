import { useEffect, useState } from "react";
import { BybitLogo } from "./BrandLogos";

const SLIDES = [
  {
    eyebrow: "AUTO COPY · BYBIT",
    headline: "ВСЕ СДЕЛКИ CULT TRADERS",
    logo: true,
  },
  {
    eyebrow: "КОПИРОВАНИЕ НА БИРЖУ",
    headline: "МГНОВЕННО И АВТОМАТИЧЕСКИ",
    logo: false,
  },
  {
    eyebrow: "ПОДКЛЮЧИ API BYBIT",
    headline: "ТОРГУЙ ВМЕСТЕ С ТОПОМ",
    logo: true,
  },
  {
    eyebrow: "CULT TRADERS · СДЕЛКИ",
    headline: "ОТКРЫВАЮТ ПОЗИЦИИ ЗА ТЕБЯ",
    logo: false,
  },
] as const;

const INTERVAL_MS = 3400;

interface Props {
  paused?: boolean;
}

export function CopyBannerSlider({ paused }: Props) {
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % SLIDES.length);
      setAnimKey((k) => k + 1);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[idx];

  return (
    <span className="copy-banner">
      <span className="copy-banner__scanline" aria-hidden />
      <span key={animKey} className="copy-banner__slide">
        <span className="copy-banner__eyebrow">
          {slide.logo && <BybitLogo size={13} />}
          {slide.eyebrow}
        </span>
        <span className="copy-banner__headline">{slide.headline}</span>
      </span>
      <span className="copy-banner__indicators" aria-hidden>
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`copy-banner__dot${i === idx ? " copy-banner__dot--on" : ""}`}
          />
        ))}
      </span>
    </span>
  );
}
