import { roundStopPct } from "./dailyStopLimit";

/** Равномерные метки от min до max (включая концы). */
export function evenSliderMarks(max: number, min = 0, segments = 4): number[] {
  const cap = roundStopPct(Math.max(min, max));
  const floor = roundStopPct(Math.max(0, min));
  if (cap <= floor + 1e-9) return cap > 0 || floor > 0 ? [floor] : [0];
  const marks: number[] = [];
  for (let i = 0; i <= segments; i++) {
    marks.push(roundStopPct(floor + ((cap - floor) * i) / segments));
  }
  return marks.filter((m, i, arr) => i === 0 || m > arr[i - 1] + 1e-9);
}
