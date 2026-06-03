import WebApp from "@twa-dev/sdk";

/** Имя для карточки: имя+фамилия из TG, иначе @username. */
export function telegramCardDisplayName(): string {
  const u = WebApp.initDataUnsafe?.user;
  if (!u) return "";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  if (full.length >= 2) return full;
  const login = (u.username || "").trim().replace(/^@/, "");
  return login.length >= 2 ? login : "";
}
