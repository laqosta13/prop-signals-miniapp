import { useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { copyToClipboard, selectFieldText } from "../utils";

type Props = {
  memo?: string | null;
};

export function PaymentMemoRow({ memo }: Props) {
  const [copied, setCopied] = useState(false);
  const memoRef = useRef<HTMLInputElement>(null);
  const code = memo?.trim();
  if (!code) return null;

  const copyMemo = async () => {
    const ok = await copyToClipboard(code);
    WebApp.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (memoRef.current) {
      selectFieldText(memoRef.current);
      WebApp.showAlert("Код выделен — нажмите Ctrl+C (или ⌘+C).");
    }
  };

  return (
    <div className="pay-memo-row">
      <p className="meta pay-memo-row__hint">
        Укажите код в комментарии (memo) перевода — без него TXID не засчитается.
      </p>
      <div className="pay-addr-row">
        <input
          ref={memoRef}
          readOnly
          className="pay-addr pay-memo-row__code"
          value={code}
          onFocus={(e) => selectFieldText(e.currentTarget)}
          aria-label="Код оплаты"
        />
        <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyMemo()}>
          {copied ? "✓" : "Копировать код"}
        </button>
      </div>
    </div>
  );
}
