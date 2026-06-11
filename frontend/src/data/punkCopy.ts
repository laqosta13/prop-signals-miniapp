/**
 * Cyber-punk копирайт — неоновый мир Volnovoi Cult (тема МА).
 */

import { PRODUCT_NAME } from "./appCopy";

export const PUNK_PRODUCT_NAME = PRODUCT_NAME;
export const PUNK_PRODUCT_TAGLINE = "NEON·SHADOW";
export const PUNK_BOOT_TITLE = "VOLNOVOI CULT";
export const PUNK_BOOT_META = "СИНХРОНИЗАЦИЯ СЕТИ…";

export const PUNK_NAV = {
  feed: "ЛЕНТА",
  tracker: "ТРЕКЕР",
  top: "ЭЛИТА",
  reviews: "ЭХО",
  news: "СИГНАЛЫ",
  pay: "ДОСТУП",
} as const;

export const PUNK_TAB_TITLES = {
  feed: "",
  tracker: "ТРЕКЕР",
  top: "ЭЛИТА",
  reviews: "ЭХО",
  news: "СИГНАЛЫ",
  pay: "ДОСТУП",
} as const;

export const PUNK_TAB_SUBTITLES = {
  feed: "ТЕНЕВОЙ MARKETPLACE",
  tracker: "ПРОТОКОЛ HASH HEDGE",
  top: "КОДЫ И ОТБОР",
  reviews: "ГОЛОСА СЕТИ",
  news: "",
  pay: "КЛЮЧ · USDT TON",
} as const;

export const PUNK_FEED_KICKER = "VOLNOVOI CULT";
export const PUNK_FEED_HEADLINE = "NEON·SHADOW";
export const PUNK_FEED_IN_MARKET = "LIVE";
export const PUNK_FEED_AWAITING = "QUEUE";

/** Legacy — не используется в панк-шапке ленты. */
export const PUNK_FEED_WORD_CRYPTO = "КРИПТО-";
export const PUNK_FEED_WORD_DEALS = "ОПЕРАЦИЙ";
export const PUNK_FEED_WORD_DEALS_SINGLE = "КРИПТО-ОПЕРАЦИЙ";

export const PUNK_FEED_LABEL_ACTIVE = "АКТИВНЫЕ ОПЕРАЦИИ";
export const PUNK_FEED_LABEL_CLOSED = "АРХИВ СЕТИ";
export const PUNK_FORMAT_FEED_SHOW_MORE_CLOSED = (count: number) => `РАЗВЕРНУТЬ +${count}`;

export const PUNK_TOP_INTRO =
  "Подпольная витрина операций. Коды и отбор — в элиту только операторы сети.";

export const PUNK_TOP_LABEL_TRADERS = "ОПЕРАТОРЫ СЕТИ";
export const PUNK_TOP_LABEL_CANDIDATES = "КАНДИДАТЫ В ТЕНЬ";
export const PUNK_TOP_LABEL_FIRED = "ВНЕ СЕТИ";
export const PUNK_TOP_EMPTY = "Рейтинг появится после закрытых операций.";
export const PUNK_TOP_CANDIDATES_EMPTY = "Войдите в тень или дождитесь каналов отбора.";

export const PUNK_LOADING = "СИНХРОНИЗАЦИЯ…";

export const PUNK_TRACKER_DAILY_LIMIT = "ЛИМИТ ДНЯ · ВСЕ ОПЕРАТОРЫ";
export const PUNK_TRACKER_DAILY_LOSS = "Урон за цикл";
export const PUNK_TRACKER_LIMIT = "Потолок";
export const PUNK_TRACKER_REMAINING = "Остаток из общего пула";
export const PUNK_TRACKER_ADD = "Подключить трекер Hash Hedge";
export const PUNK_TRACKER_EMPTY = "Трекеры операторов появятся после подключения.";
export const PUNK_TRACKER_STAGE_LEV = (stage: number, lev: string | number) =>
  `УРОВЕНЬ ${stage} · ПЛЕЧО ${lev}`;
export const PUNK_TRACKER_BALANCE = "Баланс";
export const PUNK_TRACKER_START = "Старт";
export const PUNK_TRACKER_TARGET = "Цель";
export const PUNK_TRACKER_DRAWDOWN = "Просадка";
export const PUNK_TRACKER_DAILY = "Лимит цикла";
export const PUNK_TRACKER_RECON = "Сверка с пропом";
export const PUNK_TRACKER_DAYS = "Циклы";
export const PUNK_TRACKER_TRADES = "Операций";
export const PUNK_TRACKER_SETTINGS = "Настройки";
export const PUNK_TRACKER_TRADES_TAB = (n: number) => `Операции · ${n}`;

