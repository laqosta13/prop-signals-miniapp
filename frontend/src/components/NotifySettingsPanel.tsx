type Props = {
  enabled: boolean;
  onToggle: () => void;
  hint?: string | null;
};

export function NotifySettingsPanel({ enabled, onToggle, hint }: Props) {
  return (
    <div className="notify-settings">
      <label className="notify-row" aria-label="Уведомления в Telegram">
        <input type="checkbox" checked={enabled} onChange={onToggle} />
        <span className="notify-row__track" aria-hidden />
        <span className="notify-row__label">Уведомления в Telegram</span>
      </label>
      {hint ? <p className="notify-hint">{hint}</p> : null}
    </div>
  );
}
