import { useMskDayCountdown } from "../hooks/useMskDayCountdown";

type Props = {
  active: boolean;
};

export function SignalDailyResetTimer({ active }: Props) {
  const { label } = useMskDayCountdown(active);
  if (!active) return null;

  return (
    <p className="meta signal-daily-reset-timer">
      До обновления лимитов: <strong className="signal-daily-reset-timer__clock">{label}</strong>{" "}
      <span className="signal-daily-reset-timer__tz">МСК</span>
    </p>
  );
}
