import { useEffect, useId, useRef, useState } from "react";
import { fetchMarketSymbols } from "../../api";
import { CoinLogo } from "../CoinLogo";
import { symbolBase } from "../../utils/coinSymbol";

type Props = {
  symbol: string;
  onSymbolChange: (value: string) => void;
  /** Подсказки только после ручного ввода (не при дефолтном BTCUSDT при открытии). */
  suggestOnInput?: boolean;
  direction: "long" | "short";
  onDirectionChange: (dir: "long" | "short") => void;
};

export function SignalFormDealSection({
  symbol,
  onSymbolChange,
  suggestOnInput = false,
  direction,
  onDirectionChange,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!suggestOnInput) {
      setSuggestions([]);
      setSuggestOpen(false);
      setLoading(false);
      return;
    }

    const q = symbol.trim().toUpperCase();
    if (q.length < 1) {
      setSuggestions([]);
      setSuggestOpen(false);
      setLoading(false);
      return;
    }

    const t = window.setTimeout(() => {
      const id = ++reqRef.current;
      setLoading(true);
      void fetchMarketSymbols(q)
        .then((r) => {
          if (reqRef.current !== id) return;
          setSuggestions(r.symbols);
          setSuggestOpen(r.symbols.length > 0);
        })
        .catch(() => {
          if (reqRef.current !== id) return;
          setSuggestions([]);
          setSuggestOpen(false);
        })
        .finally(() => {
          if (reqRef.current === id) setLoading(false);
        });
    }, 180);

    return () => clearTimeout(t);
  }, [symbol, suggestOnInput]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (sym: string) => {
    onSymbolChange(sym);
    setSuggestOpen(false);
  };

  return (
    <div className="signal-form__deal">
      <label className="signal-form__deal-symbol">
        <span className="signal-form__deal-k">Тикер</span>
        <div className="signal-form__symbol-wrap" ref={wrapRef}>
          {symbol.trim().length >= 2 ? (
            <CoinLogo symbol={symbol} size={20} className="signal-form__symbol-logo" />
          ) : null}
          <input
            className="signal-form__symbol-input"
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            onFocus={() => {
              if (suggestions.length > 0) setSuggestOpen(true);
            }}
            required
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
            aria-controls={suggestOpen ? listId : undefined}
            placeholder="BTC"
          />
          {loading ? <span className="signal-form__symbol-loading" aria-hidden>…</span> : null}
          {suggestOpen && suggestions.length > 0 ? (
            <ul id={listId} className="signal-form__symbol-suggest" role="listbox">
              {suggestions.map((sym) => (
                <li key={sym} role="option">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(sym)}>
                    <CoinLogo symbol={sym} size={18} showLabel label={symbolBase(sym)} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>
      <div className="dir-toggle dir-toggle--compact" role="group" aria-label="Направление">
        <button
          type="button"
          className={direction === "long" ? "active long" : ""}
          onClick={() => onDirectionChange("long")}
        >
          <span className="dir-toggle__arrow">↑</span> Long
        </button>
        <button
          type="button"
          className={direction === "short" ? "active short" : ""}
          onClick={() => onDirectionChange("short")}
        >
          <span className="dir-toggle__arrow">↓</span> Short
        </button>
      </div>
    </div>
  );
}
