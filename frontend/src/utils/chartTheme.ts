import type { Theme } from "./theme";

export type ChartPalette = {
  background: string;
  text: string;
  upColor: string;
  downColor: string;
  wickUp: string;
  wickDown: string;
  stop: string;
  target: string;
  entryWaiting: string;
};

const LIGHT: ChartPalette = {
  background: "#f8fafc",
  text: "#64748b",
  upColor: "#059669",
  downColor: "#dc2626",
  wickUp: "#059669",
  wickDown: "#dc2626",
  stop: "#dc2626",
  target: "#7c3aed",
  entryWaiting: "#94a3b8",
};

const DARK: ChartPalette = {
  background: "#141416",
  text: "#8a8a93",
  upColor: "#3dff8a",
  downColor: "#ff6b6b",
  wickUp: "#3dff8a",
  wickDown: "#ff6b6b",
  stop: "#ff6b6b",
  target: "#e0afff",
  entryWaiting: "#9ca3af",
};

export function chartPaletteFor(theme: Theme): ChartPalette {
  return theme === "light" ? LIGHT : DARK;
}
