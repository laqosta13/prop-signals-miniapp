import { PARTNER_LINKS } from "../data/partnerLinks";
import { openExternalLink } from "../utils/openExternalLink";
import { BybitLogo } from "./BrandLogos";

export function PartnerLinks() {
  return (
    <section className="partner-links" aria-label="Биржи и вывод средств">
      {PARTNER_LINKS.map((link) => (
        <button
          key={link.id}
          type="button"
          className="partner-links__btn"
          title={link.hint}
          onClick={() => openExternalLink(link.url)}
        >
          <span className="cta-btn__label">
            {link.id === "bybit" ? <BybitLogo size={22} /> : null}
            <span>{link.label}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
