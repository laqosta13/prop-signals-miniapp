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
        <header className="modal__head signal-form__head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Закрыть">
            ×
          </button>
        </header>
        {children}
      </form>
    </div>,
    document.body,
  );
}
