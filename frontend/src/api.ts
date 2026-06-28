import WebApp from "@twa-dev/sdk";
import type { UploadProgress } from "./utils/upload";
import { mediaBytesInForm, parseUploadError } from "./utils/upload";

export type { UploadProgress };

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
  number: number;
  created_at: string;
  closed_at: string | null;
  close_reason: string | null;
  closed_exit_price: number | null;
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
  account_size: number | null;
  realized_pnl: number | null;
  entry_filled_at?: string | null;
  published_market_price?: number | null;
  published_market_source?: string | null;
  views_count: number;
  likes_count: number;
  liked_by_me: boolean;
  author_telegram_id: number;
  author_username: string | null;
  author_display_name: string | null;
  media_image_url: string | null;
  media_video_url: string | null;
  author_avatar_url: string | null;
  author_rank?: TraderRank | null;
  supplements?: SignalSupplement[];
};

export type Me = {
  telegram_user_id: number;
  is_admin: boolean;
  is_super_admin: boolean;
  can_publish_main_feed: boolean;
  can_publish_candidate: boolean;
  username: string | null;
  notify_enabled: boolean;
  notify_news_enabled: boolean;
  notify_push_active: boolean;
  subscription_until: string | null;
  subscription_active: boolean;
  test_mode_active: boolean;
  test_mode_until: string | null;
  test_mode_days_left: number;
  referral_code: string;
  member_since: string | null;
  paid_subscription: boolean;
  can_write_review: boolean;
  review_write_blocked_reason: string | null;
  days_until_review: number | null;
};

export type SupportInfo = {
  live_chat_enabled: boolean;
  username: string;
  url: string;
  available: boolean;
};

export type SupportMessage = {
  id: number;
  direction: "user" | "staff";
  text: string;
  created_at: string;
};

