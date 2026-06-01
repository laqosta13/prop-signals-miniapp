import { useEffect, useState } from "react";
import { formatMskDayCountdown, msUntilMskMidnight } from "../utils/mskDayCountdown";

export function useMskDayCountdown(enabled: boolean) {
  const [remainingMs, setRemainingMs] = useState(() => msUntilMskMidnight());

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setRemainingMs(msUntilMskMidnight());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return {
    remainingMs,
    label: formatMskDayCountdown(remainingMs),
  };
}
