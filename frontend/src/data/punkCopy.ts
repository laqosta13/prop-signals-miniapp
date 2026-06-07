/**
 * Cyber-punk копирайт — теневой мир Cult (тема МА).
 */

export const PUNK_PRODUCT_NAME = "VOLNOVOI CULT";
export const PUNK_PRODUCT_TAGLINE = "ТЕНЕВОЙ MARKETPLACE";
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

export const PUNK_FEED_KICKER = "SHADOW";
export const PUNK_FEED_WORD_CRYPTO = "КРИПТО-";
export const PUNK_FEED_WORD_DEALS = "СДЕЛОК";
export const PUNK_FEED_WORD_DEALS_SINGLE = "КРИПТО-СДЕЛОК";
export const PUNK_FEED_IN_MARKET = "в сети";
export const PUNK_FEED_AWAITING = "ожидание кода";

export const PUNK_FEED_LABEL_ACTIVE = "АКТИВНЫЕ ОПЕРАЦИИ";
export const PUNK_FEED_LABEL_CLOSED = "АРХИВ СЕТИ";

export const PUNK_TOP_LABEL_TRADERS = "ОПЕРАТОРЫ CULT";
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
export const PUNK_TRACKER_STAGE_LEV = (stage: number, lev: number) => `УРОВЕНЬ ${stage} · ПЛЕЧО ${lev}`;
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
  "Подтверди итог до вс 23:59 МСК — иначе штраф.",
  "Минусовая неделя: −1 код; две подряд: −2; без подтверждения: ещё −1.",
  "Страховка — 1 раз в месяц, минус не снижает код.",
  "Топ-коды — до 100% входа и плечо до 5×.",
  "Ниже «КИТ ТЕНИ» — плечо 1×; дальше +1× за уровень.",
] as const;

export const PUNK_RANK_GUIDE_UNDERSTOOD = "ВХОД В СЕТЬ";
export const PUNK_RANK_CONFIRM_TITLE = "ПОДТВЕРДИ КОД";
export const PUNK_RANK_CONFIRM_BTN = "ЗАФИКСИРОВАТЬ";
export const PUNK_RANK_CONFIRM_WEEK = "за цикл";

export const PUNK_THEME_TOGGLE_DARK = "Тёмная тема";
export const PUNK_THEME_TOGGLE_PUNK = "Теневая тема";
