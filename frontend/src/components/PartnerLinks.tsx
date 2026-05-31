import { PARTNER_LINKS, type PartnerLink } from "../data/partnerLinks";
import { openExternalLink } from "../utils/openExternalLink";
import { PartnerBrandLogo, type PartnerBrandId } from "./BrandLogos";

type Props = {
  /** Заголовок над чипами. */
  title?: string;
  /** Показать только выбранные партнёры. */
  ids?: PartnerBrandId[];
};

export function PartnerLinks({ title = "Партнёры", ids }: Props) {
  const links: PartnerLink[] = ids?.length
    ? PARTNER_LINKS.filter((l) => ids.includes(l.id))
    : PARTNER_LINKS;

  if (links.length === 0) return null;

  return (
    <section className="partner-strip" aria-label={title}>
      {title ? <p className="partner-strip__title">{title}</p> : null}
      <div className="partner-strip__row">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            className="partner-chip"
            title={link.hint}
            aria-label={link.hint}
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
