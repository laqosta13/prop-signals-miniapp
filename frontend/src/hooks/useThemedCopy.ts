import {
  CULT_BYBIT_DESC,
  CULT_CHANNEL_ADMIN_HINT,
  CULT_JOIN_INTRO,
  CULT_JOIN_TITLE,
  DISCLAIMER_ACCEPT_LABEL,
  DISCLAIMER_FOOTER,
  DISCLAIMER_LEAD,
  DISCLAIMER_POINTS,
  DISCLAIMER_TITLE,
  FEED_LABEL_ACTIVE,
  FEED_LABEL_CLOSED,
  formatFeedShowMoreClosed,
  HASH_HEDGE_TRADE_BTN,
  HASH_HEDGE_TRADE_COPIED,
  HASH_HEDGE_TRADE_COPY_FAILED,
  HASH_HEDGE_TRADE_HINT,
  LEVELS_COPIED,
  PARTNER_BYBIT_HINT,
  PRODUCT_NAME,
  PRODUCT_PITCH,
  PRODUCT_TAGLINE,
  REFERRAL_SHARE_FALLBACK,
  REVIEW_RULES,
  REVIEW_RULES_TITLE,
  SUBSCRIPTION_INTRO,
  TAB_SUBTITLES,
  TOP_CANDIDATES_EMPTY,
  TOP_EMPTY,
  TOP_LABEL_CANDIDATES,
  TOP_LABEL_FIRED,
  TOP_LABEL_TRADERS,
  VOLNOVOI_COPY_DESC,
  VOLNOVOI_COPY_HINT_API,
  VOLNOVOI_COPY_HINT_BILLING,
  VOLNOVOI_COPY_TITLE,
  VOLNOVOI_MARKETING_CTA,
  VOLNOVOI_SUBTITLE,
  RANK_GUIDE_HINT,
  RANK_AFTER_FIRST_CLOSE,
  RANK_RULES,
  ROSTER_FIRED_COOLDOWN_MSG,
  SIGNAL_NO_TRACKER_HINT,
  TRACKER_EXCHANGE_ONLY_HINT,
  subscriptionInactiveHint,
  testModeBannerText,
} from "../data/appCopy";
import * as P from "../data/punkCopy";
import { isPunkTheme, PUNK_RANK_GUIDE_INTRO, PUNK_RANK_GUIDE_POOL, PUNK_RANK_GUIDE_TITLE } from "../utils/punkTheme";
import type { Theme } from "../utils/theme";
import { useAppTheme } from "./useAppTheme";

