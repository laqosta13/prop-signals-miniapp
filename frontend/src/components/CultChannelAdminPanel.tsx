import { useState } from "react";
import type { CultChannel } from "../api";
import { createCultChannel, deleteCultChannel } from "../api";
import { useThemedCopy } from "../hooks/useThemedCopy";

type Props = {
  channels: CultChannel[];
  onChange: () => void;
};

export function CultChannelAdminPanel({ channels, onChange }: Props) {
  const copy = useThemedCopy();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onAdd = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        await createCultChannel(trimmed);
        setUrl("");
        onChange();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusy(false);
      }
    })();
  };

  const onRemove = (id: number) => {
    if (!confirm("Отключить канал и удалить аналитику?")) return;
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        await deleteCultChannel(id);
        onChange();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="cult-channel-admin">
      <p className="cult-channel-admin__hint meta">{copy.cultChannelAdminHint}</p>
      <div className="cult-channel-admin__row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="t.me/channel или @channel"
          disabled={busy}
        />
        <button type="button" className="btn-primary" disabled={busy || !url.trim()} onClick={onAdd}>
          Добавить
        </button>
      </div>
      {err && <p className="err cult-channel-admin__err">{err}</p>}
      {channels.length > 0 && (
        <ul className="cult-channel-admin__list">
          {channels.map((ch) => (
            <li key={ch.id}>
              <a href={ch.channel_url} target="_blank" rel="noreferrer">
                @{ch.username}
              </a>
              <span className="meta">
                {ch.rating_percent >= 0 ? "+" : ""}
                {ch.rating_percent.toFixed(2)}%
              </span>
              <button type="button" className="btn-ghost cult-channel-admin__remove" disabled={busy} onClick={() => onRemove(ch.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
