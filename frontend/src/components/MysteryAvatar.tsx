type Props = {
  size: number;
  label?: string;
};

/** Загадочный силуэт в панк-теме — без реального фото. */
export function MysteryAvatar({ size, label = "Оператор" }: Props) {
  const eye = Math.max(4, Math.round(size * 0.1));
  const gap = Math.max(5, Math.round(size * 0.14));

  return (
    <span
      className="avatar avatar--mystery"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <span className="avatar__mystery-hood" aria-hidden />
      <span className="avatar__mystery-face" style={{ gap }} aria-hidden>
        <span className="avatar__mystery-eye" style={{ width: eye, height: eye }} />
        <span className="avatar__mystery-eye" style={{ width: eye, height: eye }} />
      </span>
      <span className="avatar__mystery-scan" aria-hidden />
    </span>
  );
}
