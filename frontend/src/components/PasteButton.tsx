import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { readFromClipboard } from "../utils/clipboard";

type Props = {
  onPaste: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PasteButton({ onPaste, disabled, className }: Props) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const text = await readFromClipboard();
      if (text?.trim()) {
        onPaste(text.trim());
        WebApp.HapticFeedback?.impactOccurred("light");
        return;
      }
      WebApp.showAlert("Вставка не сработала. Скопируйте ещё раз и нажмите «Вставить».");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className ?? "paste-btn"}
      onClick={() => void handle()}
      disabled={disabled || busy}
    >
      {busy ? "…" : "Вставить"}
    </button>
  );
}
