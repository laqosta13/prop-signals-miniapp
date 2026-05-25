import WebApp from "@twa-dev/sdk";

const base =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? "/api" : "");

export type SignalSupplement = {
  id: number;
  created_at: string;
  comment: string | null;
  media_image_url: string | null;
  media_video_url: string | null;
};

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
  entry_filled_at?: string | null;
  views_count: number;
  likes_count: number;
  liked_by_me: boolean;
  author_telegram_id: number;
  author_username: string | null;
  author_display_name: string | null;
  media_image_url: string | null;
  media_video_url: string | null;
  author_avatar_url: string | null;
  supplements?: SignalSupplement[];
};

export type Me = {
  telegram_user_id: number;
  is_admin: boolean;
  username: string | null;
  notify_enabled: boolean;
  notify_news_enabled: boolean;
  subscription_until: string | null;
  subscription_active: boolean;
  referral_code: string;
  member_since: string | null;
  paid_subscription: boolean;
  can_write_review: boolean;
  review_write_blocked_reason: string | null;
  days_until_review: number | null;
};

export type SubscriptionInfo = {
  usdt_ton_address: string;
  week_usd: number;
  month_usd: number;
  trial_days: number;
  referral_bonus_days: number;
  subscription_until: string | null;
  subscription_active: boolean;
  referral_code: string;
  referral_link_hint: string;
};

export type TraderDayStat = {
  date: string;
  pnl_usd: number;
  rating_delta: number;
  wins: number;
  losses: number;
};

export type RankHistoryEntry = {
  week_label: string;
  weekly_pct: number;
  rank_id: number;
  rank_name: string;
  confirmed: boolean;
};

export type TraderRank = {
  current_rank_id: number;
  current_rank_name: string;
  weekly_pct: number;
  is_confirmed: boolean;
  confirm_deadline: string | null;
  consecutive_loss_weeks: number;
  shield_used_this_month: boolean;
  shield_active: boolean;
  rank_applied_this_week: boolean;
  pending_rank_penalty: boolean;
  rank_history: RankHistoryEntry[];
};

export type Trader = {
  telegram_id: number;
  username: string | null;
  display_name: string | null;
  rating_percent: number;
  total_pnl_usd: number;
  wins: number;
  losses: number;
  rank: number;
  win_rate: number;
  avatar_url: string | null;
  daily_stats: TraderDayStat[];
  trader_rank: TraderRank | null;
};

export type ChallengeDashboard = {
  owner_telegram_id: number;
  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  account_size: number;
  stage: number;
  balance: number;
  profit_pct: number;
  profit_target_pct: number;
  profit_target_unlimited?: boolean;
  drawdown_pct: number;
  max_drawdown_pct: number;
  daily_loss_pct: number;
  max_daily_loss_pct: number;
  daily_remaining_usd: number;
  trading_days: number;
  min_trading_days: number;
  min_trading_days_unlimited?: boolean;
  goal_balance: number;
  trades_count: number;
  winrate: number;
  total_pnl: number;
  max_leverage: string;
};

export type HashHedgeStageRules = {
  stage: number;
  profit_target_pct: number | null;
  profit_target_unlimited: boolean;
  max_daily_loss_pct: number;
  max_drawdown_pct: number;
  min_trading_days: number | null;
  min_trading_days_unlimited: boolean;
  trading_period_unlimited: boolean;
  max_leverage: string;
};

export type HashHedgeRuleRow = {
  id: string;
  label: string;
  hint: string;
  values: string[];
};

export type HashHedgeRules = {
  firm: string;
  url: string;
  account_sizes: number[];
  stages: HashHedgeStageRules[];
  table_rows: HashHedgeRuleRow[];
};

export type Review = {
  id: number;
  created_at: string;
  updated_at: string;
  author_telegram_id: number;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  text: string;
  rating: number;
  image_url: string | null;
  is_mine: boolean;
};

export type NewsPost = {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  author_telegram_id: number;
  author_display_name: string | null;
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

export const fetchSubscriptionInfo = () => api<SubscriptionInfo>("/subscriptions/info");

export const submitPayment = (plan: "week" | "month", tx_id: string) =>
  api<SubscriptionInfo>("/subscriptions/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, tx_id }),
  });

