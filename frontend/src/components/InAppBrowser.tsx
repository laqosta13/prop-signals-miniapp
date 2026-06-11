import { useEffect } from "react";
import { createPortal } from "react-dom";
import WebApp from "@twa-dev/sdk";
import { safeExternalUrl } from "../utils/safeUrl";
import { openExternalLink } from "../utils/openExternalLink";

type Props = {
  url: string;
  title?: string;
  hint?: string;
  onClose: () => void;
};

export function InAppBrowser({ url, title = "Hash Hedge", hint, onClose }: Props) {
  const safe = safeExternalUrl(url);

  useEffect(() => {
    if (!safe) return;
    const bb = WebApp.BackButton;
    if (!bb) return;
    bb.show();
    const onBack = () => onClose();
    bb.onClick(onBack);
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [safe, onClose]);

  if (!safe) return null;

  return createPortal(
    <div className="in-app-browser" role="dialog" aria-modal="true" aria-label={title}>
      <header className="in-app-browser__header">
        <button type="button" className="in-app-browser__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <span className="in-app-browser__title">{title}</span>
        <button
          type="button"
          className="in-app-browser__external"
          onClick={() => openExternalLink(safe)}
          aria-label="Открыть во внешнем браузере"
          title="Открыть во внешнем браузере"
        >
          ↗
        </button>
      </header>
      {hint && <p className="in-app-browser__hint">{hint}</p>}
      <iframe
        className="in-app-browser__frame"
        src={safe}
        title={title}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>,
    document.body,
  );
}
