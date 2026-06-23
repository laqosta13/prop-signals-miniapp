import { useState } from "react";
import type { Signal } from "../api";
import { ruTextFieldProps } from "../utils/textFieldProps";

type Props = {
  signal: Signal | null;
  onClose: () => void;
  onConfirm: (signalId: number, reason: string) => void;
  deleting?: boolean;
};

export function DeleteSignalModal({ signal, onClose, onConfirm, deleting }: Props) {
  const [reason, setReason] = useState("");

  if (!signal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(signal.id, reason.trim());
  };

  return (
    <div className="modal-backdrop modal-backdrop--sheet modal-backdrop--signal" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="modal__head">
          <div>
            <h2>Удалить сделку</h2>
            <p>
              #{signal.number} · {signal.symbol} · {signal.direction.toUpperCase()}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="field-label">Причина удаления</label>
        <textarea
          {...ruTextFieldProps}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Укажите причину удаления сделки…"
          rows={3}
          required
        />

        <button type="submit" className="submit-btn submit-btn--danger" disabled={deleting || !reason.trim()}>
          {deleting ? "Удаление…" : "Удалить сделку"}
        </button>
      </form>
    </div>
  );
}
