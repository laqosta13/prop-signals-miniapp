export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0–100 */
  percent: number;
  phase: "upload" | "processing";
};

export function formatUploadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Суммарный размер файлов в FormData (для шкалы загрузки). */
export function mediaBytesInForm(form: FormData): number {
  let bytes = 0;
  form.forEach((value) => {
    if (value instanceof File) bytes += value.size;
  });
  return bytes;
}

export function initialUploadProgress(totalBytes: number): UploadProgress {
  return { loaded: 0, total: totalBytes, percent: 0, phase: "upload" };
}

export function uploadProgressLabel(hasVideo: boolean, phase: UploadProgress["phase"], supplement = false): string {
  if (phase === "processing") {
    return hasVideo ? "Сохранение видео на сервере…" : "Сохранение на сервере…";
  }
  if (supplement) {
    return hasVideo ? "Загрузка видео и публикация дополнения" : "Загрузка файлов и публикация дополнения";
  }
  return hasVideo ? "Загрузка видео и публикация сигнала" : "Загрузка файлов и публикация";
}

/** Понятное сообщение из ответа API или сетевой ошибки (в т.ч. «Load failed» в Telegram). */
export function parseUploadError(raw: string, status = 0): string {
  const text = raw.trim();
  if (/load failed|failed to fetch|network error/i.test(text)) {
    return "Сеть оборвала загрузку. Уменьшите видео или проверьте интернет (лимит до 100 МБ).";
  }
  if (status === 413) return "Файл слишком большой для сервера (максимум 100 МБ).";
  if (status === 401) return "Сессия истекла — закройте и снова откройте приложение.";
  if (status === 403) return "Нет прав на это действие.";
  try {
    const data = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d) => (typeof d === "object" && d && "msg" in d ? d.msg : String(d))).join(". ");
    }
  } catch {
    /* plain text */
  }
  if (text.includes("Файл слишком большой")) return text;
  if (text.length > 0 && text.length < 300) return text;
  if (status > 0) return `Ошибка сервера (${status})`;
  return "Не удалось загрузить файл";
}