export type ThemedCopy = {
  punk: boolean;
  productName: string;
  productTagline: string;
  bootTitle: string;
  bootMeta: string;
  loading: string;
  nav: Record<"feed" | "tracker" | "top" | "reviews" | "news" | "pay", string>;
  tabTitles: Record<"feed" | "tracker" | "top" | "reviews" | "news" | "pay", string>;
  tabSubtitles: Record<"feed" | "tracker" | "top" | "reviews" | "news" | "pay", string>;
  feedKicker: string;
  feedHeadline: string;
  feedSubKicker: string;
  feedWordCrypto: string;
  feedWordDeals: string;
  feedWordDealsSingle: string;
  feedInMarket: string;
  feedAwaiting: string;
  feedLabelActive: string;
  feedLabelClosed: string;
  feedSubBanner: string;
  feedSubBannerBtn: string;
  feedEmpty: string;
  feedEmptyClosed: string;
  feedEmptyActive: string;
  topIntro: string;
  topLabelTraders: string;
  topLabelCandidates: string;
  topLabelFired: string;
  topEmpty: string;
  topCandidatesEmpty: string;
  rankGuideHint: string;
  volnovoiSubtitle: string;
  volnovoiCopyTitle: string;
  volnovoiCopyDesc: string;
  volnovoiCopyHintBilling: string;
  volnovoiCopyHintApi: string;
  volnovoiMarketingCta: string;
  subscriptionIntro: string;
  referralShareFallback: string;
  disclaimerTitle: string;
  disclaimerLead: string;
  disclaimerPoints: readonly string[];
  disclaimerFooter: string;
  disclaimerAccept: string;
  disclaimerUnderstood: string;
  cultJoinTitle: string;
  cultJoinIntro: string;
  cultJoinCta: string;
  cultJoinStepPay: string;
  cultJoinStepApi: string;
  cultJoinStepConfirm: string;
  cultJoinConfirmBtn: string;
  cultBybitDesc: string;
  cultChannelAdminHint: string;
  reviewRulesTitle: string;
  reviewRules: readonly string[];
  partnerBybitHint: string;
  partnerBingxHint: string;
  partnerAntarcticHint: string;
  partnerLinksTitle: string;
  signalEntry: string;
  signalStop: string;
  signalTarget: string;
  signalLeverage: string;
  signalStake: string;
  signalBalance: string;
  signalNominal: string;
  signalDeal: string;
  signalLevels: string;
  signalPosition: string;
  signalComment: string;
  signalNew: string;
  signalToFeed: string;
  signalToCard: string;
  signalPublish: string;
  signalPublishing: string;
  signalSave: string;
  signalTicker: string;
  signalLong: string;
  signalShort: string;
  signalLimits: string;
  signalTrades: string;
  signalStopChip: string;
  signalPool: string;
  signalInMarket: string;
  signalCommentPh: string;
  signalMedia: string;
  signalNoTrackerHint: string;
  trackerExchangeOnlyHint: string;
  trackerDailyLimit: string;
  trackerDailyLoss: string;
  trackerLimit: string;
  trackerRemaining: string;
  trackerAdd: string;
  trackerEmpty: string;
  trackerBalance: string;
  trackerStart: string;
  trackerTarget: string;
  trackerDrawdown: string;
  trackerDaily: string;
  trackerRecon: string;
  trackerDays: string;
  trackerTrades: string;
  trackerSettings: string;
  rankGuideTitle: string;
  rankGuideIntro: string;
  rankGuidePool: string;
  rankRules: readonly string[];
  rankUnderstood: string;
  rankAfterFirstClose: string;
  rankPenaltyWarn: string;
  rosterFiredCooldownMsg: string;
  themeToggleDark: string;
  themeTogglePunk: string;
  outcomeWaiting: string;
  outcomeActive: string;
  outcomeMarket: string;
  outcomeTarget: string;
  outcomeStop: string;
  cardEntry: string;
  cardTracker: string;
  cardLeverage: string;
  cardLong: string;
  cardShort: string;
  cardEdit: string;
  cardDelete: string;
  cardCloseMarket: string;
  cardTrade: string;
  hashHedgeTradeBtn: string;
  hashHedgeTradeHint: string;
  hashHedgeTradeCopied: string;
  hashHedgeTradeCopyFailed: string;
  levelsCopied: string;
  formatTrackerStageLev: (stage: number, leverage: string | number) => string;
  formatTrackerTradesTab: (count: number) => string;
  formatFeedShowMoreClosed: (count: number) => string;
  formatTestModeBanner: (until: string | null, daysLeft: number) => string;
  formatSubscriptionInactiveHint: (trialDays: number, trialUsed: boolean) => string;
};