export const fetchMe = () => api<Me>("/auth/me");
export const fetchSignals = () => api<Signal[]>("/signals");
export const fetchSignalsPreview = () => api<Signal[]>("/signals/preview");
export const fetchLeaderboard = () => api<Trader[]>("/traders/leaderboard");
export const fetchTraderRank = (telegramId: number) => api<TraderRank>(`/traders/${telegramId}/rank`);
export const fetchRankPending = () =>
  api<{ needs_confirm: boolean; rank: TraderRank }>("/traders/me/rank-pending");
export const confirmMyRank = () => api<TraderRank>("/traders/me/rank/confirm", { method: "POST" });
export const activateRankShield = () => api<TraderRank>("/traders/me/rank/shield", { method: "POST" });
export const fetchChallengeTrackers = () => api<ChallengeDashboard[]>("/challenge/trackers");
export const fetchChallengeRules = () => api<HashHedgeRules>("/challenge/rules");

export const fetchReviews = () => api<Review[]>("/reviews");

export const createReview = (form: FormData) => sendForm<Review>("/reviews", "POST", form);

export const updateReview = (id: number, form: FormData) => sendForm<Review>(`/reviews/${id}`, "PUT", form);

export async function deleteReview(id: number): Promise<void> {
  const res = await fetch(`${base}/reviews/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
}

export const fetchNews = () => api<NewsPost[]>("/news");

export const createNewsPost = (form: FormData) => sendForm<NewsPost>("/news", "POST", form);

export const updateNewsPost = (id: number, form: FormData) => sendForm<NewsPost>(`/news/${id}`, "PUT", form);

export async function deleteNewsPost(id: number): Promise<void> {
  const res = await fetch(`${base}/news/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
}

async function sendForm<T>(path: string, method: string, form: FormData): Promise<T> {
  const res = await fetch(`${base}${path}`, { method, headers: authHeaders(), body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

import type { UploadProgress } from "./utils/upload";

export type { UploadProgress };

function sendFormWithProgress<T>(
  path: string,
  method: string,
  form: FormData,
  onProgress?: (p: UploadProgress) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${base}${path}`);

    const headers = authHeaders();
    if (headers instanceof Headers) {
      headers.forEach((v, k) => xhr.setRequestHeader(k, v));
    } else if (Array.isArray(headers)) {
      for (const [k, v] of headers) xhr.setRequestHeader(k, v);
    } else {
      for (const [k, v] of Object.entries(headers)) {
        if (v != null) xhr.setRequestHeader(k, String(v));
      }
    }

    xhr.upload.onprogress = (ev) => {
      if (!onProgress) return;
      if (ev.lengthComputable && ev.total > 0) {
        onProgress({
          loaded: ev.loaded,
          total: ev.total,
          percent: Math.min(100, Math.round((ev.loaded / ev.total) * 100)),
        });
      } else {
        onProgress({ loaded: ev.loaded, total: 0, percent: ev.loaded > 0 ? 1 : 0 });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("Неверный ответ сервера"));
        }
        return;
      }
      reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Ошибка сети при загрузке"));
    xhr.onabort = () => reject(new Error("Загрузка отменена"));
    xhr.send(form);
  });
}

export const createSignalWithMedia = (
  form: FormData,
  onProgress?: (p: UploadProgress) => void,
) =>
  onProgress
    ? sendFormWithProgress<Signal>("/signals", "POST", form, onProgress)
    : sendForm<Signal>("/signals", "POST", form);

export const updateSignalWithMedia = (
  signalId: number,
  form: FormData,
  onProgress?: (p: UploadProgress) => void,
) =>
  onProgress
    ? sendFormWithProgress<Signal>(`/signals/${signalId}`, "PUT", form, onProgress)
    : sendForm<Signal>(`/signals/${signalId}`, "PUT", form);

export const appendSignalSupplement = (signalId: number, form: FormData) =>
  sendForm<Signal>(`/signals/${signalId}/supplement`, "POST", form);

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

export const setNotifications = (patch: { notify_enabled?: boolean; notify_news_enabled?: boolean }) =>
  api<Me>("/subscriptions/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
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
