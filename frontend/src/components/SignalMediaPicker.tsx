import { useRef } from "react";
import { formatUploadSize } from "../utils/upload";

export const SIGNAL_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

type Props = {
  screenshot: File | null;
  video: File | null;
  shotPreview: string | null;
  onScreenshot: (file: File | null) => void;
  onVideo: (file: File | null) => void;
  existingImageUrl?: string | null;
  existingVideoUrl?: string | null;
  removeScreenshot?: boolean;
  removeVideo?: boolean;
  onRemoveScreenshot?: (remove: boolean) => void;
  onRemoveVideo?: (remove: boolean) => void;
  label?: string;
};

export function SignalMediaPicker({
  screenshot,
  video,
  shotPreview,
  onScreenshot,
  onVideo,
  existingImageUrl,
  existingVideoUrl,
  removeScreenshot = false,
  removeVideo = false,
  onRemoveScreenshot,
  onRemoveVideo,
  label = "Скрин или видео",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const imageSrc = shotPreview || (removeScreenshot ? null : existingImageUrl) || null;
  const hasExistingVideo = !!existingVideoUrl && !removeVideo && !video;
  const hasMedia = !!imageSrc || !!screenshot || !!video || hasExistingVideo;

  const openPicker = () => inputRef.current?.click();

  const onPick = (file: File | null) => {
    if (!file) return;
    if (isVideoFile(file)) {
      onVideo(file);
      if (onRemoveVideo) onRemoveVideo(false);
      return;
    }
    if (isImageFile(file)) {
      onScreenshot(file);
      if (onRemoveScreenshot) onRemoveScreenshot(false);
    }
  };

  const clearScreenshot = () => {
    onScreenshot(null);
    if (existingImageUrl && onRemoveScreenshot) onRemoveScreenshot(true);
  };

  const clearVideo = () => {
    onVideo(null);
    if (existingVideoUrl && onRemoveVideo) onRemoveVideo(true);
  };

  return (
    <div className="signal-media-picker">
      <label className="field-label">{label}</label>
      <input
        ref={inputRef}
        type="file"
        className="signal-media-picker__input"
        accept={SIGNAL_MEDIA_ACCEPT}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <button type="button" className="signal-media-picker__btn" onClick={openPicker}>
        📎 Прикрепить скрин или видео
      </button>

      {hasMedia && (
        <div className="signal-media-picker__list">
          {imageSrc && (
            <div className="signal-media-picker__item">
              <img src={imageSrc} alt="Скрин" className="media-preview" />
              <button type="button" className="signal-media-picker__remove" onClick={clearScreenshot}>
                Убрать скрин
              </button>
            </div>
          )}
          {(video || hasExistingVideo) && (
            <div className="signal-media-picker__item signal-media-picker__item--video">
              <p className="meta">
                🎬 {video ? `${video.name} (${formatUploadSize(video.size)})` : "Текущее видео в сделке"}
              </p>
              <button type="button" className="signal-media-picker__remove" onClick={clearVideo}>
                Убрать видео
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
