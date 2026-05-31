/** Реферальные ссылки на биржи и вывод средств. */

export const BYBIT_REGISTER_URL =
  "https://www.bybit.com/invite?ref=NGG05Y&medium=referral&utm_campaign=evergreen";

export const BINGX_REGISTER_URL = "https://bingxdao.com/invite/QX0ZBR/";

export const ANTARCTIC_WALLET_URL =
  "https://t.me/antarctic_wallet_bot/app?startapp=ref_878d8194ae";

export type PartnerLink = {
  id: string;
  label: string;
  hint: string;
  url: string;
};

export const PARTNER_LINKS: PartnerLink[] = [
  {
    id: "bybit",
    label: "Регистрация Bybit",
    hint: "Биржа для копирования volnovoi",
    url: BYBIT_REGISTER_URL,
  },
  {
    id: "bingx",
    label: "Регистрация BingX",
    hint: "Альтернативная биржа",
    url: BINGX_REGISTER_URL,
  },
  {
    id: "antarctic",
    label: "Вывод крипты · оплата по СБП",
    hint: "Antarctic Wallet",
    url: ANTARCTIC_WALLET_URL,
  },
];
