import { useAppTheme } from "../hooks/useAppTheme";
import { VcPunkLogoMark } from "./VcPunkLogoMark";

type Props = {
  size?: number;
  className?: string;
};

/** VC: классический PNG в ТЕ, кибер-SVG в МА. */
export function VcSplitLogo({ size = 32, className = "" }: Props) {
  const punk = useAppTheme() === "punk";

  return (
    <span
      className={`vc-split-logo vc-split-logo--${punk ? "punk" : "classic"}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Volnovoi Cult"
    >
      <img
        src="/brands/vc-logo.png"
        alt=""
        className="vc-split-logo__classic"
        draggable={false}
      />
      <VcPunkLogoMark className="vc-split-logo__punk" />
    </span>
  );
}
