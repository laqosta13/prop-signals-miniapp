import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  subtitle: string;
  onClose: () => void;
  onBackdropClick: () => void;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  busy?: boolean;
};

export function SignalFormShell({
  title,
  subtitle,
  onClose,
  onBackdropClick,
  children,
  onSubmit,
  busy = false,
}: Props) {
  return createPortal(
    <div className="modal-backdrop modal-backdrop--sheet modal-backdrop--signal" onClick={onBackdropClick}>
      <form
        className={`modal signal-form${busy ? " signal-form--busy" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="signal-form__drag-pill" aria-hidden />
        <header className="modal__head signal-form__head">
          <div className="signal-form__head-text">
            <h2 className="signal-form__head-title">{title}</h2>
            <p className="signal-form__head-sub">{subtitle}</p>
          </div>
          <button type="button" className="signal-form__close-btn" onClick={onClose} disabled={busy} aria-label="Закрыть">
            ✕
          </button>
        </header>
        {children}
      </form>
    </div>,
    document.body,
  );
}
