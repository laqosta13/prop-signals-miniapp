import { useAppTheme } from "../hooks/useAppTheme";

type Props = {
  size?: number;
  className?: string;
};

/** VC в шестиугольнике: левая половина (V) — классика, правая (C) — панк. */
export function VcSplitLogo({ size = 32, className = "" }: Props) {
  const theme = useAppTheme();
  const punk = theme === "punk";

  return (
    <span
      className={`vc-split-logo${punk ? " vc-split-logo--punk-active" : " vc-split-logo--classic-active"}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Volnovoi Cult"
    >
      <img src="/brands/vc-logo.png" alt="" className="vc-split-logo__half vc-split-logo__half--classic" draggable={false} />
      <img src="/brands/vc-logo.png" alt="" className="vc-split-logo__half vc-split-logo__half--punk" draggable={false} />
      <span className="vc-split-logo__seam" aria-hidden />
    </span>
  );
}
