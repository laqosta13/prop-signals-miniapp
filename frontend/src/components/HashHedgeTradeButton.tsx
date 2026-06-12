import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { HASH_HEDGE_TRADE_URL } from "../data/hashhedgeTrade";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { formatHashHedgeTradeClipboard, type HashHedgeTradeSignal } from "../utils/hashHedgeTrade";
import { copyToClipboard } from "../utils/clipboard";
import { openExternalLink } from "../utils/openExternalLink";
import { HashHedgeLogo } from "./BrandLogos";

type Props = {
  signal: HashHedgeTradeSignal;
  className?: string;
};

export function HashHedgeTradeButton({ signal, className = "" }: Props) {
  const copy = useThemedCopy();
  const [busy, setBusy] = useState(false);

  if (signal.status !== "active") return null;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    // openLink нужно вызвать сразу в обработчике клика (TTL ~1 с в Telegram).
    openExternalLink(HASH_HEDGE_TRADE_URL);
    void (async () => {
      try {
        const copied = await copyToClipboard(formatHashHedgeTradeClipboard(signal));
        WebApp.HapticFeedback.notificationOccurred(copied ? "success" : "warning");
        if (!copied) {
          WebApp.showAlert(copy.hashHedgeTradeCopyFailed);
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const cls = `hashhedge-trade-btn${className ? ` ${className}` : ""}`;

  return (
    <button
      type="button"
      className={cls}
      disabled={busy}
      title={copy.hashHedgeTradeHint}
      aria-label={copy.hashHedgeTradeHint}
      onClick={onClick}
    >
      <HashHedgeLogo size={20} />
      <span>{copy.hashHedgeTradeBtn}</span>
    </button>
  );
}
