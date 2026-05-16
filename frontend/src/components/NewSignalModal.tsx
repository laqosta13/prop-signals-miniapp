import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignal } from "../api";
import { normalizeTakeProfits } from "../utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function NewSignalModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [leverage, setLeverage] = useState("5");
  const [risk, setRisk] = useState("1");
  const [comment, setComment] = useState("");

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSignal({
        symbol,
        direction,
        entry_low: entry || undefined,
        entry_high: entry || undefined,
        stop_loss: stop || undefined,
        take_profits: normalizeTakeProfits(target),
        comment: comment || undefined,
        leverage: parseInt(leverage, 10) || 5,
        risk_percent: parseFloat(risk) || 1,
      });
      WebApp.HapticFeedback.notificationOccurred("success");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <div>
            <h2>Новый сигнал</h2>
            <p>Публикация в ленту</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="field-label">Инструмент</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required />

        <label className="field-label">Направление</label>
        <div className="dir-toggle">
          <button
            type="button"
            className={direction === "long" ? "active long" : ""}
            onClick={() => setDirection("long")}
          >
            LONG
          </button>
          <button
            type="button"
            className={direction === "short" ? "active short" : ""}
            onClick={() => setDirection("short")}
          >
            SHORT
          </button>
        </div>

        <div className="triple">
          <div>
            <label className="field-label">Вход</label>
            <input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="field-label">Стоп</label>
            <input value={stop} onChange={(e) => setStop(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="field-label">Цель</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="double">
          <div>
            <label className="field-label">Плечо</label>
            <input value={leverage} onChange={(e) => setLeverage(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Риск %</label>
            <input value={risk} onChange={(e) => setRisk(e.target.value)} />
          </div>
        </div>

        <label className="field-label">Комментарий</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Краткий анализ сетапа…"
        />

        {error && <p className="err">{error}</p>}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Публикация…" : "Опубликовать сигнал"}
        </button>
      </form>
    </div>
  );
}
