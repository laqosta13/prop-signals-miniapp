type Props = {
  entry: string;
  stop: string;
  target: string;
  riskPct: string;
  priceLoading?: boolean;
  onEntryChange: (value: string) => void;
  onStopChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onRiskPctChange: (value: string) => void;
  entryPlaceholder?: string;
};

export function SignalLevelsFields({
  entry,
  stop,
  target,
  riskPct,
  priceLoading = false,
  onEntryChange,
  onStopChange,
  onTargetChange,
  onRiskPctChange,
  entryPlaceholder = "0.00",
}: Props) {
  return (
    <div className="levels-grid-form">
      <div>
        <label className="field-label">Вход</label>
        <input
          value={entry}
          onChange={(e) => onEntryChange(e.target.value)}
          placeholder={priceLoading ? "Загрузка…" : entryPlaceholder}
          disabled={priceLoading}
        />
      </div>
      <div>
        <label className="field-label">Стоп</label>
        <input value={stop} onChange={(e) => onStopChange(e.target.value)} placeholder="Цена" />
      </div>
      <div>
        <label className="field-label">%</label>
        <input
          value={riskPct}
          onChange={(e) => onRiskPctChange(e.target.value)}
          placeholder="1"
          inputMode="decimal"
          aria-label="Процент до стопа"
        />
      </div>
      <div>
        <label className="field-label">Цель</label>
        <input value={target} onChange={(e) => onTargetChange(e.target.value)} placeholder="Цена" />
      </div>
      <p className="meta levels-grid-form__hint">R:R 1:3 — % до стопа, цель в 3 раза дальше (можно править вручную)</p>
    </div>
  );
}
