/** Чем выше ранг Cult — тем «злее» лицо в панк-аватаре (1…10). */
const RANK_EVIL_TIER: Record<number, number> = {
  8: 1,
  7: 2,
  6: 3,
  5: 4,
  4: 5,
  3: 6,
  2: 7,
  1: 8,
  9: 9,
  10: 10,
};

export function avatarEvilTier(rankId?: number | null): number {
  if (rankId != null && RANK_EVIL_TIER[rankId] != null) return RANK_EVIL_TIER[rankId];
  return 1;
}

export const AVATAR_VARIANT_COUNT = 12;

/** 0…11 — разные силуэты у каждого оператора. */
export function avatarVariantSeed(seed?: string | number | null): number {
  if (seed == null || seed === "") return 0;
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h % AVATAR_VARIANT_COUNT;
}
