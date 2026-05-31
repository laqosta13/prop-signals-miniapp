type LogoProps = {
  size?: number;
  className?: string;
};

export function HashHedgeLogo({ size = 22, className }: LogoProps) {
  return (
    <img
      src="/brands/hashhedge.png"
      alt=""
      className={`brand-logo${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      aria-hidden
    />
  );
}

export function BybitLogo({ size = 22, className }: LogoProps) {
  return (
    <img
      src="/brands/bybit.png"
      alt=""
      className={`brand-logo${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      aria-hidden
    />
  );
}

export function BingXLogo({ size = 18, className }: LogoProps) {
  return (
    <svg
      className={`brand-logo brand-logo--svg${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect width="24" height="24" rx="6" fill="#1A4DFF" />
      <path
        d="M6.5 15.5L10 8.5L12.5 14L15 8.5L17.5 15.5"
        stroke="#00F0FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function AntarcticLogo({ size = 18, className }: LogoProps) {
  return (
    <svg
      className={`brand-logo brand-logo--svg${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect width="24" height="24" rx="6" fill="#0E7490" />
      <path
        d="M12 6.5L14.2 10.8H18.5L15.1 13.5L16.3 18L12 15.2L7.7 18L8.9 13.5L5.5 10.8H9.8L12 6.5Z"
        fill="#A5F3FC"
      />
    </svg>
  );
}

export type PartnerBrandId = "bybit" | "bingx" | "antarctic";

export function PartnerBrandLogo({ id, size = 18 }: { id: PartnerBrandId; size?: number }) {
  switch (id) {
    case "bybit":
      return <BybitLogo size={size} />;
    case "bingx":
      return <BingXLogo size={size} />;
    case "antarctic":
      return <AntarcticLogo size={size} />;
  }
}
