import type { Theme } from "./theme";
import { isPunkTheme } from "./punkTheme";
import { authorProfile } from "../utils";
import {
  CYBERPUNK_2077_NAMES,
  VOLNOVOI_CYBERPUNK_NAME,
} from "../data/cyberpunk2077Names";
import { VOLNOVOI_TELEGRAM_ID } from "./volnovoi";

function fnv1a(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

export function initialsFromCodename(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

/** Стабильный псевдоним из вселенной CP2077 — один оператор всегда с одним именем в МА. */
export function punkCodename(seed: string | number): string {
  const key = String(seed);
  if (
    key === String(VOLNOVOI_TELEGRAM_ID) ||
    key === `tg:${VOLNOVOI_TELEGRAM_ID}`
  ) {
    return VOLNOVOI_CYBERPUNK_NAME;
  }

  const h = fnv1a(key);
  return CYBERPUNK_2077_NAMES[h % CYBERPUNK_2077_NAMES.length]!;
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
