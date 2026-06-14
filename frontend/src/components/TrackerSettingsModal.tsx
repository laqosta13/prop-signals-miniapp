import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateChallengeSettings, type ChallengeDashboard } from "../api";
import { mediaUrl } from "../utils";

type Props = {
  open: boolean;
  tracker: ChallengeDashboard | null;
  createMode?: boolean;
  onClose: () => void;
  onSaved: (updated: ChallengeDashboard) => void;
};

function formatSyncedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });
}

export function TrackerSettingsModal({ open, tracker, createMode = false, onClose, onSaved }: Props) {
  const [accountSize, setAccountSize] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncAvailable = createMode || tracker?.prop_sync_available !== false;
  const lastSynced = formatSyncedAt(tracker?.prop_screenshot_synced_at);

  useEffect(() => {
    if (!open) return;
    setAccountSize(tracker && !createMode ? String(Math.round(tracker.account_size)) : "");
    setScreenshot(null);
    setPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      if (createMode || !tracker) return null;
      return tracker.prop_screenshot_url ? mediaUrl(tracker.prop_screenshot_url) : null;
    });
    setError(null);
  }, [open, createMode, tracker]);

  if (!open) return null;

  const onPickScreenshot = (file: File | null) => {
    if (!syncAvailable) return;
    setScreenshot(file);
    setPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      if (file) return URL.createObjectURL(file);
      return tracker?.prop_screenshot_url ? mediaUrl(tracker.prop_screenshot_url) : null;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSize = accountSize.trim() ? parseFloat(accountSize) : null;
    if (!parsedSize && !screenshot) {
      setError("Укажите размер счёта или выберите скрин с пропа");
      return;
    }
    if (parsedSize !== null && (parsedSize < 100 || parsedSize > 1_000_000)) {
      setError("Размер счёта: от 100 до 1 000 000");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      if (parsedSize) fd.append("account_size", String(parsedSize));
      if (screenshot) fd.append("screenshot", screenshot);
      const updated = await updateChallengeSettings(fd);
      WebApp.HapticFeedback.notificationOccurred("success");
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop modal-backdrop--sheet" onClick={onClose}>
      <form className="modal modal--tracker-settings" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <header className="modal__head">
          <div>
            <h2>{createMode ? "Добавить трекер" : "Сверка с пропом"}</h2>
            <p>Hash Hedge · раз в сутки по скрину</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <p className="meta tracker-settings-note">
          {createMode
            ? "Укажите размер счёта и загрузите скрин — баланс, этап и торговые дни подтянутся автоматически."
            : "Обновите размер счёта (Старт) или загрузите новый скрин для сверки."}
        </p>

        <label className="field-label">Старт ($)</label>
        <input
          type="number"
          className="text-input"
          placeholder="5000"
          value={accountSize}
          min={100}
          max={1000000}
          step={1}
          onChange={(e) => setAccountSize(e.target.value)}
        />

        {!createMode && tracker && (
          <div className="tracker-sync-readonly">
            <div className="tracker-sync-readonly__row">
              <span className="label">Баланс</span>
              <strong>${Math.round(tracker.balance * 100) / 100}</strong>
            </div>
            <div className="tracker-sync-readonly__row">
              <span className="label">Этап</span>
              <strong>{tracker.stage}</strong>
            </div>
            {lastSynced && (
              <p className="meta">Последняя сверка: {lastSynced} (MSK)</p>
            )}
          </div>
        )}

        <label className="field-label">Скрин с пропа</label>
        {preview && (
          <div className="tracker-prop-preview">
            <img src={preview} alt="Скрин с пропа" />
          </div>
        )}
        <div className="signal-media-picker">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="signal-media-picker__input"
            disabled={!syncAvailable}
            onChange={(e) => onPickScreenshot(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="signal-media-picker__btn"
            disabled={!syncAvailable}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview && !createMode ? "Заменить скрин" : preview ? "Заменить скрин" : "Добавить скрин"}
          </button>
        </div>
        {!syncAvailable && (
          <p className="meta">Сверку можно делать раз в сутки. Повторите завтра (MSK).</p>
        )}
        {syncAvailable && (
          <p className="meta">Один актуальный скрин — новый заменяет предыдущий.</p>
        )}

        {error && <p className="err">{error}</p>}

        <button
          type="submit"
          className="submit-btn"
          disabled={submitting || (!accountSize.trim() && !screenshot)}
        >
          {submitting ? "Сохранение…" : createMode ? "Создать трекер" : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
