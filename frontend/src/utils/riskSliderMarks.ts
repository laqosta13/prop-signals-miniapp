import type { CSSProperties } from "react";

/** Позиция метки под range: 0 — слева, max — справа. */
export function riskSliderMarkStyle(value: number, max: number): CSSProperties {
  if (max <= 0) return { left: "0%", transform: "translateX(0)" };
  const left = `${(value / max) * 100}%`;
  if (value <= 0) return { left, transform: "translateX(0)" };
  if (value >= max - 1e-6) return { left, transform: "translateX(-100%)" };
  return { left, transform: "translateX(-50%)" };
}
