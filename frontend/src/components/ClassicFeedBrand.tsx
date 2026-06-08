import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAppTheme } from "../hooks/useAppTheme";
import { VcSplitLogo } from "./VcSplitLogo";

type Props = {
  children: ReactNode;
};

/** Шапка ленты: лого слева, на одной линии с надписями, ширина = блок текста (ТЕ и МА). */
export function ClassicFeedBrand({ children }: Props) {
  const punk = useAppTheme() === "punk";
  const copyRef = useRef<HTMLSpanElement>(null);
  const [logoSize, setLogoSize] = useState(34);

  useLayoutEffect(() => {
    const el = copyRef.current;
    if (!el) return;

    const update = () => {
      const w = el.getBoundingClientRect().width;
      setLogoSize(Math.min(Math.max(Math.round(w), 28), 72));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const brandStyle = { "--feed-logo-size": `${logoSize}px` } as CSSProperties;

  return (
    <span className="topbar__marketplace-brand" style={brandStyle}>
      <span
        className="topbar__marketplace-logo-wrap"
        style={{ width: logoSize, height: logoSize }}
        aria-hidden
      >
        {punk ? (
          <VcSplitLogo size={logoSize} />
        ) : (
          <img
            src="/brands/vc-logo.png"
            alt=""
            className="topbar__marketplace-logo-img"
            width={logoSize}
            height={logoSize}
            draggable={false}
          />
        )}
      </span>
      <span ref={copyRef} className="topbar__marketplace-copy">
        {children}
      </span>
    </span>
  );
}
