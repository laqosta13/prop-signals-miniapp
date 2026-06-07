import { avatarEvilTier, avatarVariantSeed } from "../utils/punkAvatar";

type Props = {
  size: number;
  label?: string;
  rankId?: number | null;
  variantSeed?: string | number | null;
};

/** Загадочный силуэт в панк-теме — ранг и seed задают «злость» и форму лица. */
export function MysteryAvatar({ size, label = "Оператор", rankId, variantSeed }: Props) {
  const tier = avatarEvilTier(rankId);
  const variant = avatarVariantSeed(variantSeed ?? label);
  const eye = Math.max(3, Math.round(size * (tier >= 7 ? 0.11 : tier >= 4 ? 0.095 : 0.08)));
  const gap = Math.max(4, Math.round(size * (0.12 + variant * 0.02)));

  return (
    <span
      className={`avatar avatar--mystery avatar--mystery-tier-${tier} avatar--mystery-variant-${variant}`}
      style={{ width: size, height: size }}
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