export type SubscriptionInfo = {
  usdt_ton_address: string;
  payment_memo: string;
  week_usd: number;
  month_usd: number;
  trial_days: number;
  referral_bonus_days: number;
  subscription_until: string | null;
  subscription_active: boolean;
  trial_used: boolean;
  test_mode_active: boolean;
  test_mode_until: string | null;
  test_mode_days_left: number;
  referral_code: string;
  referral_link: string;
  referral_share_text: string;
  bot_username: string;
  referral_link_hint: string;
  subscription_pause_hint: string;
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

export type VolnovoiStyle = {
  ready: boolean;
  sample_size: number;
  archetype: string;
  title: string;
  tags: string[];
  headline: string;
  description: string;
  stats_line: string;
};

export type TraderRank = {
  current_rank_id: number;
  current_rank_name: string;
  weekly_pct: number;
  consecutive_loss_weeks: number;
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
  volnovoi_style?: VolnovoiStyle | null;
  is_aggregate?: boolean;
  active_signals?: CultCandidateActiveSignal[];
  pool_share_usd?: number;
};

export type CultChannel = {
  id: number;
  title: string;
  username: string;
  channel_url: string;
  rating_percent: number;
  wins: number;
  losses: number;
  rank: number;
  win_rate: number;
  connected_at: string;
  daily_stats: TraderDayStat[];
};

export type CultCandidateActiveSignal = {
  id: number;
  symbol: string;
  direction: string;
  entry: string;
  level_label: string;
  stake_percent: number;
  leverage: number;
  stop_loss: string | null;
  take_profits: string | null;
  in_market: boolean;
  awaiting_entry: boolean;
  entry_low: string | null;
  entry_high: string | null;
  created_at: string | null;
  entry_filled_at: string | null;
};

export type CultCandidateFormSnapshot = {
  balance: number;
  account_size: number;
  daily_loss_usd: number;
  daily_trades_count: number;
  daily_trades_limit: number;
  current_rank_id: number;
  current_rank_name: string;
  rank_max_stake_pct: number;
  rank_max_leverage: number;
  daily_stop_reserved_rank_pct: number;
  daily_stop_remaining_rank_pct: number;
  stake_pool_burned_pct: number;
  stake_pool_capacity_pct: number;
  stake_pool_used_pct: number;
  stake_pool_remaining_pct: number;
  rank_entry_locked?: boolean;
  max_stake_pct: number;
};

export type CultCandidateClosedSignal = {
  id: number;
  symbol: string;
  direction: string;
  status: string;
  move_pct: number;
  exit_price: number | null;
  stake_percent: number;
  closed_at: string;
};

export type CultCandidate = {
  telegram_user_id: number;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  rating_percent: number;
  wins: number;
  losses: number;
  rank: number;
  win_rate: number;
  joined_at: string;
  daily_stats: TraderDayStat[];
  active_signals: CultCandidateActiveSignal[];
  closed_signals: CultCandidateClosedSignal[];
  trader_rank: TraderRank | null;
  volnovoi_style?: VolnovoiStyle | null;
  is_me: boolean;
  pool_share_usd?: number;
  bybit_balance_usd?: number | null;
  outside_trade?: boolean;
};

export type PoolStats = {
  balance: number;
  project_usd: number;
  traders_usd: number;
  candidates_usd: number;
};

export const fetchCultCandidateSignal = (signalId: number) =>
  api<Signal>(`/cult-candidates/signals/${signalId}`);

export type CultCandidateSubscriptionInfo = {
  usdt_ton_address: string;
  payment_memo: string;
  subscription_usd: number;
  subscription_days: number;
  cult_subscription_until: string | null;
  cult_subscription_active: boolean;
  test_mode_active: boolean;
  test_mode_until: string | null;
  test_mode_days_left: number;
};

export type CultCandidateMe = {
  is_candidate: boolean;
  display_name: string | null;
  can_join: boolean;
  blockers: string[];
  main_feed_publisher: boolean;
  bybit_configured: boolean;
  cult_subscription_active: boolean;
  cult_subscription_until: string | null;
  test_mode_active: boolean;
  test_mode_until: string | null;
  test_mode_days_left: number;
};

export type SignalFormSnapshot = {
  tracker_configured: boolean;
  balance: number;
  account_size: number;
  daily_loss_usd: number;
  daily_trades_count: number;
  daily_trades_limit: number;
  current_rank_id: number;
  current_rank_name: string;
  rank_max_stake_pct: number;
  rank_max_leverage: number;
  daily_stop_reserved_rank_pct: number;
  daily_stop_remaining_rank_pct: number;
  stake_pool_used_pct: number;
  stake_pool_remaining_pct: number;
  rank_entry_locked: boolean;
  max_stake_pct: number;
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
  daily_loss_usd: number;
  max_daily_loss_pct: number;
  daily_remaining_usd: number;
  daily_stop_reserved_rank_pct?: number;
  daily_stop_remaining_rank_pct?: number;
  daily_trades_count: number;
  daily_trades_limit: number;
  trading_days: number;
  min_trading_days: number;
  min_trading_days_unlimited?: boolean;
  goal_balance: number;
  trades_count: number;
  winrate: number;
  total_pnl: number;
  max_leverage: string;
  prop_screenshot_url: string | null;
  prop_screenshot_synced_at: string | null;
  prop_sync_available: boolean;
  current_rank_id: number;
  current_rank_name: string;
  rank_max_stake_pct: number;
  rank_max_leverage: number;
  stake_pool_used_pct: number;
  stake_pool_remaining_pct: number;
  rank_entry_locked?: boolean;
  max_stake_pct: number;
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

export type NewsLinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
};

export type NewsPost = {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  link: NewsLinkPreview | null;
  author_telegram_id: number;
  author_display_name: string | null;
  pinned?: boolean;
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

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    /* не JSON */
  }
  const trimmed = text.trim();
  if (/<!doctype html/i.test(trimmed) || trimmed.includes("503 Service Unavailable")) {
    return "Сервер временно недоступен. Подождите минуту и повторите.";
  }
  if (trimmed.length > 200) return res.statusText || "Ошибка сервера";
  return trimmed || res.statusText;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...authHeaders(), ...init?.headers } });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export const fetchSubscriptionInfo = () => api<SubscriptionInfo>("/subscriptions/info");

export const fetchSupportInfo = () => api<SupportInfo>("/support/info");

export const fetchSupportMessages = (afterId = 0) =>
  api<SupportMessage[]>(`/support/messages?after_id=${afterId}`);

