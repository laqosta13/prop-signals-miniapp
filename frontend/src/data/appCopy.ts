/**
 * Volnovoi Cult · Marketplace крипто-сделок.
 * Короткие тексты: что это, зачем, без воды.
 */

export const PRODUCT_NAME = "Volnovoi Cult";
export const PRODUCT_TAGLINE = "Marketplace крипто-сделок";

export const PRODUCT_PITCH =
  "Прозрачная витрина сделок для всех участников рынка. Ранги и отбор — в топ только лучшие трейдеры и их сделки.";

/** Подзаголовки вкладок (шапка приложения). */
/** Вкладка «Подписка» — зачем платить. */
export const SUBSCRIPTION_INTRO =
  "Доступ к ленте сигналов трейдеров Cult — отобранных по рангам и результатам.";

export const SUBSCRIPTION_TRIAL_USED_MSG = "Пробный период уже использован. Оформите подписку ниже.";

export function subscriptionInactiveHint(trialDays: number, trialUsed: boolean): string {
  if (trialUsed) return SUBSCRIPTION_TRIAL_USED_MSG;
  return `Подписка не активна. Доступен пробный период — ${trialDays} дн.`;
}

export const TAB_SUBTITLES = {
  feed: PRODUCT_TAGLINE,
  tracker: "Челлендж Hash Hedge",
  top: "Ранги и отбор",
  reviews: "Опыт участников",
  news: "",
  pay: "Доступ к ленте · USDT TON",
} as const;

export const TOP_INTRO = PRODUCT_PITCH;

export const TOP_LABEL_TRADERS = "Трейдеры Cult";
export const TOP_LABEL_CANDIDATES = "Кандидаты на отбор";
export const TOP_LABEL_FIRED = "Вне рейтинга";

export const TOP_EMPTY =
  "Рейтинг появится после закрытых сделок.";
export const TOP_CANDIDATES_EMPTY =
  "Станьте кандидатом или дождитесь каналов на отборе.";

export const VOLNOVOI_SUBTITLE = "Сводка сделок отобранных трейдеров";

export const VOLNOVOI_COPY_TITLE = "Копирование volnovoi · Bybit";
export const VOLNOVOI_COPY_DESC =
  "Сделки volnovoi на вашем Bybit (perp). Оплата отдельно от подписки на ленту.";
export const VOLNOVOI_COPY_HINT_BILLING =
  "Депозит комиссии · 20% прибыли списывается автоматически · депозит пуст — стоп копи";
export const VOLNOVOI_COPY_HINT_API = "API Trade · без Withdraw";

export const VOLNOVOI_MARKETING_CTA = "Подключите Bybit под карточкой ↓";

export const RANK_GUIDE_HINT = "Ранги — кто сколько может в сделке";
export const RANK_GUIDE_TITLE = "Система рангов";
export const RANK_GUIDE_INTRO =
  "Недельный результат → ранг. Выше ранг — больше % входа и плечо в сигнале.";
export const RANK_GUIDE_POOL =
  "Общий пул входа: если два трейдера заняли 100%, третий в эту сделку не войдёт.";

export const RANK_RULES = [
  "Недельный % по закрытым сделкам → ранг.",
  "Подтвердите итог до вс 23:59 МСК.",
  "Минусовая неделя: −1 ранг; две подряд: −2; без подтверждения: ещё −1.",
  "Страховка — 1 раз в месяц, минус не снижает ранг.",
  "Топ-ранги — до 100% входа и плечо до 5×.",
  "Ниже «Китяры» — плечо 1×; дальше +1× за ранг.",
] as const;

export const DISCLAIMER_TITLE = "Перед сделкой";
export const DISCLAIMER_LEAD = "Сигнал — параметры сделки. Решение и риск — ваши.";
export const DISCLAIMER_POINTS = [
  "Вход только по уровням сигнала и вашему % риска.",
  "Цена ушла от входа — пропуск, не догоняйте.",
  "FOMO и лудомания — на вас; сервис не гарантирует прибыль.",
] as const;
export const DISCLAIMER_FOOTER = "Продолжая, вы принимаете это.";
export const DISCLAIMER_ACCEPT_LABEL = "Принимаю";

export const SUPPORT_TITLE = "Поддержка";
export const SUPPORT_LEAD = "Вопрос — ответ в этом чате.";
export const SUPPORT_UNAVAILABLE =
  "Чат выключен. На сервере: BOT_TOKEN и TELEGRAM_SUPPORT_GROUP_ID.";
export const SUPPORT_INPUT_PLACEHOLDER = "Сообщение…";
export const SUPPORT_SEND_LABEL = "Отправить";

export const CULT_JOIN_TITLE = "Кандидат в Cult";
export const CULT_JOIN_INTRO =
  "Ваши сделки — в блок «Кандидаты на отбор». Подписка кандидата ($20 / 30 дн.) отдельно от ленты.";
export const CULT_BYBIT_DESC = "«+ Сделка» → ваш Bybit: вход, стоп, цель.";
export const CULT_CHANNEL_ADMIN_HINT =
  "Бот — админ канала. Статистика с момента подключения; в посте: тикер, вход, стоп, цель.";

export const REVIEW_RULES_TITLE = "Отзыв";
export const REVIEW_RULES = [
  "Нужна активная подписка.",
  "Через 7 дней после регистрации.",
  "Без ссылок и контактов.",
  "Один отзыв — можно редактировать.",
] as const;

export const REFERRAL_SHARE_FALLBACK =
  "Volnovoi Cult — marketplace крипто-сделок. Прозрачные сигналы топ-трейдеров.";

export const PARTNER_BYBIT_HINT = "Bybit — копирование volnovoi";
