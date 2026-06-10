import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { copyToClipboard } from "../utils";
import { formatSignedMovePct } from "../utils/signalChartLevels";

type LevelKind = "entry" | "stop" | "target";

type Props = {
  entry: string;
  stopLoss: string | null;
  target: string;
  stopMovePct?: number | null;
};

function copyable(raw: string | null | undefined): raw is string {
  return !!raw && raw !== "—";
}

export function SignalLevelsGrid({ entry, stopLoss, target, stopMovePct }: Props) {
  const [copied, setCopied] = useState<LevelKind | null>(null);

  const onCopy = async (kind: LevelKind, raw: string | null | undefined) => {
    if (!copyable(raw)) return;
    const ok = await copyToClipboard(raw.trim());
    WebApp.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    if (!ok) return;
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const valueClass = (kind: LevelKind, extra?: string) =>
    `levels-grid__value${extra ? ` ${extra}` : ""}${copied === kind ? " levels-grid__value--copied" : ""}`;

  return (
    <div className="levels-grid">
      <div>
        <span>вход</span>
        <button
          type="button"
          className={valueClass("entry")}
          disabled={!copyable(entry)}
          title={copyable(entry) ? "Скопировать" : undefined}
          onClick={() => void onCopy("entry", entry)}
        >
          {entry}
        </button>
      </div>
      <div className="stop">
        <span>стоп</span>
        <div className="levels-grid__value-row">
          <button
            type="button"
            className={valueClass("stop", "levels-grid__value--stop")}
            disabled={!copyable(stopLoss)}
            title={copyable(stopLoss) ? "Скопировать" : undefined}
            onClick={() => void onCopy("stop", stopLoss)}
          >
            {stopLoss || "—"}
          </button>
          {stopMovePct != null && (
            <span className="levels-grid__pct"> {formatSignedMovePct(stopMovePct)}</span>
          )}
        </div>
      </div>
      <div className="target">
        <span>цель</span>
        <button
          type="button"
          className={valueClass("target", "levels-grid__value--target")}
          disabled={!copyable(target)}
          title={copyable(target) ? "Скопировать" : undefined}
          onClick={() => void onCopy("target", target)}
        >
          {target}
        </button>
      </div>
    </div>
  );
}
