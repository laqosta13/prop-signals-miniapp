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
  tracker_balance: number | null;
  realized_pnl: number | null;
  views_count: number;
  likes_count: number;
  liked_by_me: boolean;
  author_telegram_id: number;
  author_username: string | null;
  media_image_url: string | null;
  media_video_url: string | null;
  author_avatar_url: string | null;
};

export type Me = {
  telegram_user_id: number;
  is_admin: boolean;
  username: string | null;
  notify_enabled: boolean;
};

export type TraderDayStat = {
  date: string;
  pnl_usd: number;
  rating_delta: number;
  wins: number;
  losses: number;
};

export type Trader = {
  telegram_id: number;
  username: string | null;
  rating_percent: number;
  total_pnl_usd: number;
  wins: number;
  losses: number;
  rank: number;
  win_rate: number;
  avatar_url: string | null;
  daily_stats: TraderDayStat[];
};

export type ChallengeDashboard = {
  owner_telegram_id: number;
  owner_username: string | null;
  owner_avatar_url: string | null;
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
export const fetchChallengeTrackers = () => api<ChallengeDashboard[]>("/challenge/trackers");

async function sendForm(path: string, method: string, form: FormData): Promise<Signal> {
  const res = await fetch(`${base}${path}`, { method, headers: authHeaders(), body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const createSignalWithMedia = (form: FormData) => sendForm("/signals", "POST", form);

export const updateSignalWithMedia = (signalId: number, form: FormData) =>
  sendForm(`/signals/${signalId}`, "PUT", form);

export const recordSignalView = (signalId: number) =>
  api<{ views_count: number }>(`/signals/${signalId}/view`, { method: "POST" });

export const toggleSignalLike = (signalId: number) =>
  api<{ liked: boolean; likes_count: number }>(`/signals/${signalId}/like`, { method: "POST" });

export async function deleteSignal(signalId: number): Promise<void> {
  const res = await fetch(`${base}/signals/${signalId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

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
