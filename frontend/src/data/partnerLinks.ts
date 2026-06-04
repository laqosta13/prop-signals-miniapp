import type { PartnerBrandId } from "../components/BrandLogos";
import { PARTNER_BYBIT_HINT } from "./appCopy";

/** Реферальные ссылки на биржи и вывод средств. */

export const BYBIT_REGISTER_URL =
  "https://www.bybit.com/invite?ref=NGG05Y&medium=referral&utm_campaign=evergreen";

export const BINGX_REGISTER_URL = "https://bingxdao.com/invite/QX0ZBR/";

export const ANTARCTIC_WALLET_URL =
  "https://t.me/antarctic_wallet_bot/app?startapp=ref_878d8194ae";

export type PartnerLink = {
  id: PartnerBrandId;
  shortLabel: string;
  hint: string;
  url: string;
};

export const PARTNER_LINKS: PartnerLink[] = [
  {
    id: "bybit",
    shortLabel: "Bybit",
    hint: PARTNER_BYBIT_HINT,
    url: BYBIT_REGISTER_URL,
  },
  {
    id: "bingx",
    shortLabel: "BingX",
    hint: "Регистрация BingX",
    url: BINGX_REGISTER_URL,
  },
  {
    id: "antarctic",
    shortLabel: "Antarctic",
    hint: "Вывод крипты и оплата по СБП",
    url: ANTARCTIC_WALLET_URL,
  },
];
