export type Theme = "dark" | "punk";

const STORAGE_KEY = "hh-theme";

const themeListeners = new Set<() => void>();

function emitThemeChange(): void {
  themeListeners.forEach((fn) => fn());
}

/** Подписка на смену темы (переключатель, init). */
export function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function normalizeStoredTheme(raw: string | null): Theme | null {
  if (raw === "dark" || raw === "punk") return raw;
  if (raw === "light") return "punk";
  return null;
}

export function getStoredTheme(): Theme {
  try {
    const v = normalizeStoredTheme(localStorage.getItem(STORAGE_KEY));
    if (v) return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** Краткий глич-всплеск (смена темы, вкладки — только в панк-режиме). */
export function triggerGlitch(): void {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== "punk") return;
  root.classList.remove("theme-glitch");
  void root.offsetWidth;
  root.classList.add("theme-glitch");
  window.setTimeout(() => root.classList.remove("theme-glitch"), 720);
}

export function applyTheme(theme: Theme, options?: { glitch?: boolean }): void {
  const prev = document.documentElement.getAttribute("data-theme") as Theme | null;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = "dark";
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  if (options?.glitch !== false && prev && prev !== theme && theme === "punk") {
    triggerGlitch();
  }
  emitThemeChange();
}

export function initTheme(): Theme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === "dark" ? "punk" : "dark";
  applyTheme(next);
  return next;
}
