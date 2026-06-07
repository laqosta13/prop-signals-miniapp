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

const PUNK: ChartPalette = {
  background: "#080810",
  text: "#bc13fe",
  upColor: "#39FF14",
  downColor: "#ff2a6d",
  wickUp: "#39FF14",
  wickDown: "#ff2a6d",
  stop: "#ff2a6d",
  target: "#BC13FE",
  entryWaiting: "#6b7280",
};

export function chartPaletteFor(theme: Theme): ChartPalette {
  return theme === "punk" ? PUNK : DARK;
}
