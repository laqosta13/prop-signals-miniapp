import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { openHashHedgeWithSignal, type HashHedgeTradeSignal } from "../utils/hashHedgeTrade";
import { HashHedgeLogo } from "./BrandLogos";

type Props = {
  signal: HashHedgeTradeSignal;
  className?: string;
};

export function HashHedgeTradeButton({ signal, className = "" }: Props) {
  const copy = useThemedCopy();
  const [busy, setBusy] = useState(false);

  if (signal.status !== "active") return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const { copied } = await openHashHedgeWithSignal(signal);
      WebApp.HapticFeedback.notificationOccurred(copied ? "success" : "warning");
      WebApp.showAlert(copied ? copy.hashHedgeTradeCopied : copy.hashHedgeTradeCopyFailed);
    } finally {
      setBusy(false);
    }
  };

  const cls = `hashhedge-trade-btn${className ? ` ${className}` : ""}`;

  return (
    <button
      type="button"
      className={cls}
      disabled={busy}
      title={copy.hashHedgeTradeHint}
      aria-label={copy.hashHedgeTradeHint}
      onClick={(e) => void onClick(e)}
    >
      <HashHedgeLogo size={20} />
      <span>{copy.hashHedgeTradeBtn}</span>
    </button>
  );
}
