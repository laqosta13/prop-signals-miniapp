import { LEVERAGE_OPTIONS, onLeverageFieldChange, parseLeverage } from "../utils/signalForm";

type Props = {
  leverage: string;
  risk: string;
  onLeverageChange: (leverage: string, risk: string) => void;
};

export function LeveragePicker({ leverage, risk, onLeverageChange }: Props) {
  const current = parseLeverage(leverage);

  const pick = (lev: number) => {
    const next = onLeverageFieldChange(String(lev), leverage, risk);
    onLeverageChange(next.leverage, next.risk);
  };

  return (
    <div className="leverage-picker" role="group" aria-label="Плечо">
      {LEVERAGE_OPTIONS.map((lev) => (
        <button
          key={lev}
          type="button"
          className={current === lev ? "active" : ""}
          aria-pressed={current === lev}
          onClick={() => pick(lev)}
        >
          {lev}x
        </button>
      ))}
    </div>
  );
}
