import { useEffect, useState } from "react";
import { getStoredTheme, subscribeTheme, toggleTheme, type Theme } from "../utils/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => subscribeTheme(() => setTheme(getStoredTheme())), []);

  const onToggle = () => {
    setTheme(toggleTheme());
  };

  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isLight ? "Тёмная тема" : "Светлая тема"}
      title={isLight ? "Тёмная тема" : "Светлая тема"}
    >
      <span className={`theme-toggle__track${isLight ? " theme-toggle__track--light" : ""}`}>
        <span className="theme-toggle__rest" aria-hidden>
          {isLight ? "ТЕ" : "МА"}
        </span>
        <span className="theme-toggle__thumb" aria-hidden>
          {isLight ? "МА" : "ТЕ"}
        </span>
      </span>
    </button>
  );
}