function buildCopy(theme: Theme): ThemedCopy {
  const punk = isPunkTheme(theme);
  if (!punk) {
    return {
      punk: false,
      productName: PRODUCT_NAME,
      productTagline: PRODUCT_TAGLINE,
      bootTitle: PRODUCT_NAME,
      bootMeta: "Загрузка…",
      loading: "Загрузка…",
      nav: { feed: "Лента", tracker: "Трекер", top: "ТОП", reviews: "Отзывы", news: "Новости", pay: "Подписка" },
      tabTitles: { feed: "", tracker: "Трекер", top: "ТОП", reviews: "Отзывы", news: "Новости", pay: "Подписка" },
      tabSubtitles: { ...TAB_SUBTITLES },
      feedKicker: "Marketplace",
      feedHeadline: "",
      feedSubKicker: "",
      feedWordCrypto: "крипто-",
      feedWordDeals: "сделок",
      feedWordDealsSingle: "крипто-сделок",
      feedInMarket: "в рынке",
      feedAwaiting: "ожидание входа",
      feedLabelActive: FEED_LABEL_ACTIVE,
      feedLabelClosed: FEED_LABEL_CLOSED,
      feedSubBanner:
        "Активные сигналы доступны по подписке. Оформите доступ во вкладке «Подписка».",
      feedSubBannerBtn: "Оплата и подписка →",
      feedEmpty: "Пока нет сигналов.",
      feedEmptyClosed: "Пока нет отработанных сигналов.",
      feedEmptyActive: "Нет активных сделок",
      topIntro: PRODUCT_PITCH,
      topLabelTraders: TOP_LABEL_TRADERS,
      topLabelCandidates: TOP_LABEL_CANDIDATES,
      topLabelFired: TOP_LABEL_FIRED,
      topEmpty: TOP_EMPTY,
      topCandidatesEmpty: TOP_CANDIDATES_EMPTY,
      rankGuideHint: RANK_GUIDE_HINT,
      volnovoiSubtitle: VOLNOVOI_SUBTITLE,
      volnovoiCopyTitle: VOLNOVOI_COPY_TITLE,
      volnovoiCopyDesc: VOLNOVOI_COPY_DESC,
      volnovoiCopyHintBilling: VOLNOVOI_COPY_HINT_BILLING,
      volnovoiCopyHintApi: VOLNOVOI_COPY_HINT_API,
      volnovoiMarketingCta: VOLNOVOI_MARKETING_CTA,
      subscriptionIntro: SUBSCRIPTION_INTRO,
      referralShareFallback: REFERRAL_SHARE_FALLBACK,
      disclaimerTitle: DISCLAIMER_TITLE,
      disclaimerLead: DISCLAIMER_LEAD,
      disclaimerPoints: DISCLAIMER_POINTS,
      disclaimerFooter: DISCLAIMER_FOOTER,
      disclaimerAccept: DISCLAIMER_ACCEPT_LABEL,
      disclaimerUnderstood: "Понятно",
      cultJoinTitle: CULT_JOIN_TITLE,
      cultJoinIntro: CULT_JOIN_INTRO,
      cultJoinCta: "Стать кандидатом",
      cultJoinStepPay: "Оплатить подписку кандидата",
      cultJoinStepApi: "Подключить API Bybit",
      cultJoinStepConfirm: "Нажать «Вступить»",
      cultJoinConfirmBtn: "Вступить",
      cultBybitDesc: CULT_BYBIT_DESC,
      cultChannelAdminHint: CULT_CHANNEL_ADMIN_HINT,
      reviewRulesTitle: REVIEW_RULES_TITLE,
      reviewRules: REVIEW_RULES,
      partnerBybitHint: PARTNER_BYBIT_HINT,
      partnerBingxHint: "Регистрация BingX",
      partnerAntarcticHint: "Вывод крипты и оплата по СБП",
      partnerLinksTitle: "Биржи и вывод",
      signalEntry: "Вход",
      signalStop: "Стоп",
      signalTarget: "Цель 1:3",
      signalLeverage: "Плечо",
      signalStake: "Доля входа",
      signalBalance: "Баланс",
      signalNominal: "Номинал",
      signalDeal: "Сделка",
      signalLevels: "Уровни",
      signalPosition: "Размер позиции",
      signalComment: "Комментарий",
      signalNew: "Новый сигнал",
      signalToFeed: "В ленту",
      signalToCard: "В карточку",
      signalPublish: "Опубликовать",
      signalPublishing: "Публикация…",
      signalSave: "Сохранение…",
      signalTicker: "Тикер",
      signalLong: "Long",
      signalShort: "Short",
      signalLimits: "Лимиты…",
      signalTrades: "Сделки",
      signalStopChip: "Стоп",
      signalPool: "Пул",
      signalInMarket: "В рынке",
      signalCommentPh: "Краткий разбор сделки…",
      signalMedia: "Скрин или видео",
      signalNoTrackerHint: SIGNAL_NO_TRACKER_HINT,
      trackerExchangeOnlyHint: TRACKER_EXCHANGE_ONLY_HINT,
      trackerDailyLimit: "ЛИМИТ ДНЯ ДЛЯ ВСЕХ ТРЕЙДЕРОВ",
      trackerDailyLoss: "Потери за день",
      trackerLimit: "Лимит",
      trackerRemaining: "Остаток … из общей базы",
      trackerAdd: "Добавить трекер Hash Hedge",
      trackerEmpty: "Трекеры трейдеров появятся после подключения.",
      trackerBalance: "Баланс",
      trackerStart: "Старт",
      trackerTarget: "Цель",
      trackerDrawdown: "Просадка",
      trackerDaily: "Лимит дня",
      trackerRecon: "Сверка с пропом",
      trackerDays: "Торговые дни",
      trackerTrades: "Сделок",
      trackerSettings: "Настройки",
      rankGuideTitle: "Система рангов",
      rankGuideIntro:
        "Недельный результат → ранг. Каждый понедельник ранг обновляется автоматически. Выше ранг — больше % входа и плечо.",
      rankGuidePool: "Общий пул входа: если два трейдера заняли 100%, третий в эту сделку не войдёт.",
      rankRules: RANK_RULES,
      rankUnderstood: "Понятно",
      rankAfterFirstClose: RANK_AFTER_FIRST_CLOSE,
      rankPenaltyWarn: "−1 ранг",
      rosterFiredCooldownMsg: ROSTER_FIRED_COOLDOWN_MSG,
      themeToggleDark: "Тёмная тема",
      themeTogglePunk: "Панк-тема",
      outcomeWaiting: "Ожидание входа",
      outcomeActive: "Активен",
      outcomeMarket: "По рынку",
      outcomeTarget: "Цель достигнута",
      outcomeStop: "Стоп",
      cardEntry: "Вход",
      cardTracker: "Трекер",
      cardLeverage: "Плечо",
      cardLong: "↑ LONG",
      cardShort: "↓ SHORT",
      cardEdit: "Изменить",
      cardDelete: "Удалить",
      cardCloseMarket: "Закрыть по рынку",
      cardTrade: "+ Сделка",
      hashHedgeTradeBtn: HASH_HEDGE_TRADE_BTN,
      hashHedgeTradeHint: HASH_HEDGE_TRADE_HINT,
      hashHedgeTradeCopied: HASH_HEDGE_TRADE_COPIED,
      hashHedgeTradeCopyFailed: HASH_HEDGE_TRADE_COPY_FAILED,
      levelsCopied: LEVELS_COPIED,
      formatTrackerStageLev: (stage, leverage) => `Этап ${stage} · плечо ${leverage}`,
      formatTrackerTradesTab: (count) => `Сделки · ${count}`,
      formatFeedShowMoreClosed,
      formatTestModeBanner: testModeBannerText,
      formatSubscriptionInactiveHint: subscriptionInactiveHint,
    };
  }

  return {
    punk: true,
    productName: P.PUNK_PRODUCT_NAME,
    productTagline: P.PUNK_PRODUCT_TAGLINE,
    bootTitle: P.PUNK_BOOT_TITLE,
    bootMeta: P.PUNK_BOOT_META,
    loading: P.PUNK_LOADING,
    nav: { ...P.PUNK_NAV },
    tabTitles: { ...P.PUNK_TAB_TITLES },
    tabSubtitles: { ...P.PUNK_TAB_SUBTITLES },
    feedKicker: P.PUNK_FEED_KICKER,
    feedHeadline: P.PUNK_FEED_HEADLINE,
    feedSubKicker: "",
    feedWordCrypto: P.PUNK_FEED_WORD_CRYPTO,
    feedWordDeals: P.PUNK_FEED_WORD_DEALS,
    feedWordDealsSingle: P.PUNK_FEED_WORD_DEALS_SINGLE,
    feedInMarket: P.PUNK_FEED_IN_MARKET,
    feedAwaiting: P.PUNK_FEED_AWAITING,
    feedLabelActive: P.PUNK_FEED_LABEL_ACTIVE,
    feedLabelClosed: P.PUNK_FEED_LABEL_CLOSED,
    feedSubBanner: P.PUNK_FEED_SUB_BANNER,
    feedSubBannerBtn: P.PUNK_FEED_SUB_BANNER_BTN,
    feedEmpty: P.PUNK_FEED_EMPTY,
    feedEmptyClosed: P.PUNK_FEED_EMPTY_CLOSED,
    feedEmptyActive: P.PUNK_FEED_EMPTY_ACTIVE,
    topIntro: P.PUNK_TOP_INTRO,
    topLabelTraders: P.PUNK_TOP_LABEL_TRADERS,
    topLabelCandidates: P.PUNK_TOP_LABEL_CANDIDATES,
    topLabelFired: P.PUNK_TOP_LABEL_FIRED,
    topEmpty: P.PUNK_TOP_EMPTY,
    topCandidatesEmpty: P.PUNK_TOP_CANDIDATES_EMPTY,
    rankGuideHint: P.PUNK_RANK_GUIDE_HINT,
    volnovoiSubtitle: P.PUNK_VOLNOVOI_SUBTITLE,
    volnovoiCopyTitle: P.PUNK_VOLNOVOI_COPY_TITLE,
    volnovoiCopyDesc: P.PUNK_VOLNOVOI_COPY_DESC,
    volnovoiCopyHintBilling: P.PUNK_VOLNOVOI_COPY_HINT_BILLING,
    volnovoiCopyHintApi: P.PUNK_VOLNOVOI_COPY_HINT_API,
    volnovoiMarketingCta: P.PUNK_VOLNOVOI_MARKETING_CTA,
    subscriptionIntro: P.PUNK_SUBSCRIPTION_INTRO,
    referralShareFallback: P.PUNK_REFERRAL_SHARE_FALLBACK,
    disclaimerTitle: P.PUNK_DISCLAIMER_TITLE,
    disclaimerLead: P.PUNK_DISCLAIMER_LEAD,
    disclaimerPoints: P.PUNK_DISCLAIMER_POINTS,
    disclaimerFooter: P.PUNK_DISCLAIMER_FOOTER,
    disclaimerAccept: P.PUNK_DISCLAIMER_ACCEPT_LABEL,
    disclaimerUnderstood: P.PUNK_RANK_GUIDE_UNDERSTOOD,
    cultJoinTitle: P.PUNK_CULT_JOIN_TITLE,
    cultJoinIntro: P.PUNK_CULT_JOIN_INTRO,
    cultJoinCta: P.PUNK_CULT_JOIN_CTA,
    cultJoinStepPay: P.PUNK_CULT_JOIN_STEP_PAY,
    cultJoinStepApi: P.PUNK_CULT_JOIN_STEP_API,
    cultJoinStepConfirm: P.PUNK_CULT_JOIN_STEP_CONFIRM,
    cultJoinConfirmBtn: P.PUNK_CULT_JOIN_CONFIRM_BTN,
    cultBybitDesc: P.PUNK_CULT_BYBIT_DESC,
    cultChannelAdminHint: P.PUNK_CULT_CHANNEL_ADMIN_HINT,
    reviewRulesTitle: P.PUNK_REVIEW_RULES_TITLE,
    reviewRules: P.PUNK_REVIEW_RULES,
    partnerBybitHint: P.PUNK_PARTNER_BYBIT_HINT,
    partnerBingxHint: P.PUNK_PARTNER_BINGX_HINT,
    partnerAntarcticHint: P.PUNK_PARTNER_ANTARCTIC_HINT,
    partnerLinksTitle: P.PUNK_PARTNER_LINKS_TITLE,
    signalEntry: P.PUNK_SIGNAL_ENTRY,
    signalStop: P.PUNK_SIGNAL_STOP,
    signalTarget: P.PUNK_SIGNAL_TARGET,
    signalLeverage: P.PUNK_SIGNAL_LEVERAGE,
    signalStake: P.PUNK_SIGNAL_STAKE,
    signalBalance: P.PUNK_SIGNAL_BALANCE,
    signalNominal: P.PUNK_SIGNAL_NOMINAL,
    signalDeal: P.PUNK_SIGNAL_DEAL,
    signalLevels: P.PUNK_SIGNAL_LEVELS,
    signalPosition: P.PUNK_SIGNAL_POSITION,
    signalComment: P.PUNK_SIGNAL_COMMENT,
    signalNew: P.PUNK_SIGNAL_NEW,
    signalToFeed: P.PUNK_SIGNAL_TO_FEED,
    signalToCard: P.PUNK_SIGNAL_TO_CARD,
    signalPublish: P.PUNK_SIGNAL_PUBLISH,
    signalPublishing: P.PUNK_SIGNAL_PUBLISHING,
    signalSave: P.PUNK_SIGNAL_SAVE,
    signalTicker: P.PUNK_SIGNAL_TICKER,
    signalLong: P.PUNK_SIGNAL_LONG,
    signalShort: P.PUNK_SIGNAL_SHORT,
    signalLimits: P.PUNK_SIGNAL_LIMITS,
    signalTrades: P.PUNK_SIGNAL_TRADES,
    signalStopChip: P.PUNK_SIGNAL_STOP_CHIP,
    signalPool: P.PUNK_SIGNAL_POOL,
    signalInMarket: P.PUNK_SIGNAL_IN_MARKET,
    signalCommentPh: P.PUNK_SIGNAL_COMMENT_PH,
    signalMedia: P.PUNK_SIGNAL_MEDIA,
    signalNoTrackerHint: P.PUNK_SIGNAL_NO_TRACKER_HINT,
    trackerExchangeOnlyHint: P.PUNK_TRACKER_EXCHANGE_ONLY_HINT,
    trackerDailyLimit: P.PUNK_TRACKER_DAILY_LIMIT,
    trackerDailyLoss: P.PUNK_TRACKER_DAILY_LOSS,
    trackerLimit: P.PUNK_TRACKER_LIMIT,
    trackerRemaining: P.PUNK_TRACKER_REMAINING,
    trackerAdd: P.PUNK_TRACKER_ADD,
    trackerEmpty: P.PUNK_TRACKER_EMPTY,
    trackerBalance: P.PUNK_TRACKER_BALANCE,
    trackerStart: P.PUNK_TRACKER_START,
    trackerTarget: P.PUNK_TRACKER_TARGET,
    trackerDrawdown: P.PUNK_TRACKER_DRAWDOWN,
    trackerDaily: P.PUNK_TRACKER_DAILY,
    trackerRecon: P.PUNK_TRACKER_RECON,
    trackerDays: P.PUNK_TRACKER_DAYS,
    trackerTrades: P.PUNK_TRACKER_TRADES,
    trackerSettings: P.PUNK_TRACKER_SETTINGS,
    rankGuideTitle: PUNK_RANK_GUIDE_TITLE,
    rankGuideIntro: PUNK_RANK_GUIDE_INTRO,
    rankGuidePool: PUNK_RANK_GUIDE_POOL,
    rankRules: P.PUNK_RANK_RULES,
    rankUnderstood: P.PUNK_RANK_GUIDE_UNDERSTOOD,
    rankAfterFirstClose: P.PUNK_RANK_AFTER_FIRST_CLOSE,
    rankPenaltyWarn: P.PUNK_RANK_PENALTY_WARN,
    rosterFiredCooldownMsg: P.PUNK_ROSTER_FIRED_COOLDOWN_MSG,
    themeToggleDark: P.PUNK_THEME_TOGGLE_DARK,
    themeTogglePunk: P.PUNK_THEME_TOGGLE_PUNK,
    outcomeWaiting: P.PUNK_OUTCOME_WAITING,
    outcomeActive: P.PUNK_OUTCOME_ACTIVE,
    outcomeMarket: P.PUNK_OUTCOME_MARKET,
    outcomeTarget: P.PUNK_OUTCOME_TARGET,
    outcomeStop: P.PUNK_OUTCOME_STOP,
    cardEntry: P.PUNK_CARD_ENTRY,
    cardTracker: P.PUNK_CARD_TRACKER,
    cardLeverage: P.PUNK_CARD_LEVERAGE,
    cardLong: P.PUNK_CARD_LONG,
    cardShort: P.PUNK_CARD_SHORT,
    cardEdit: P.PUNK_CARD_EDIT,
    cardDelete: P.PUNK_CARD_DELETE,
    cardCloseMarket: P.PUNK_CARD_CLOSE_MARKET,
    cardTrade: P.PUNK_CARD_TRADE,
    hashHedgeTradeBtn: P.PUNK_HASH_HEDGE_TRADE_BTN,
    hashHedgeTradeHint: P.PUNK_HASH_HEDGE_TRADE_HINT,
    hashHedgeTradeCopied: P.PUNK_HASH_HEDGE_TRADE_COPIED,
    hashHedgeTradeCopyFailed: P.PUNK_HASH_HEDGE_TRADE_COPY_FAILED,
    levelsCopied: P.PUNK_LEVELS_COPIED,
    formatTrackerStageLev: P.PUNK_TRACKER_STAGE_LEV,
    formatTrackerTradesTab: P.PUNK_TRACKER_TRADES_TAB,
    formatFeedShowMoreClosed: P.PUNK_FORMAT_FEED_SHOW_MORE_CLOSED,
    formatTestModeBanner: P.punkTestModeBannerText,
    formatSubscriptionInactiveHint: P.punkSubscriptionInactiveHint,
  };
}

const COPY_CACHE: Partial<Record<Theme, ThemedCopy>> = {};

export function themedCopyFor(theme: Theme): ThemedCopy {
  if (!COPY_CACHE[theme]) COPY_CACHE[theme] = buildCopy(theme);
  return COPY_CACHE[theme]!;
}

export function useThemedCopy(): ThemedCopy {
  const theme = useAppTheme();
  return themedCopyFor(theme);
}

export function localizeOutcomeLabel(label: string, copy: ThemedCopy): string {
  if (!copy.punk) return label;
  const map: Record<string, string> = {
    "Ожидание входа": copy.outcomeWaiting,
    "Активен": copy.outcomeActive,
    "По рынку": copy.outcomeMarket,
    "Цель достигнута": copy.outcomeTarget,
    "Стоп": copy.outcomeStop,
  };
  return map[label] ?? label;
}
