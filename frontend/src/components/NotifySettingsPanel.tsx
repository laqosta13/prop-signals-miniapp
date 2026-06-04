type Props = {
  variant: "signals" | "news";
  enabled: boolean;
  onToggle: () => void;
};

const COPY = {
  signals: {
    emoji: "⚡",
    title: "Сигналы",
    tagline: "PUSH В TELEGRAM",
    hint: "Новые сделки, вход в рынок, WIN / LOSE и правки админов.",
  },
  news: {
    emoji: "📰",
    title: "Новости",
    tagline: "ЛЕНТА PROPDESK",
    hint: "Посты из вкладки «Новости» — только с активной подпиской.",
  },
} as const;

export function NotifySettingsPanel({ variant, enabled, onToggle }: Props) {
  const c = COPY[variant];

  return (
    <section className={`notify-panel notify-panel--${variant}`} aria-label={`Уведомления: ${c.title}`}>
      <div className="notify-panel__card">
        <div className="notify-panel__hero">
          <span className="notify-panel__emoji" aria-hidden>
            {c.emoji}
          </span>
          <div className="notify-panel__titles">
            <span className="notify-panel__tagline">{c.tagline}</span>
            <h2 className="notify-panel__title">{c.title}</h2>
          </div>
        </div>
        <p className="notify-panel__hint">{c.hint}</p>
        <div className="notify-panel__blocks">
          <div className="notify-panel__block">
            <span className="notify-panel__block-k">Канал</span>
            <span className="notify-panel__block-v">Telegram · бот</span>
          </div>
          <div className="notify-panel__block">
            <span className="notify-panel__block-k">Статус</span>
            <span className={`notify-panel__block-v notify-panel__block-v--${enabled ? "on" : "off"}`}>
              {enabled ? "Включено" : "Выключено"}
            </span>
          </div>
        </div>
        <label className="notify-panel__switch">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          <span className="notify-panel__track" aria-hidden />
          <span className="notify-panel__switch-label">{enabled ? "Присылать" : "Не беспокоить"}</span>
        </label>
      </div>
    </section>
  );
}
