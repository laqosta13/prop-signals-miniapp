import { ThemeToggle } from "./ThemeToggle";

type Props = {
  enabled: boolean;
  onToggle: () => void;
};

export function NotifySettingsPanel({ enabled, onToggle }: Props) {
  return (
    <div className="notify-settings">
      <label className="notify-row" aria-label="Уведомления в Telegram">
        <input type="checkbox" checked={enabled} onChange={onToggle} />
        <span className="notify-row__track" aria-hidden />
        <span className="notify-row__label">Уведомления в Telegram</span>
      </label>
      <ThemeToggle />
    </div>
  );
}
