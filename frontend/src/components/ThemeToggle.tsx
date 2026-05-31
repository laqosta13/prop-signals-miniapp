import { useState } from "react";
import { getStoredTheme, toggleTheme, type Theme } from "../utils/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

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
        <span className="theme-toggle__thumb" aria-hidden>
          {isLight ? (
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M21 14.5A7.5 7.5 0 0 1 9.5 3 6.5 6.5 0 1 0 21 14.5Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}
