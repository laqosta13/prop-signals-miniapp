import {
  ACCOUNT_STOP_MIN_STEP,
  accountRiskToPriceStopPct,
  priceStopToAccountRiskPct,
} from "./dailyStopLimit";
import { formatPriceRiskFromAccountStop } from "./signalFormLimits";
import { formatRiskPct, parseRiskPctValue } from "./signalLevels";

export type AccountStopContext = {
  accountStopSel: number | null;
  entry: string;
  dailyRemaining?: number;
  riskPct: string;
  stakePct: number;
  leverage: number;
};

/** Текущий % риска счёта: выбор на бегунке или пересчёт из цены стопа. */
export function resolveAccountStopPct(ctx: AccountStopContext): number | null {
  if (ctx.accountStopSel != null && ctx.accountStopSel >= ACCOUNT_STOP_MIN_STEP) {
    return ctx.accountStopSel;
  }
  if (!ctx.entry || ctx.dailyRemaining == null) return null;
  const inferred = priceStopToAccountRiskPct(
    parseRiskPctValue(ctx.riskPct),
    ctx.stakePct,
    ctx.leverage,
  );
  if (inferred < ACCOUNT_STOP_MIN_STEP) return null;
  return Math.min(ctx.dailyRemaining, inferred);
}

export function priceRiskLabelFromAccountStop(
  accountPct: number,
  stakePct: number,
  leverage: number,
): string {
  return formatPriceRiskFromAccountStop(accountPct, stakePct, leverage);
}

export function preserveAccountStopOnLeverageChange(opts: {
  riskPct: string;
  prevStakePct: number;
  prevLeverage: number;
  nextStakePct: number;
  nextLeverage: number;
  dailyRemaining: number;
}): string | null {
  const account = priceStopToAccountRiskPct(
    parseRiskPctValue(opts.riskPct),
    opts.prevStakePct,
    opts.prevLeverage,
  );
  const clamped = Math.min(account, Math.max(0, opts.dailyRemaining));
  if (clamped < ACCOUNT_STOP_MIN_STEP) return null;
  const pricePct = accountRiskToPriceStopPct(clamped, opts.nextStakePct, opts.nextLeverage);
  return pricePct > 0 ? formatRiskPct(Math.max(ACCOUNT_STOP_MIN_STEP, pricePct)) : null;
}
