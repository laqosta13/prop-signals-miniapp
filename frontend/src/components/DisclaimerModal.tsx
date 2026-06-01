import { createPortal } from "react-dom";
import {
  DISCLAIMER_ACCEPT_LABEL,
  DISCLAIMER_FOOTER,
  DISCLAIMER_LEAD,
  DISCLAIMER_POINTS,
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
        <p className="disclaimer-sheet__lead">{DISCLAIMER_LEAD}</p>
        <ul className="disclaimer-sheet__list">
          {DISCLAIMER_POINTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="disclaimer-sheet__footer">{DISCLAIMER_FOOTER}</p>
        {isInfo ? (
          <button type="button" className="submit-btn" onClick={onClose}>
            Понятно
          </button>
        ) : (
          <button type="button" className="submit-btn" onClick={onAccept}>
            {DISCLAIMER_ACCEPT_LABEL}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
