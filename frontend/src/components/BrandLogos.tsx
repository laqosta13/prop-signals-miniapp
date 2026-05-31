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
