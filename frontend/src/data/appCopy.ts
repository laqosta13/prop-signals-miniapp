/**
 * Volnovoi Cult · Marketplace крипто-сделок.
 * Короткие тексты: что это, зачем, без воды.
 */

export const PRODUCT_NAME = "Volnovoi Cult";
export const PRODUCT_TAGLINE = "Marketplace крипто-сделок";

export const FEED_LABEL_ACTIVE = "Активные сделки";
export const FEED_LABEL_CLOSED = "Закрытые сделки";

export const formatFeedShowMoreClosed = (count: number) => `Показать ещё ${count}`;

export const PRODUCT_PITCH =
  "Прозрачная витрина сделок для всех участников рынка. Ранги и отбор — в топ только лучшие трейдеры и их сделки.";

/** Подзаголовки вкладок (шапка приложения). */
/** Вкладка «Подписка» — зачем платить. */
export const SUBSCRIPTION_INTRO =
  "Доступ к ленте сигналов трейдеров Cult — отобранных по рангам и результатам.";

export const SUBSCRIPTION_TRIAL_USED_MSG = "Подписка не активна. Оформите доступ ниже.";

export function testModeBannerText(until: string | null, daysLeft: number): string {
  if (until) {
    return `Тестовый режим — всё бесплатно до конца периода. После дедлайна доступ только по подписке.`;
  }
  if (daysLeft > 0) {
    return `Тестовый режим — всё бесплатно ещё ${daysLeft} дн. После дедлайна доступ только по подписке.`;
  }
  return "Тестовый режим — всё бесплатно. После дедлайна доступ только по подписке.";
}

export function subscriptionInactiveHint(trialDays: number, trialUsed: boolean): string {
  if (trialDays > 0 && !trialUsed) {
    return `Подписка не активна. Доступен пробный период — ${trialDays} дн.`;
  }
  return SUBSCRIPTION_TRIAL_USED_MSG;
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
export const VOLNOVOI_COPY_HINT_BILLING = "Депозит комиссии · USDT(в сети TON) · TXID";
export const VOLNOVOI_COPY_HINT_API = "API Trade · без депозита — пауза";

export const VOLNOVOI_MARKETING_CTA = "Подключите Bybit под карточкой ↓";

export const SIGNAL_NO_TRACKER_HINT =
  "Трекер Hash Hedge не подключён — лимиты дня и ранга действуют; в статистику пропа сделка не попадёт.";
export const TRACKER_EXCHANGE_ONLY_HINT =
  "Без трекера — сигналы только на биржу. Нажмите «+», чтобы начать челлендж Hash Hedge и вести статистику пропа.";

export const RANK_GUIDE_HINT = "Ранги — кто сколько может в сделке";
export const RANK_GUIDE_TITLE = "Система рангов";
export const RANK_GUIDE_INTRO =
  "Недельный результат → ранг. Каждый понедельник ранг обновляется автоматически. Выше ранг — больше % входа и плечо.";
export const RANK_GUIDE_POOL =
  "Общий пул входа: если два трейдера заняли 100%, третий в эту сделку не войдёт.";

export const RANK_AFTER_FIRST_CLOSE = "Ранг — после первой закрытой сделки";
export const ROSTER_FIRED_COOLDOWN_MSG =
  "Из «Уволенных» можно вернуть только через 2 недели после увольнения.";

export const RANK_RULES = [
  "Недельный % по закрытым сделкам → ранг.",
  "Каждый понедельник 00:01 UTC ранг пересчитывается автоматически.",
  "Минусовая неделя: −1 ранг; две минусовые подряд: −2 ранга.",
  "Две минусовые недели подряд — перевод в блок «Уволенные».",
  "Из «Уволенных» возврат в ТОП или кандидаты — не раньше чем через 2 недели.",
  "Топ-ранги — до 100% входа и плечо до 5×.",
  "Ниже «Китяры» — плечо 1×; дальше +1× за ранг.",
] as const;

export const DISCLAIMER_TITLE = "Методика Cult";
export const DISCLAIMER_LEAD =
  "Результат возможен только при 100% повторении сделки — как в сигнале.";
export const DISCLAIMER_POINTS = [
  "Вход, стоп, цель, % риска и плечо — один в один.",
  "Пропустили вход, догнали цену или изменили размер — это уже другая сделка.",
  "Cult показывает сделки на виду; прибыль не гарантируем.",
] as const;
export const DISCLAIMER_FOOTER = "Решение и риск — ваши. Продолжая, вы это принимаете.";
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

export {
  HASH_HEDGE_TRADE_BTN,
  HASH_HEDGE_TRADE_HINT,
  HASH_HEDGE_TRADE_COPIED,
  HASH_HEDGE_TRADE_COPY_FAILED,
  LEVELS_COPIED,
} from "./hashhedgeTrade";
