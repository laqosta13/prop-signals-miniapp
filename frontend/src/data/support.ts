export {
  SUPPORT_CHAT_HINT,
  SUPPORT_INPUT_PLACEHOLDER,
  SUPPORT_LEAD,
  SUPPORT_SEND_LABEL,
  SUPPORT_TITLE,
  SUPPORT_UNAVAILABLE,
} from "./appCopy";

const SUPPORT_SEND_ERRORS: Record<string, string> = {
  support_chat_disabled:
    "Чат не настроен: BOT_TOKEN и TELEGRAM_SUPPORT_GROUP_ID на сервере, затем перезапуск.",
  support_group_not_found:
    "Группа не найдена. TELEGRAM_SUPPORT_GROUP_ID в формате -100…",
  support_bot_not_in_group: "Добавьте бота в группу поддержки (лучше — админом).",
  support_bot_no_send_rights: "Дайте боту право писать в группу.",
  support_group_id_outdated: "Устаревший ID группы — узнайте новый у @getidsbot.",
  group_send_failed: "Не удалось отправить в Telegram. Проверьте бота в группе.",
  support_message_format: "Не отправилось. Уберите символы < > &.",
};

export function formatSupportSendError(raw: string): string {
  const code = raw.trim();
  return SUPPORT_SEND_ERRORS[code] ?? raw;
}
