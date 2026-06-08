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
  background: "#0a0c10",
  text: "#5a8a96",
  upColor: "#05ffa1",
  downColor: "#ff2a6d",
  wickUp: "#05ffa1",
  wickDown: "#ff2a6d",
  stop: "#ff2a6d",
  target: "#00f0ff",
  entryWaiting: "#6a8a96",
};

export function chartPaletteFor(theme: Theme): ChartPalette {
  return theme === "punk" ? PUNK : DARK;
}
