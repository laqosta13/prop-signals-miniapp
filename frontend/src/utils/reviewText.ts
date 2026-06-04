import { REVIEW_TEXT_FORBIDDEN_MSG } from "../data/reviewRules";

const SCHEME = /(?:https?|ftp|tg):\/\//i;
const WWW = /\bwww\./i;
const TG_LINK = /\b(?:t\.me|telegram\.me|telegram\.dog)\//i;
const DOMAIN =
  /(?<![@\w])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|ru|org|net|io|xyz|app|me|link|site|online|pro|info|biz|co|uk|de|fr|cc|tv|ws|su|by|ua|kz)(?:\/|\b|:)/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const AT_HANDLE = /(?<!\w)@[a-zA-Z][a-zA-Z0-9_]{3,31}\b/;

export function reviewTextError(text: string): string | null {
  const s = text.trim();
  if (!s) return null;
  if (SCHEME.test(s) || WWW.test(s) || TG_LINK.test(s) || DOMAIN.test(s)) {
    return REVIEW_TEXT_FORBIDDEN_MSG;
  }
  if (EMAIL.test(s) || AT_HANDLE.test(s)) return REVIEW_TEXT_FORBIDDEN_MSG;
  return null;
}
