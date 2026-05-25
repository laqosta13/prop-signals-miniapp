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

export function uploadProgressLabel(hasVideo: boolean, phase: UploadProgress["phase"]): string {
  if (phase === "processing") {
    return hasVideo ? "Сохранение видео на сервере…" : "Сохранение на сервере…";
  }
  return hasVideo ? "Загрузка видео и публикация сигнала" : "Загрузка файлов и публикация";
}
