import { useEffect, useState } from "react";
import { getStoredTheme, subscribeTheme, type Theme } from "../utils/theme";

export function useAppTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => subscribeTheme(() => setTheme(getStoredTheme())), []);

  return theme;
}
