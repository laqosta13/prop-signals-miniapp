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
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nominalRaw, setNominalRaw] = useState("1000");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncAvailable = createMode || tracker?.prop_sync_available !== false;
  const lastSynced = formatSyncedAt(tracker?.prop_screenshot_synced_at);

  useEffect(() => {
    if (!open) return;
    setScreenshot(null);
    setNominalRaw("1000");
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

  const nominalUsd = parseFloat(nominalRaw.replace(",", ".")) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createMode && nominalUsd <= 0) {
      setError("Введите номинал челленджа");
      return;
    }
    if (!createMode && !screenshot) {
      setError("Выберите скрин с пропа");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      if (screenshot) fd.append("screenshot", screenshot);
      if (createMode && nominalUsd > 0) fd.append("account_size", String(nominalUsd));
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
            ? "Укажите номинал челленджа — он фиксируется один раз как стартовый баланс."
            : "Замените скрин — баланс, этап и торговые дни обновятся. Старт фиксируется при первой сверке."}
        </p>

        {createMode && (
          <label className="tracker-nominal-field">
            <span className="field-label">Номинал челленджа ($)</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="Например: 5000"
              value={nominalRaw}
              onChange={(e) => setNominalRaw(e.target.value)}
              className="tracker-nominal-input"
              autoFocus
            />
          </label>
        )}

        {!createMode && tracker && (
          <div className="tracker-sync-readonly">
            <div className="tracker-sync-readonly__row">
              <span className="label">Старт</span>
              <strong>${Math.round(tracker.account_size).toLocaleString("en-US")}</strong>
            </div>
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
            {preview ? "Заменить скрин" : "Добавить скрин"}
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
          disabled={
            submitting ||
            (!createMode && (!syncAvailable || !screenshot)) ||
            (createMode && nominalUsd <= 0)
          }
        >
          {submitting ? "Создание…" : createMode ? "Создать трекер" : "Обновить по скрину"}
        </button>
      </form>
    </div>
  );
}
