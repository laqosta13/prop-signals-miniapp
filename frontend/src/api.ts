import WebApp from "@twa-dev/sdk";

const base =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? "/api" : "");

export type Signal = {
  id: number;
  created_at: string;
  symbol: string;
  direction: string;
  entry_low: string | null;
  entry_high: string | null;
  stop_loss: string | null;
  take_profits: string | null;
  comment: string | null;
  status: string;
  author_telegram_id: number;
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

export type Me = { telegram_user_id: number; is_admin: boolean };

export async function fetchMe(): Promise<Me> {
  const res = await fetch(`${base}/auth/me`, { headers: authHeaders() });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json();
}

export async function fetchSignals(): Promise<Signal[]> {
  const res = await fetch(`${base}/signals`, { headers: authHeaders() });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json();
}
