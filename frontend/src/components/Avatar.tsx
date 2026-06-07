import { useState } from "react";
import { useAppTheme } from "../hooks/useAppTheme";
import { initialsFromAuthor, mediaUrl } from "../utils";
import { isPunkTheme } from "../utils/punkTheme";
import { MysteryAvatar } from "./MysteryAvatar";

type Props = {
  url: string | null | undefined;
  displayName?: string | null;
  username?: string | null;
  telegramId?: number;
  size?: number;
};

export function Avatar({ url, displayName, username, size = 40 }: Props) {
  const theme = useAppTheme();
  const [broken, setBroken] = useState(false);
  const initials = initialsFromAuthor(displayName, username);
  const src = mediaUrl(url);
  const label = displayName || username || "Оператор";

  if (isPunkTheme(theme)) {
    return <MysteryAvatar size={size} label={label} />;
  }

  if (src && !broken) {
    return (
      <img
        className="avatar"
        src={src}
        alt={displayName || username || "Аватар"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className="avatar avatar--fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