export const PUNK_SIGNAL_ENTRY = "ТОЧКА ВХОДА";
export const PUNK_SIGNAL_STOP = "СТОП-КОД";
export const PUNK_SIGNAL_TARGET = "ЦЕЛЬ 1:3";
export const PUNK_SIGNAL_LEVERAGE = "ПЛЕЧО";
export const PUNK_SIGNAL_STAKE = "ДОЛЯ ВХОДА";
export const PUNK_SIGNAL_BALANCE = "БАЛАНС";
export const PUNK_SIGNAL_NOMINAL = "НОМИНАЛ";
export const PUNK_SIGNAL_DEAL = "ОПЕРАЦИЯ";
export const PUNK_SIGNAL_LEVELS = "КОДЫ";
export const PUNK_SIGNAL_POSITION = "РАЗМЕР ПОЗИЦИИ";
export const PUNK_SIGNAL_COMMENT = "ПРОТОКОЛ";
export const PUNK_SIGNAL_NEW = "НОВАЯ ОПЕРАЦИЯ";
export const PUNK_SIGNAL_TO_FEED = "В ЛЕНТУ";
export const PUNK_SIGNAL_TO_CARD = "В КАРТОЧКУ";
export const PUNK_SIGNAL_PUBLISH = "ЗАПУСТИТЬ";
export const PUNK_SIGNAL_PUBLISHING = "ЗАПУСК…";
export const PUNK_SIGNAL_SAVE = "СОХРАНЕНИЕ…";
export const PUNK_SIGNAL_TICKER = "ТИКЕР";
export const PUNK_SIGNAL_LONG = "LONG";
export const PUNK_SIGNAL_SHORT = "SHORT";
export const PUNK_SIGNAL_LIMITS = "ЛИМИТЫ…";
export const PUNK_SIGNAL_TRADES = "ОПЕРАЦИИ";
export const PUNK_SIGNAL_STOP_CHIP = "СТОП";
export const PUNK_SIGNAL_POOL = "ПУЛ";
export const PUNK_SIGNAL_IN_MARKET = "В СЕТИ";
export const PUNK_SIGNAL_COMMENT_PH = "Краткий протокол операции…";
export const PUNK_SIGNAL_MEDIA = "Скрин или видео";

export const PUNK_CARD_ENTRY = "Вход";
export const PUNK_CARD_TRACKER = "Трекер";
export const PUNK_CARD_LEVERAGE = "Плечо";
export const PUNK_CARD_LONG = "↑ LONG";
export const PUNK_CARD_SHORT = "↓ SHORT";
export const PUNK_CARD_EDIT = "Изменить";
export const PUNK_CARD_DELETE = "Удалить";
export const PUNK_CARD_CLOSE_MARKET = "Закрыть по рынку";
export const PUNK_CARD_IN_GAME = (n: number) => `${n} в игре`;
export const PUNK_CARD_CLOSED = (n: number) => `${n} закр.`;
export const PUNK_CARD_TRADE = "+ Операция";

export const PUNK_OUTCOME_WAITING = "Ожидание кода";
export const PUNK_OUTCOME_ACTIVE = "В сети";
export const PUNK_OUTCOME_MARKET = "По рынку";
export const PUNK_OUTCOME_TARGET = "Цель взята";
export const PUNK_OUTCOME_STOP = "Стоп";

export const PUNK_RANK_RULES = [
  "Недельный % по закрытым операциям → код доступа.",
  "Каждый понедельник 00:01 UTC код пересчитывается автоматически.",
  "Минусовая неделя: −1 код; две минусовые подряд: −2 кода.",
  "Две минусовые недели подряд — в блок «Вне рейтинга».",
  "Из «Вне рейтинга» возврат — не раньше чем через 2 недели.",
  "Топ-коды — до 100% входа и плечо до 5×.",
  "Ниже «КИТ ТЕНИ» — плечо 1×; дальше +1× за уровень.",
] as const;

export const PUNK_RANK_GUIDE_UNDERSTOOD = "ВХОД В СЕТЬ";
export const PUNK_RANK_PENALTY_WARN = "−1 код";
export const PUNK_RANK_AFTER_FIRST_CLOSE = "код — после первой сделки";
export const PUNK_ROSTER_FIRED_COOLDOWN_MSG =
  "Из «Вне рейтинга» — только через 2 недели после увольнения.";

export const PUNK_THEME_TOGGLE_DARK = "Тёмная тема";
export const PUNK_THEME_TOGGLE_PUNK = "Теневая тема";

export const PUNK_RANK_GUIDE_HINT = "Коды — кто сколько может в операции";

export const PUNK_VOLNOVOI_SUBTITLE = "Сводка операций отобранных операторов";
export const PUNK_VOLNOVOI_COPY_TITLE = "Зеркало оператора · Bybit";
export const PUNK_VOLNOVOI_COPY_DESC =
  "Операции оператора на вашем Bybit (perp). Оплата отдельно от ключа на ленту.";
export const PUNK_VOLNOVOI_COPY_HINT_BILLING = "Депозит комиссии · USDT(в сети TON) · TXID";
export const PUNK_VOLNOVOI_COPY_HINT_API = "API Trade · без депозита — пауза";
export const PUNK_VOLNOVOI_MARKETING_CTA = "Подключите Bybit под карточкой ↓";

export const PUNK_SIGNAL_NO_TRACKER_HINT =
  "Трекер не подключён — лимиты дня и кода действуют; в проп-статистику сделка не войдёт.";
