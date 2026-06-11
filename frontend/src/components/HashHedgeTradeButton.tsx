import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { prepareHashHedgeTrade, type HashHedgeTradeSignal } from "../utils/hashHedgeTrade";
import { HashHedgeLogo } from "./BrandLogos";
import { InAppBrowser } from "./InAppBrowser";

type Props = {
  signal: HashHedgeTradeSignal;
  className?: string;
};

export function HashHedgeTradeButton({ signal, className = "" }: Props) {
  const copy = useThemedCopy();
  const [busy, setBusy] = useState(false);
  const [browser, setBrowser] = useState<{ url: string; hint?: string } | null>(null);

  if (signal.status !== "active") return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const { copied, url } = await prepareHashHedgeTrade(signal);
      WebApp.HapticFeedback.notificationOccurred(copied ? "success" : "warning");
      if (copied) {
        setBrowser({ url, hint: copy.hashHedgeTradeCopied });
      } else {
        WebApp.showAlert(copy.hashHedgeTradeCopyFailed);
        setBrowser({ url });
      }
    } finally {
      setBusy(false);
    }
  };

  const cls = `hashhedge-trade-btn${className ? ` ${className}` : ""}`;

  return (
    <>
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
      {browser && (
        <InAppBrowser
          url={browser.url}
          title={copy.hashHedgeTradeBtn}
          hint={browser.hint}
          onClose={() => setBrowser(null)}
        />
      )}
    </>
  );
}
