import { createPortal } from "react-dom";
import { useThemedCopy } from "../hooks/useThemedCopy";

type Props =
  | { variant?: "accept"; onAccept: () => void; onClose?: never }
  | { variant: "info"; onClose: () => void; onAccept?: never };

export function DisclaimerModal({ variant = "accept", onAccept, onClose }: Props) {
  const copy = useThemedCopy();
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
        <h2 id="disclaimer-title">{copy.disclaimerTitle}</h2>
        <p className="disclaimer-sheet__lead">{copy.disclaimerLead}</p>
        <ul className="disclaimer-sheet__list">
          {copy.disclaimerPoints.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="disclaimer-sheet__footer">{copy.disclaimerFooter}</p>
        {isInfo ? (
          <button type="button" className="submit-btn" onClick={onClose}>
            {copy.disclaimerUnderstood}
          </button>
        ) : (
          <button type="button" className="submit-btn" onClick={onAccept}>
            {copy.disclaimerAccept}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
