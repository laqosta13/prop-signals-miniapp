import { resolveAuthorProfile } from "../utils/punkCodename";
import { useAppTheme } from "./useAppTheme";

export function useAuthorProfile(
  displayName?: string | null,
  username?: string | null,
  telegramId?: number | null,
) {
  const theme = useAppTheme();
  return resolveAuthorProfile(theme, displayName, username, telegramId);
}
