type Props = {
  symbol: string;
  onSymbolChange: (value: string) => void;
  direction: "long" | "short";
  onDirectionChange: (dir: "long" | "short") => void;
};

export function SignalFormDealSection({ symbol, onSymbolChange, direction, onDirectionChange }: Props) {
  return (
    <div className="signal-form__deal">
      <label className="signal-form__deal-symbol">
        <span className="signal-form__deal-k">Тикер</span>
        <input
          className="signal-form__symbol-input"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          required
          autoCapitalize="characters"
        />
      </label>
      <div className="dir-toggle dir-toggle--compact" role="group" aria-label="Направление">
        <button
          type="button"
          className={direction === "long" ? "active long" : ""}
          onClick={() => onDirectionChange("long")}
        >
          Long
        </button>
        <button
          type="button"
          className={direction === "short" ? "active short" : ""}
          onClick={() => onDirectionChange("short")}
        >
          Short
        </button>
      </div>
    </div>
  );
}
