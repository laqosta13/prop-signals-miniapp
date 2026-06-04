export const SUPPORT_TITLE = "Поддержка";

export const SUPPORT_LEAD = "Напишите вопрос — ответ придёт сюда в чате.";

export const SUPPORT_CHAT_HINT =
  "Админ отвечает в группе поддержки (ответом на ваше сообщение). Дубликат ответа придёт в Telegram.";

export const SUPPORT_UNAVAILABLE =
  "Чат поддержки временно недоступен. Задайте TELEGRAM_SUPPORT_GROUP_ID на сервере.";

export const SUPPORT_INPUT_PLACEHOLDER = "Сообщение…";

export const SUPPORT_SEND_LABEL = "Отправить";

const SUPPORT_SEND_ERRORS: Record<string, string> = {
  support_chat_disabled:
    "Чат не настроен на сервере: нужны BOT_TOKEN и TELEGRAM_SUPPORT_GROUP_ID, затем перезапуск.",
  support_group_not_found:
    "Группа не найдена. Проверьте TELEGRAM_SUPPORT_GROUP_ID (формат -100… для супергруппы).",
  support_bot_not_in_group:
    "Бот не в группе. Добавьте бота в группу поддержки и сделайте администратором.",
  support_bot_no_send_rights:
    "Бот не может писать в группу. Выдайте право отправлять сообщения.",
  support_group_id_outdated:
    "Устаревший ID группы. Узнайте новый id у @getidsbot после превращения в супергруппу.",
  group_send_failed:
    "Не удалось отправить в группу Telegram. Проверьте бота в группе и логи сервера.",
  support_message_format: "Не удалось отправить сообщение. Попробуйте без спецсимволов < > &.",
};

export function formatSupportSendError(raw: string): string {
  const code = raw.trim();
  return SUPPORT_SEND_ERRORS[code] ?? raw;
}
