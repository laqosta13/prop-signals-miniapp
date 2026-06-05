import { useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { copyToClipboard, selectFieldText } from "../utils";

type Props = {
  memo: string;
};

export function PaymentMemoRow({ memo }: Props) {
  const [copied, setCopied] = useState(false);
  const memoRef = useRef<HTMLInputElement>(null);

  const copyMemo = async () => {
    if (!memo) return;
    const ok = await copyToClipboard(memo);
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

  if (!memo) return null;

  return (
    <div className="pay-memo">
      <p className="meta pay-memo__hint">Укажите этот код в комментарии к переводу USDT(в сети TON) (обязательно).</p>
      <div className="pay-addr-row">
        <input
          ref={memoRef}
          readOnly
          className="pay-addr pay-memo__code"
          value={memo}
          onFocus={(e) => selectFieldText(e.currentTarget)}
          onClick={(e) => selectFieldText(e.currentTarget)}
          aria-label="Код комментария к оплате"
        />
        <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyMemo()}>
          {copied ? "Скопировано ✓" : "Копировать код"}
        </button>
      </div>
    </div>
  );
}
