import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Классическая шапка ленты: лого слева, на одной линии с надписями, ширина = блок текста. */
export function ClassicFeedBrand({ children }: Props) {
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

  return (
    <span className="topbar__marketplace-brand">
      <img
        src="/brands/vc-logo.png"
        alt=""
        className="topbar__marketplace-logo topbar__marketplace-logo-img"
        width={logoSize}
        height={logoSize}
        draggable={false}
      />
      <span ref={copyRef} className="topbar__marketplace-copy">
        {children}
      </span>
    </span>
  );
}
