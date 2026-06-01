import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  onClose: () => void;
  onBackdropClick: () => void;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
};

export function SignalFormShell({
  title,
  subtitle,
  onClose,
  onBackdropClick,
  children,
  onSubmit,
}: Props) {
  return (
    <div className="modal-backdrop modal-backdrop--sheet modal-backdrop--signal" onClick={onBackdropClick}>
      <form className="modal signal-form" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <header className="modal__head signal-form__head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        {children}
      </form>
    </div>
  );
}
