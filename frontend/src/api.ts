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

function authHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const initData = WebApp.initData;
  if (initData) {
    h["X-Telegram-Init-Data"] = initData;
  } else if (import.meta.env.DEV && import.meta.env.VITE_DEV_TELEGRAM_USER_ID) {
    h["X-Dev-Telegram-User-Id"] = import.meta.env.VITE_DEV_TELEGRAM_USER_ID;
  }
  return h;
}

export async function fetchMe(): Promise<Me> {
  const res = await fetch(`${base}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchSignals(): Promise<Signal[]> {
  const res = await fetch(`${base}/signals`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchLeaderboard(): Promise<Trader[]> {
  const res = await fetch(`${base}/traders/leaderboard`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type SignalCreate = {
  symbol: string;
  direction: "long" | "short";
  entry_low?: string;
  entry_high?: string;
  stop_loss?: string;
  take_profits?: string;
  comment?: string;
};

export async function createSignal(body: SignalCreate): Promise<Signal> {
  const res = await fetch(`${base}/signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setNotifications(enabled: boolean): Promise<Me> {
  const res = await fetch(`${base}/subscriptions/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ notify_enabled: enabled }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
