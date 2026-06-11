import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { copyToClipboard } from "../utils";
import { formatSignedMovePct } from "../utils/signalChartLevels";

type LevelKind = "entry" | "stop" | "target";

type Props = {
  entry: string;
  stopLoss: string | null;
  target: string;
  stopMovePct?: number | null;
  showCopyHint?: boolean;
  compact?: boolean;
};

type CopiedKey = LevelKind | `${LevelKind}-${number}`;

function copyable(raw: string | null | undefined): raw is string {
  return !!raw && raw !== "—";
}

function splitTargets(target: string): string[] {
  if (!copyable(target)) return [];
  return target
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SignalLevelsGrid({
  entry,
  stopLoss,
  target,
  stopMovePct,
  showCopyHint = true,
  compact = false,
}: Props) {
  const copy = useThemedCopy();
  const [copied, setCopied] = useState<CopiedKey | null>(null);
  const targets = splitTargets(target);
  const multiTarget = targets.length > 1;

  const onCopy = async (key: CopiedKey, raw: string | null | undefined) => {
    if (!copyable(raw)) return;
    const ok = await copyToClipboard(raw.trim());
    WebApp.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    if (!ok) return;
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const valueClass = (key: CopiedKey, extra?: string) =>
    `levels-grid__value${extra ? ` ${extra}` : ""}${copied === key ? " levels-grid__value--copied" : ""}`;

  const renderValue = (key: CopiedKey, raw: string, extraClass?: string) => (
    <button
      type="button"
      className={valueClass(key, extraClass)}
      disabled={!copyable(raw)}
      title={copyable(raw) ? copy.levelsCopyTap : undefined}
      onClick={() => void onCopy(key, raw)}
    >
      {copied === key ? copy.levelsCopied : raw}
    </button>
  );

  const hint = showCopyHint ? copy.levelsCopyTap : null;
  const rootClass = `levels-grid${compact ? " levels-grid--compact" : ""}`;

  return (
    <div className={rootClass}>
      <div>
        <span className="levels-grid__label">
          вход
          {hint && <em className="levels-grid__copy-hint">{hint}</em>}
        </span>
        {renderValue("entry", entry)}
      </div>
      <div className="stop">
        <span className="levels-grid__label">
          стоп
          {hint && <em className="levels-grid__copy-hint">{hint}</em>}
        </span>
        <div className="levels-grid__value-row">
          {renderValue("stop", stopLoss || "—", "levels-grid__value--stop")}
          {stopMovePct != null && (
            <span className="levels-grid__pct"> {formatSignedMovePct(stopMovePct)}</span>
          )}
        </div>
      </div>
      <div className="target">
        <span className="levels-grid__label">
          цель
          {hint && <em className="levels-grid__copy-hint">{hint}</em>}
        </span>
        {multiTarget ? (
          <div className="levels-grid__targets">
            {targets.map((tp, i) => (
              <span key={`${tp}-${i}`}>{renderValue(`target-${i}`, tp, "levels-grid__value--target")}</span>
            ))}
          </div>
        ) : (
          renderValue("target", target, "levels-grid__value--target")
        )}
      </div>
    </div>
  );
}
