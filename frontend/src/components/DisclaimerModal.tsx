import { createPortal } from "react-dom";
import {
  DISCLAIMER_FOOTER,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
} from "../data/disclaimer";

type Props =
  | { variant?: "accept"; onAccept: () => void; onClose?: never }
  | { variant: "info"; onClose: () => void; onAccept?: never };

export function DisclaimerModal({ variant = "accept", onAccept, onClose }: Props) {
  const isInfo = variant === "info";

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--disclaimer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      onClick={isInfo ? () => onClose() : undefined}
    >
      <div
        className="disclaimer-sheet"
        onClick={isInfo ? (e) => e.stopPropagation() : undefined}
      >
        <h2 id="disclaimer-title">{DISCLAIMER_TITLE}</h2>
        <div className="disclaimer-sheet__body">
          {DISCLAIMER_PARAGRAPHS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="disclaimer-sheet__footer">{DISCLAIMER_FOOTER}</p>
        {isInfo ? (
          <button type="button" className="submit-btn" onClick={onClose}>
            Понятно
          </button>
        ) : (
          <button type="button" className="submit-btn" onClick={onAccept}>
            Принимаю правила
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
