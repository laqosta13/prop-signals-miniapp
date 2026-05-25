export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0–100 или -1 если размер неизвестен */
  percent: number;
};

export function formatUploadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
