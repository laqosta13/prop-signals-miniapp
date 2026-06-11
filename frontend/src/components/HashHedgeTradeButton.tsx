import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import type { Signal } from "../api";
import { useThemedCopy } from "../hooks/useThemedCopy";
import {
  hashHedgeLevelsFromSignal,
  prepareHashHedgeTrade,
  type HashHedgeTradeSignal,
} from "../utils/hashHedgeTrade";
import { signalStopMovePct } from "../utils/signalPnl";
import { HashHedgeLogo } from "./BrandLogos";
import { InAppBrowser } from "./InAppBrowser";

type Props = {
  signal: HashHedgeTradeSignal;
  className?: string;
};

export function HashHedgeTradeButton({ signal, className = "" }: Props) {
  const copy = useThemedCopy();
  const [busy, setBusy] = useState(false);
  const [browser, setBrowser] = useState<{
    url: string;
    hint?: string;
    levels: ReturnType<typeof hashHedgeLevelsFromSignal>;
  } | null>(null);

  if (signal.status !== "active") return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const { copied, url } = await prepareHashHedgeTrade(signal);
      const levels = {
        ...hashHedgeLevelsFromSignal(signal),
        stopMovePct: signalStopMovePct(signal as Signal),
      };
      WebApp.HapticFeedback.notificationOccurred(copied ? "success" : "warning");
      if (copied) {
        setBrowser({ url, hint: copy.hashHedgeTradeCopied, levels });
      } else {
        WebApp.showAlert(copy.hashHedgeTradeCopyFailed);
        setBrowser({ url, levels });
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
          levels={browser.levels}
          onClose={() => setBrowser(null)}
        />
      )}
    </>
  );
}
