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
      WebApp.showAlert(
        "Не удалось вставить из буфера. На Linux в Telegram Desktop Ctrl+V часто не работает — скопируйте текст ещё раз и нажмите «Вставить», либо перезапустите Telegram.",
      );
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
