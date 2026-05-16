import WebApp from "@twa-dev/sdk";

const base =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? "/api" : "");

export type Signal = {
  id: number;
  created_at: string;
  closed_at: string | null;
  symbol: string;
  direction: string;
  entry_low: string | null;
  entry_high: string | null;
  stop_loss: string | null;
  take_profits: string | null;
  comment: string | null;
  status: string;
  points_percent: number;
  leverage: number | null;
  risk_percent: number | null;
  realized_pnl: number | null;
  author_telegram_id: number;
  author_username: string | null;
};

export type Me = {
  telegram_user_id: number;
  is_admin: boolean;
  username: string | null;
  notify_enabled: boolean;
};

export type Trader = {
  telegram_id: number;
  username: string | null;
  rating_percent: number;
  wins: number;
  losses: number;
  rank: number;
  win_rate: number;
};

export type ChallengeDashboard = {
  account_size: number;
  stage: number;
  balance: number;
  profit_pct: number;
  profit_target_pct: number;
  drawdown_pct: number;
  max_drawdown_pct: number;
  daily_loss_pct: number;
  max_daily_loss_pct: number;
  daily_remaining_usd: number;
  trading_days: number;
  min_trading_days: number;
  goal_balance: number;
  trades_count: number;
  winrate: number;
  total_pnl: number;
  max_leverage: string;
};

function authHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const initData = WebApp.initData;
  if (initData) h["X-Telegram-Init-Data"] = initData;
  else if (import.meta.env.DEV && import.meta.env.VITE_DEV_TELEGRAM_USER_ID) {
    h["X-Dev-Telegram-User-Id"] = import.meta.env.VITE_DEV_TELEGRAM_USER_ID;
  }
  return h;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...authHeaders(), ...init?.headers } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const fetchMe = () => api<Me>("/auth/me");
export const fetchSignals = () => api<Signal[]>("/signals");
export const fetchLeaderboard = () => api<Trader[]>("/traders/leaderboard");
export const fetchChallengeDashboard = () => api<ChallengeDashboard>("/challenge/dashboard");
export const fetchChallengeRules = () => api<Record<string, unknown>>("/challenge/rules");

export type SignalCreate = {
  symbol: string;
  direction: "long" | "short";
  entry_low?: string;
  entry_high?: string;
  stop_loss?: string;
  take_profits?: string;
  comment?: string;
  leverage?: number;
  risk_percent?: number;
};

export const createSignal = (body: SignalCreate) =>
  api<Signal>("/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const setNotifications = (enabled: boolean) =>
  api<Me>("/subscriptions/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notify_enabled: enabled }),
  });

export const updateChallenge = (body: {
  account_size?: number;
  stage?: number;
  balance?: number;
  reset_day?: boolean;
}) =>
  api<ChallengeDashboard>("/challenge/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
