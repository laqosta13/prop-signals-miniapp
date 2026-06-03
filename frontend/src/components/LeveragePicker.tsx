import { LEVERAGE_OPTIONS, onLeveragePick, parseLeverage } from "../utils/signalForm";

type Props = {
  leverage: string;
  onLeverageChange: (leverage: string) => void;
  /** Макс. плечо по рангу (1–5). */
  maxLeverage?: number;
};

export function LeveragePicker({ leverage, onLeverageChange, maxLeverage = 5 }: Props) {
  const cap = Math.max(1, Math.min(5, maxLeverage));
  const current = Math.min(parseLeverage(leverage), cap);

  const pick = (lev: number) => {
    if (lev > cap || lev === current) return;
    onLeverageChange(onLeveragePick(lev));
  };

  return (
    <div className="leverage-picker" role="group" aria-label="Плечо">
      {LEVERAGE_OPTIONS.map((lev) => {
        const locked = lev > cap;
        return (
          <button
            key={lev}
            type="button"
            className={[current === lev ? "active" : "", locked ? "leverage-picker__btn--locked" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={current === lev}
            aria-disabled={locked}
            disabled={locked}
            title={locked ? `Доступно с более высоким рангом (сейчас до ${cap}×)` : undefined}
            onClick={() => pick(lev)}
          >
            {lev}x
          </button>
        );
      })}
    </div>
  );
}