export const sendSupportMessage = (text: string) =>
  api<SupportMessage>("/support/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

export const submitPayment = (plan: "week" | "month", tx_id: string) =>
  api<SubscriptionInfo>("/subscriptions/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, tx_id }),
  });

export const fetchCultSubscriptionInfo = () =>
  api<CultCandidateSubscriptionInfo>("/cult-candidates/subscription/info");

export const payCultSubscription = (tx_id: string) =>
  api<CultCandidateSubscriptionInfo>("/cult-candidates/subscription/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_id }),
  });

export const fetchMe = () => api<Me>("/auth/me");
export const fetchSignals = () => api<Signal[]>("/signals");
export const fetchSignalsPreview = () => api<Signal[]>("/signals/preview");

export type MarketPrice = { symbol: string; price: number; source?: string };

export type MarketKline = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const fetchMarketPrice = (symbol: string) =>
  api<MarketPrice>(`/signals/market-price?symbol=${encodeURIComponent(symbol.trim())}`);

export const fetchMarketKlines = (
  symbol: string,
  options?: { interval?: string; limit?: number; end?: number },
) => {
  const params = new URLSearchParams({ symbol: symbol.trim() });
  if (options?.interval) params.set("interval", options.interval);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.end != null) params.set("end", String(Math.ceil(options.end)));
  return api<{ symbol: string; candles: MarketKline[] }>(`/signals/market-klines?${params}`);
};

export const fetchMarketSymbols = (query: string) =>
  api<{ symbols: string[] }>(
    `/signals/market-symbols?q=${encodeURIComponent(query.trim().toUpperCase())}`,
  );
export type CopyTradingStatus = {
  configured: boolean;
  enabled: boolean;
  api_key_hint?: string | null;
  account_balance_usd: number;
  stake_percent: number;
  usdt_balance?: number | null;
  balance_error?: string | null;
  usdt_ton_address: string;
  payment_memo: string;
  fee_percent: number;
  min_topup_usd: number;
  fee_deposit_usd: number;
  accrued_fee_usd: number;
  connected_at?: string | null;
  equity_baseline_usd?: number | null;
  current_equity_usd?: number | null;
  profit_usd: number;
  unbilled_profit_usd: number;
  copy_allowed: boolean;
  fee_exempt?: boolean;
  copy_errors?: string[];
};

export type CopyTradingSaveBody = {
  api_key: string;
  api_secret: string;
  enabled: boolean;
  account_balance_usd?: number;
  stake_percent: number;
};

export type CopyTradingPatchBody = {
  enabled?: boolean;
  stake_percent?: number;
};

export const fetchCopyTradingStatus = () => api<CopyTradingStatus>("/copy-trading/me");

