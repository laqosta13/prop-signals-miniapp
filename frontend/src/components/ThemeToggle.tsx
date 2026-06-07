import { useEffect, useState } from "react";
import { getStoredTheme, subscribeTheme, toggleTheme, type Theme } from "../utils/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => subscribeTheme(() => setTheme(getStoredTheme())), []);

  const onToggle = () => {
    setTheme(toggleTheme());
  };

  const isPunk = theme === "punk";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isPunk ? "Тёмная тема" : "Панк-тема"}
      title={isPunk ? "Тёмная тема" : "Панк-тема"}
    >
      <span className={`theme-toggle__track${isPunk ? " theme-toggle__track--punk" : ""}`}>
        <span className="theme-toggle__rest" aria-hidden>
          {isPunk ? "ТЕ" : "МА"}
        </span>
        <span className="theme-toggle__thumb" aria-hidden>
          {isPunk ? "МА" : "ТЕ"}
        </span>
      </span>
    </button>
  );
}
