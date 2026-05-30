import { useState } from "react";
import WebApp from "@twa-dev/sdk";
import type { NewsLinkPreview } from "../api";
import { isYouTubeUrl, linkSiteName, youtubeEmbedUrl, youtubeVideoId } from "../utils/linkPreview";

type Props = {
  link: NewsLinkPreview;
  compact?: boolean;
};

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function YouTubePlayIcon() {
  return (
    <svg className="link-preview__play-icon" viewBox="0 0 68 48" aria-hidden>
      <path
        d="M66.52 7.74a8.2 8.2 0 0 0-5.78-5.82C55.82 1 34 1 34 1S12.18 1 7.26 1.92A8.2 8.2 0 0 0 1.48 7.74 86.6 86.6 0 0 0 0 24a86.6 86.6 0 0 0 1.48 16.26 8.2 8.2 0 0 0 5.78 5.82C12.18 47 34 47 34 47s21.82 0 26.74-.92a8.2 8.2 0 0 0 5.78-5.82A86.6 86.6 0 0 0 68 24a86.6 86.6 0 0 0-1.48-16.26Z"
        fill="currentColor"
      />
      <path d="M45 24 27 14v20Z" fill="#fff" />
    </svg>
  );
}

function openExternalLink(url: string) {
  if (WebApp.openLink) {
    WebApp.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function LinkPreviewCard({ link, compact = false }: Props) {
  const [playing, setPlaying] = useState(false);
  const title = link.title?.trim() || hostLabel(link.url);
  const description = link.description?.trim();
  const site = linkSiteName(link.url);
  const isYouTube = isYouTubeUrl(link.url);
  const videoId = isYouTube ? youtubeVideoId(link.url) : null;
  const canEmbed = Boolean(videoId);

  const onExternalClick = () => openExternalLink(link.url);

  return (
    <div className={`link-preview-wrap${compact ? " link-preview-wrap--compact" : ""}`}>
      <div
        className={`link-preview${compact ? " link-preview--compact" : ""}${!isYouTube ? " link-preview--external" : ""}`}
        role={!isYouTube ? "button" : undefined}
        tabIndex={!isYouTube ? 0 : undefined}
        onClick={!isYouTube ? onExternalClick : undefined}
        onKeyDown={
          !isYouTube
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onExternalClick();
                }
              }
            : undefined
        }
      >
        <div className="link-preview__accent">
          <div className="link-preview__body">
            <span className="link-preview__site">{site}</span>
            <strong className="link-preview__title">{title}</strong>
            {description && <p className="link-preview__desc">{description}</p>}
          </div>
          {link.image_url &&
            (playing && canEmbed ? (
              <div className="link-preview__media link-preview__media--embed">
                <iframe
                  title={title}
                  src={youtubeEmbedUrl(videoId!)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <button
                type="button"
                className={`link-preview__media${isYouTube && canEmbed ? " link-preview__media--video" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEmbed) {
                    setPlaying(true);
                    return;
                  }
                  onExternalClick();
                }}
                aria-label={canEmbed ? "Смотреть на месте" : "Открыть ссылку"}
              >
                <img src={link.image_url} alt="" loading="lazy" />
                {isYouTube && canEmbed && (
                  <span className="link-preview__play" aria-hidden>
                    <YouTubePlayIcon />
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