export const saveCopyTradingSettings = (body: CopyTradingSaveBody) =>
  api<CopyTradingStatus>("/copy-trading/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const patchCopyTradingSettings = (body: CopyTradingPatchBody) =>
  api<CopyTradingStatus>("/copy-trading/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const testCopyTradingConnection = () =>
  api<CopyTradingStatus>("/copy-trading/me/test", { method: "POST" });

export async function deleteCopyTradingSettings(): Promise<void> {
  const res = await fetch(`${base}/copy-trading/me`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export const topUpCopyDeposit = (tx_id: string) =>
  api<CopyTradingStatus>("/copy-trading/me/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_id }),
  });

// ── MetaAPI ──────────────────────────────────────────────

export type MetaApiStatus = {
  configured: boolean;
  enabled: boolean;
  account_id_hint: string | null;
  lot_size: number;
  balance: number | null;
  currency: string | null;
  balance_error: string | null;
  connected_at: string | null;
};

export const fetchMetaApiStatus = () => api<MetaApiStatus>("/meta-api/status");

export const saveMetaApiSettings = (body: { account_id: string; lot_size: number; enabled: boolean }) =>
  api<MetaApiStatus>("/meta-api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function deleteMetaApiSettings(): Promise<void> {
  const res = await fetch(`${base}/meta-api/disconnect`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export const fetchPoolStats = () => api<PoolStats>("/traders/pool");
export const fetchLeaderboard = () => api<Trader[]>("/traders/leaderboard");
export const fetchFiredLeaderboard = () => api<Trader[]>("/traders/fired-leaderboard");
export const fetchRosterDemotedAdmins = () => api<Trader[]>("/traders/roster-demoted");

export type TraderRosterSection = "top" | "candidate" | "fired";

export const setTraderRoster = (telegramId: number, section: TraderRosterSection) =>
  api<{ ok: boolean; telegram_id: number; section: TraderRosterSection }>(`/traders/${telegramId}/roster`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section }),
  });

export async function resetTraderRoster(telegramId: number): Promise<void> {
  const res = await fetch(`${base}/traders/${telegramId}/roster`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res));
}
export const fetchCultChannels = () => api<CultChannel[]>("/cult-channels");
export const createCultChannel = (url: string) =>
  api<CultChannel>("/cult-channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
export async function deleteCultChannel(id: number): Promise<void> {
  const res = await fetch(`${base}/cult-channels/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export const fetchCultCandidates = () => api<CultCandidate[]>("/cult-candidates");
export const fetchCultCandidateMe = () => api<CultCandidateMe>("/cult-candidates/me");
export const fetchCultCandidateFormSnapshot = (excludeSignalId?: number) =>
  api<CultCandidateFormSnapshot>(
    excludeSignalId != null
      ? `/cult-candidates/me/form-snapshot?exclude_signal_id=${excludeSignalId}`
      : "/cult-candidates/me/form-snapshot",
  );
export const joinCultCandidate = () =>
  api<CultCandidate>("/cult-candidates/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
export const closeCultCandidateSignalAtMarket = (signalId: number) =>
  api<Signal>(`/cult-candidates/me/signals/${signalId}/close-market`, { method: "POST" });

export const createCultCandidateSignal = (form: FormData, onProgress?: (p: UploadProgress) => void) =>
  onProgress
    ? sendFormWithProgress<Signal>("/cult-candidates/me/signals", "POST", form, onProgress)
    : sendForm<Signal>("/cult-candidates/me/signals", "POST", form);
export const updateCultCandidateSignal = (id: number, form: FormData, onProgress?: (p: UploadProgress) => void) =>
  onProgress
    ? sendFormWithProgress<Signal>(`/cult-candidates/me/signals/${id}`, "PUT", form, onProgress)
    : sendForm<Signal>(`/cult-candidates/me/signals/${id}`, "PUT", form);
export async function deleteCultCandidateSignal(id: number): Promise<void> {
  await api<void>(`/cult-candidates/me/signals/${id}`, { method: "DELETE" });
}
export const fetchTraderRank = (telegramId: number) => api<TraderRank>(`/traders/${telegramId}/rank`);
export const fetchChallengeTrackers = () => api<ChallengeDashboard[]>("/challenge/trackers");

/** Контекст формы сигнала: ранг и пул; лимиты челленджа — только при добавленном трекере. */
export const fetchMyTracker = (excludeSignalId?: number) =>
  api<SignalFormSnapshot>(
    excludeSignalId != null
      ? `/challenge/my-tracker?exclude_signal_id=${excludeSignalId}`
      : "/challenge/my-tracker",
  );

export const fetchReviews = () => api<Review[]>("/reviews");

export const createReview = (form: FormData) => sendForm<Review>("/reviews", "POST", form);

export const updateReview = (id: number, form: FormData) => sendForm<Review>(`/reviews/${id}`, "PUT", form);

export async function deleteReview(id: number): Promise<void> {
  const res = await fetch(`${base}/reviews/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
}

export const fetchNews = () => api<NewsPost[]>("/news");

export const fetchNewsLinkPreview = (url: string) =>
  api<NewsLinkPreview>(`/news/link-preview?url=${encodeURIComponent(url.trim())}`);

export const createNewsPost = (form: FormData) => sendForm<NewsPost>("/news", "POST", form);

export const updateNewsPost = (id: number, form: FormData) => sendForm<NewsPost>(`/news/${id}`, "PUT", form);

export async function deleteNewsPost(id: number): Promise<void> {
  const res = await fetch(`${base}/news/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
}

async function sendForm<T>(path: string, method: string, form: FormData): Promise<T> {
  try {
    const res = await fetch(`${base}${path}`, { method, headers: authHeaders(), body: form });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(parseUploadError(text, res.status));
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error) throw new Error(parseUploadError(e.message));
    throw new Error(parseUploadError("Load failed"));
  }
}

function applyAuthHeaders(xhr: XMLHttpRequest) {
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
}

function sendFormWithProgress<T>(
  path: string,
  method: string,
  form: FormData,
  onProgress: (p: UploadProgress) => void,
): Promise<T> {
  const fileBytes = mediaBytesInForm(form);

  return new Promise((resolve, reject) => {
    const report = (loaded: number, total: number, phase: UploadProgress["phase"]) => {
      const basis = total > 0 ? total : fileBytes;
      let percent = 0;
      if (phase === "processing") {
        percent = 100;
      } else if (basis > 0) {
        percent = Math.min(99, Math.round((loaded / basis) * 100));
      } else if (loaded > 0) {
        percent = 1;
      }
      onProgress({ loaded, total: basis, percent, phase });
    };

    report(0, fileBytes, "upload");

    const xhr = new XMLHttpRequest();
    xhr.open(method, `${base}${path}`);
    xhr.timeout = 600_000;
    applyAuthHeaders(xhr);

    xhr.upload.onloadstart = () => report(0, fileBytes, "upload");

    xhr.upload.onprogress = (ev) => {
      const total =
        ev.lengthComputable && ev.total > 0 ? Math.max(ev.total, fileBytes) : fileBytes;
      report(ev.loaded, total, "upload");
    };

    xhr.upload.onload = () => report(fileBytes, fileBytes, "processing");

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("Неверный ответ сервера"));
        }
        return;
      }
      reject(new Error(parseUploadError(xhr.responseText || "", xhr.status)));
    };
    xhr.onerror = () => reject(new Error(parseUploadError("Load failed")));
    xhr.ontimeout = () => reject(new Error("Превышено время загрузки (10 мин). Попробуйте видео меньшего размера."));
    xhr.onabort = () => reject(new Error("Загрузка отменена"));
    xhr.send(form);
  });
}

export const createSignalWithMedia = (form: FormData, onProgress?: (p: UploadProgress) => void) => {
  if (onProgress) return sendFormWithProgress<Signal>("/signals", "POST", form, onProgress);
  return sendForm<Signal>("/signals", "POST", form);
};

export const updateSignalWithMedia = (
  signalId: number,
  form: FormData,
  onProgress?: (p: UploadProgress) => void,
) => {
  if (onProgress) return sendFormWithProgress<Signal>(`/signals/${signalId}`, "PUT", form, onProgress);
  return sendForm<Signal>(`/signals/${signalId}`, "PUT", form);
};

export const appendSignalSupplement = (
  signalId: number,
  form: FormData,
  onProgress?: (p: UploadProgress) => void,
) => {
  const path = `/signals/${signalId}/supplement`;
  if (onProgress) return sendFormWithProgress<Signal>(path, "POST", form, onProgress);
  return sendForm<Signal>(path, "POST", form);
};

export const recordSignalView = (signalId: number) =>
  api<{ views_count: number }>(`/signals/${signalId}/view`, { method: "POST" });

export const toggleSignalLike = (signalId: number) =>
  api<{ liked: boolean; likes_count: number }>(`/signals/${signalId}/like`, { method: "POST" });

export async function deleteSignal(signalId: number, reason?: string): Promise<void> {
  const url = reason
    ? `${base}/signals/${signalId}?reason=${encodeURIComponent(reason)}`
    : `${base}/signals/${signalId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export const closeSignalAtMarket = (signalId: number) =>
  api<Signal>(`/signals/${signalId}/close-market`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

export const setNotifications = (patch: { notify_enabled?: boolean; notify_news_enabled?: boolean }) =>
  api<Me>("/subscriptions/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

export const updateChallengeSettings = (form: FormData) =>
  sendForm<ChallengeDashboard>("/challenge/settings", "PUT", form);

export type TimeCapsuleDelay = "test" | "1w" | "1m" | "3m";

export interface TimeCapsuleResult {
  id: number;
  deliver_at: string;
}

export const scheduleTimeCapsule = (message: string, delay: TimeCapsuleDelay) =>
  api<TimeCapsuleResult>("/time-capsule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, delay }),
  });
