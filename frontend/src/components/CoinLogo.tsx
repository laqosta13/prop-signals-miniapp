import { useMemo, useState } from "react";
import { coinIconUrls, symbolBase, symbolHue } from "../utils/coinSymbol";

type Props = {
  symbol: string;
  size?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
};

export function CoinLogo({ symbol, size = 24, showLabel = false, label, className = "" }: Props) {
  const urls = useMemo(() => coinIconUrls(symbol), [symbol]);
  const [urlIndex, setUrlIndex] = useState(0);
  const base = symbolBase(symbol);
  const text = label ?? base;
  const failed = urlIndex >= urls.length;
  const hue = symbolHue(symbol);

  const bump = () => setUrlIndex((i) => i + 1);

  return (
    <span className={`coin-logo${className ? ` ${className}` : ""}`}>
      {failed ? (
        <span
          className="coin-logo__fallback"
          style={{ width: size, height: size, background: `hsl(${hue} 55% 38%)` }}
          aria-hidden
        >
          {base.slice(0, 3)}
        </span>
      ) : (
        <span className="coin-logo__img-wrap" style={{ width: size, height: size }}>
          <img
            src={urls[urlIndex]}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            onError={bump}
          />
        </span>
      )}
      {showLabel ? <span className="coin-logo__label">{text}</span> : null}
    </span>
  );
}
