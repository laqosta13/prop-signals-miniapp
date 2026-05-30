import { useEffect, useState, type RefObject } from "react";
import type { Signal } from "../api";
import { signalUnrealizedMovePct, signalUnrealizedPnl } from "../utils/signalPnl";
import { bybitSymbol } from "../utils/signalChartLevels";

const LIVE_PNL_POLL_MS = 15_000;

async function fetchBybitLastPrice(symbol: string): Promise<number | null> {
  const pair = bybitSymbol(symbol);
  if (!pair) return null;
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair}`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      retCode?: number;
      result?: { list?: { lastPrice?: string }[] };
    };
    if (body.retCode !== 0) return null;
    const raw = body.result?.list?.[0]?.lastPrice;
    const price = raw != null ? Number(raw) : NaN;
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

type LivePnl = {
  pnl: number | null;
  movePct: number | null;
  loading: boolean;
};

export function useSignalLivePnl(
  signal: Signal,
  enabled: boolean,
  rootRef: RefObject<HTMLElement | null>,
): LivePnl {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<LivePnl>({ pnl: null, movePct: null, loading: false });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!!entry?.isIntersecting),
      { threshold: 0.05, rootMargin: "80px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootRef, signal.id]);

  useEffect(() => {
    if (!enabled || !visible) {
      setState({ pnl: null, movePct: null, loading: false });
      return;
    }

    let cancelled = false;

    const tick = async () => {
      setState((prev) => ({ ...prev, loading: prev.pnl == null }));
      const price = await fetchBybitLastPrice(signal.symbol);
      if (cancelled || price == null) {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      setState({
        pnl: signalUnrealizedPnl(signal, price),
        movePct: signalUnrealizedMovePct(signal, price),
        loading: false,
      });
    };

    void tick();
    const id = window.setInterval(() => void tick(), LIVE_PNL_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    enabled,
    visible,
    signal.id,
    signal.symbol,
    signal.direction,
    signal.status,
    signal.entry_low,
    signal.entry_high,
    signal.published_market_price,
    signal.risk_percent,
    signal.leverage,
    signal.account_size,
    signal.tracker_balance,
  ]);

  return state;
}
