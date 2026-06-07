import type { Theme } from "./theme";
import { isPunkTheme } from "./punkTheme";
import { authorProfile } from "../utils";

const EPITHETS = [
  "NEON",
  "VOID",
  "SHADOW",
  "GHOST",
  "CRIMSON",
  "FROST",
  "VENOM",
  "ZERO",
  "DARK",
  "CYBER",
  "ROGUE",
  "STATIC",
  "GLITCH",
  "COLD",
  "DEAD",
  "BLACK",
  "IRON",
  "TOXIC",
  "RUST",
  "DEEP",
  "НЕОНОВЫЙ",
  "ТЕНЕВОЙ",
  "КРАХОВОЙ",
  "ПУСТОЙ",
  "СЕТЕВОЙ",
  "МРАЧНЫЙ",
  "ЛЕДЯНОЙ",
  "ЯДОВИТЫЙ",
  "БИТЫЙ",
  "ДИКИЙ",
  "СКРЫТЫЙ",
  "КИБЕР",
  "МЁРТВЫЙ",
  "БЕЗЛИКИЙ",
  "ШУМНОЙ",
] as const;

const NOUNS = [
  "WOLF",
  "NODE",
  "PULSE",
  "CORE",
  "DRIFT",
  "BYTE",
  "FLUX",
  "GRID",
  "REAPER",
  "BLADE",
  "SPARK",
  "CIPHER",
  "DAEMON",
  "PHANTOM",
  "SIGNAL",
  "VECTOR",
  "PRISM",
  "SHARD",
  "LOOP",
  "FRAME",
  "ВОЛК",
  "ПРИЗРАК",
  "ПУЛЬС",
  "УЗЕЛ",
  "КОД",
  "СКАН",
  "ШПИОН",
  "ДРОН",
  "КРАКЕН",
  "КЛИН",
  "ИСКРА",
  "ШИФР",
  "ФАНТОМ",
  "СИГНАЛ",
  "ВЕКТОР",
  "ОСКОЛОК",
  "ПЕТЛЯ",
  "КАДР",
  "СТАЛКЕР",
  "ПРОТОКОЛ",
] as const;

const HEX = "0123456789ABCDEF";

function fnv1a(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], hash: number, salt: number): T {
  return arr[(hash + salt) % arr.length]!;
}

export function authorIdentitySeed(
  telegramId?: number | null,
  username?: string | null,
  displayName?: string | null,
): string {
  if (telegramId != null) return `tg:${telegramId}`;
  if (username?.trim()) return `u:${username.trim().replace(/^@/, "").toLowerCase()}`;
  if (displayName?.trim()) return `n:${displayName.trim().toLowerCase()}`;
  return "anon";
}

/** Стабильный панк-псевдоним — один оператор всегда с одним именем в мире МА. */
export function punkCodename(seed: string | number): string {
  const key = String(seed);
  const h0 = fnv1a(key);
  const h1 = fnv1a(`${key}:1`);
  const h2 = fnv1a(`${key}:2`);
  const h3 = fnv1a(`${key}:3`);

  const epithet = pick(EPITHETS, h0, 0);
  const noun = pick(NOUNS, h1, 7);
  const num = 10 + (h2 % 90);
  const tag = `${HEX[(h3 >> 4) % 16]}${HEX[h3 % 16]}${HEX[(h3 >> 8) % 16]}`;
  const format = h2 % 8;

  switch (format) {
    case 0:
      return `${epithet} ${noun}`;
    case 1:
      return `${epithet}·${noun}`;
    case 2:
      return `${noun}-${num}`;
    case 3:
      return `${epithet}-${num}`;
    case 4:
      return `NODE-${num}`;
    case 5:
      return `${epithet} ${noun} ${num}`;
    case 6:
      return `${noun} ${epithet}`;
    default:
      return `OP-${tag}`;
  }
}

export function resolvePunkCodename(
  telegramId?: number | null,
  username?: string | null,
  displayName?: string | null,
): string {
  return punkCodename(authorIdentitySeed(telegramId, username, displayName));
}

export function resolveAuthorProfile(
  theme: Theme,
  displayName?: string | null,
  username?: string | null,
  telegramId?: number | null,
): { title: string; subtitle: string | null; punkAlias: boolean } {
  if (!isPunkTheme(theme)) {
    const profile = authorProfile(displayName, username);
    return { ...profile, punkAlias: false };
  }
  return {
    title: resolvePunkCodename(telegramId, username, displayName),
    subtitle: null,
    punkAlias: true,
  };
}
