import { authorIdentitySeed } from "../utils/punkCodename";
import { avatarEvilTier, avatarVariantSeed } from "../utils/punkAvatar";

type Props = {
  size: number;
  label?: string;
  rankId?: number | null;
  variantSeed?: string | number | null;
};

/** Загадочный силуэт в панк-теме — ранг и seed задают «злость» и форму лица. */
function mysteryHue(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 250 + (h % 70);
}

export function MysteryAvatar({ size, label = "Оператор", rankId, variantSeed }: Props) {
  const tier = avatarEvilTier(rankId);
  const seed = variantSeed ?? label;
  const variant = avatarVariantSeed(seed);
  const eye = Math.max(3, Math.round(size * (tier >= 7 ? 0.11 : tier >= 4 ? 0.095 : 0.08)));
  const gap = Math.max(4, Math.round(size * (0.12 + (variant % 6) * 0.015)));
  const hue = mysteryHue(typeof seed === "number" ? authorIdentitySeed(seed) : seed);

  return (
    <span
      className={`avatar avatar--mystery avatar--mystery-tier-${tier} avatar--mystery-variant-${variant}`}
      style={{ width: size, height: size, ["--mystery-hue" as string]: hue }}
      role="img"
      aria-label={label}
    >
      <span className="avatar__mystery-hood" aria-hidden />
      {tier >= 7 && <span className="avatar__mystery-horns" aria-hidden />}
      {tier >= 9 && <span className="avatar__mystery-crown" aria-hidden />}
      <span className="avatar__mystery-face" style={{ gap }} aria-hidden>
        {tier >= 9 && <span className="avatar__mystery-third-eye" style={{ width: eye * 0.7, height: eye * 0.7 }} />}
        <span className="avatar__mystery-eye avatar__mystery-eye--left" style={{ width: eye, height: eye }} />
        <span className="avatar__mystery-eye avatar__mystery-eye--right" style={{ width: eye, height: eye }} />
        {tier >= 4 && <span className="avatar__mystery-mouth" />}
        {tier >= 8 && <span className="avatar__mystery-scar" aria-hidden />}
      </span>
      <span className="avatar__mystery-scan" aria-hidden />
      {tier >= 6 && <span className="avatar__mystery-aura" aria-hidden />}
    </span>
  );
}