export const PUNK_TRACKER_EXCHANGE_ONLY_HINT =
  "Без трекера — только биржа. «+» — челлендж Hash Hedge и учёт пропа.";

export const PUNK_SUBSCRIPTION_INTRO =
  "Доступ к ленте операций операторов сети — по кодам и результатам.";
export const PUNK_SUBSCRIPTION_TRIAL_USED_MSG = "Доступ не активен. Получите ключ ниже.";

export function punkTestModeBannerText(until: string | null, daysLeft: number): string {
  if (until) {
    return "Тестовый протокол — всё бесплатно до конца цикла. После дедлайна доступ только по ключу.";
  }
  if (daysLeft > 0) {
    return `Тестовый протокол — всё бесплатно ещё ${daysLeft} дн. После дедлайна доступ только по ключу.`;
  }
  return "Тестовый протокол — всё бесплатно. После дедлайна доступ только по ключу.";
}

export function punkSubscriptionInactiveHint(trialDays: number, trialUsed: boolean): string {
  if (trialDays > 0 && !trialUsed) {
    return `Доступ не активен. Пробный цикл — ${trialDays} дн.`;
  }
  return PUNK_SUBSCRIPTION_TRIAL_USED_MSG;
}

export const PUNK_DISCLAIMER_TITLE = "Протокол Volnovoi Cult";
export const PUNK_DISCLAIMER_LEAD =
  "Результат возможен только при 100% повторении операции — как в коде.";
export const PUNK_DISCLAIMER_POINTS = [
  "Вход, стоп, цель, % риска и плечо — один в один.",
  "Пропустили вход, догнали цену или изменили размер — это уже другая операция.",
  "Сеть показывает операции на виду; прибыль не гарантируем.",
] as const;
export const PUNK_DISCLAIMER_FOOTER = "Решение и риск — ваши. Продолжая, вы это принимаете.";
export const PUNK_DISCLAIMER_ACCEPT_LABEL = "Принимаю";

export const PUNK_CULT_JOIN_TITLE = "Кандидат в тень";
export const PUNK_CULT_JOIN_INTRO =
  "Ваши операции — в блок «Кандидаты в тень». Ключ кандидата ($20 / 30 дн.) отдельно от ленты.";
export const PUNK_CULT_JOIN_CTA = "Войти в тень";
export const PUNK_CULT_JOIN_STEP_PAY = "Оплатить ключ кандидата";
export const PUNK_CULT_JOIN_STEP_API = "Подключить API Bybit";
export const PUNK_CULT_JOIN_STEP_CONFIRM = "Нажать «Войти»";
export const PUNK_CULT_JOIN_CONFIRM_BTN = "Войти";
export const PUNK_CULT_BYBIT_DESC = "«+ Операция» → ваш Bybit: вход, стоп, цель.";
export const PUNK_CULT_CHANNEL_ADMIN_HINT =
  "Бот — админ канала. Статистика с момента подключения; в посте: тикер, вход, стоп, цель.";

export const PUNK_REVIEW_RULES_TITLE = "Эхо";
export const PUNK_REVIEW_RULES = [
  "Нужен активный ключ.",
  "Через 7 дней после регистрации.",
  "Без ссылок и контактов.",
  "Одно эхо — можно редактировать.",
] as const;

export const PUNK_REFERRAL_SHARE_FALLBACK =
  "Volnovoi Cult — теневой marketplace крипто-операций. Прозрачные коды топ-операторов.";

export const PUNK_PARTNER_BYBIT_HINT = "Bybit — зеркало оператора";
export const PUNK_HASH_HEDGE_TRADE_BTN = "HASH HEDGE";
export const PUNK_HASH_HEDGE_TRADE_HINT = "Скопировать код сделки и открыть терминал Hash Hedge в приложении";
export const PUNK_HASH_HEDGE_TRADE_COPIED =
  "Полный код в буфере. Уровни ниже — тап по цифре копирует вход, стоп или цель.";
export const PUNK_LEVELS_COPY_TAP = "тап · копировать";
export const PUNK_LEVELS_COPIED = "в буфере";
export const PUNK_HASH_HEDGE_TRADE_COPY_FAILED =
  "Буфер недоступен. Откройте Hedge и перепишите уровни с карточки.";
export const PUNK_PARTNER_BINGX_HINT = "Регистрация BingX";
export const PUNK_PARTNER_ANTARCTIC_HINT = "Вывод крипты и оплата по СБП";
export const PUNK_PARTNER_LINKS_TITLE = "Биржи и вывод";

export const PUNK_FEED_SUB_BANNER =
  "Активные операции доступны по ключу. Получите доступ во вкладке «Доступ».";
export const PUNK_FEED_SUB_BANNER_BTN = "Ключ и доступ →";
export const PUNK_FEED_EMPTY = "Пока нет операций.";
export const PUNK_FEED_EMPTY_CLOSED = "Пока нет закрытых операций.";
export const PUNK_FEED_EMPTY_ACTIVE = "Нет активных операций";
