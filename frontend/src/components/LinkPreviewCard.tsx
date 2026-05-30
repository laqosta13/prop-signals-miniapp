import type { NewsLinkPreview } from "../api";

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

export function LinkPreviewCard({ link, compact = false }: Props) {
  const title = link.title?.trim() || hostLabel(link.url);
  const description = link.description?.trim();
  const host = hostLabel(link.url);

  return (
    <a
      className={`link-preview${compact ? " link-preview--compact" : ""}`}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {link.image_url && (
        <div className="link-preview__media">
          <img src={link.image_url} alt="" loading="lazy" />
        </div>
      )}
      <div className="link-preview__body">
        <span className="link-preview__host">{host}</span>
        <strong className="link-preview__title">{title}</strong>
        {description && <p className="link-preview__desc">{description}</p>}
      </div>
    </a>
  );
}
