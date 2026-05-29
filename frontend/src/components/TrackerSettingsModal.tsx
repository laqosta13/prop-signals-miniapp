import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { updateChallengeSettings, type ChallengeDashboard } from "../api";
import { mediaUrl } from "../utils";

type Props = {
  tracker: ChallengeDashboard | null;
  onClose: () => void;
  onSaved: () => void;
};

export function TrackerSettingsModal({ tracker, onClose, onSaved }: Props) {
  const [accountSize, setAccountSize] = useState("10000");
  const [stage, setStage] = useState("1");
  const [balance, setBalance] = useState("10000");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tracker) return;
    setAccountSize(String(Math.round(tracker.account_size)));
    setStage(String(tracker.stage));
    setBalance(String(Math.round(tracker.balance * 100) / 100));
    setScreenshot(null);
    setPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return tracker.prop_screenshot_url ? mediaUrl(tracker.prop_screenshot_url) : null;
    });
    setError(null);
  }, [tracker]);

  if (!tracker) return null;

  const onPickScreenshot = (file: File | null) => {
    setScreenshot(file);
    setPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : tracker.prop_screenshot_url ? mediaUrl(tracker.prop_screenshot_url) : null;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("account_size", accountSize);
      fd.append("stage", stage);
      fd.append("balance", balance);
      if (screenshot) fd.append("screenshot", screenshot);
      await updateChallengeSettings(fd);
      WebApp.HapticFeedback.notificationOccurred("success");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal--tracker-settings" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <header className="modal__head">
          <div>
            <h2>Настройки трекера</h2>
            <p>Hash Hedge · сверка с пропом</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <p className="meta tracker-settings-note">
          Коррекция баланса с пропа не сбрасывает прогресс — меняется только текущая цена счёта.
        </p>

        <label className="field-label">Размер счёта ($)</label>
        <input
          type="number"
          min={1000}
          step={100}
          value={accountSize}
          onChange={(e) => setAccountSize(e.target.value)}
          required
        />

        <label className="field-label">Этап</label>
        <div className="leverage-picker leverage-picker--3col">
          {(["1", "2", "3"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={stage === s ? "active" : ""}
              onClick={() => setStage(s)}
            >
              Этап {s}
            </button>
          ))}
        </div>

        <label className="field-label">Баланс на пропе ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          required
        />

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
            onChange={(e) => onPickScreenshot(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="signal-media-picker__btn" onClick={() => fileInputRef.current?.click()}>
            Заменить скрин
          </button>
        </div>
        <p className="meta">Один актуальный скрин — новый заменяет предыдущий.</p>

        {error && <p className="err">{error}</p>}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
