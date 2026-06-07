import { PARTNER_LINKS, type PartnerLink } from "../data/partnerLinks";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { openExternalLink } from "../utils/openExternalLink";
import { PartnerBrandLogo, type PartnerBrandId } from "./BrandLogos";

type Props = {
  /** Заголовок над чипами. */
  title?: string;
  /** Показать только выбранные партнёры. */
  ids?: PartnerBrandId[];
};

export function PartnerLinks({ title, ids }: Props) {
  const copy = useThemedCopy();
  const hintFor = (id: PartnerBrandId) => {
    if (id === "bybit") return copy.partnerBybitHint;
    if (id === "bingx") return copy.partnerBingxHint;
    if (id === "antarctic") return copy.partnerAntarcticHint;
    return "";
  };
  const links: PartnerLink[] = ids?.length
    ? PARTNER_LINKS.filter((l) => ids.includes(l.id))
    : PARTNER_LINKS;

  if (links.length === 0) return null;

  return (
    <section className="partner-strip" aria-label={title ?? copy.partnerLinksTitle}>
      {title ? <p className="partner-strip__title">{title}</p> : null}
      <div className="partner-strip__row">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            className="partner-chip"
            title={hintFor(link.id) || link.hint}
            aria-label={hintFor(link.id) || link.hint}
            onClick={() => openExternalLink(link.url)}
          >
            <PartnerBrandLogo id={link.id} size={18} />
            <span>{link.shortLabel}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
