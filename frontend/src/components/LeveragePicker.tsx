import { LEVERAGE_OPTIONS, onLeveragePick, parseLeverage } from "../utils/signalForm";

type Props = {
  leverage: string;
  onLeverageChange: (leverage: string) => void;
};

export function LeveragePicker({ leverage, onLeverageChange }: Props) {
  const current = parseLeverage(leverage);

  const pick = (lev: number) => {
    if (lev === current) return;
    onLeverageChange(onLeveragePick(lev));
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
