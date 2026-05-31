import { useId } from "react";

type LogoProps = {
  size?: number;
  className?: string;
};

/** Упрощённый марк Hash Hedge (ромб + H). */
export function HashHedgeLogo({ size = 22, className }: LogoProps) {
  const gradId = useId();

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"
        fill={`url(#${gradId})`}
        stroke="#0a3d2e"
        strokeWidth="0.6"
      />
      <path
        d="M9.2 8.2h1.45v2.35h2.7V8.2h1.45v7.6h-1.45v-2.85h-2.7v2.85H9.2V8.2Z"
        fill="#062a1f"
      />
      <defs>
        <linearGradient id={gradId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5dffb0" />
          <stop offset="1" stopColor="#22c55e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Упрощённый марк Bybit. */
export function BybitLogo({ size = 22, className }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#F7A600" />
      <path
        d="M7 6.5h4.35c2.05 0 3.55 1.28 3.55 3.02 0 1.12-.62 2.02-1.58 2.48 1.12.48 1.98 1.55 1.98 2.92 0 2.02-1.68 3.38-4.02 3.38H7V6.5Zm2.05 3.55h2.28c.78 0 1.22-.42 1.22-1.05 0-.64-.44-1.06-1.22-1.06H9.05v2.11Zm0 4.35h2.58c.92 0 1.48-.46 1.48-1.18 0-.72-.56-1.2-1.48-1.2H9.05v2.38Z"
        fill="#000"
      />
    </svg>
  );
}
