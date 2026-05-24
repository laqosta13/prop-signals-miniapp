import { useState } from "react";
import { initialsFromAuthor, mediaUrl } from "../utils";

type Props = {
  url: string | null | undefined;
  displayName?: string | null;
  username?: string | null;
  telegramId?: number;
  size?: number;
};

export function Avatar({ url, displayName, username, size = 40 }: Props) {
  const [broken, setBroken] = useState(false);
  const initials = initialsFromAuthor(displayName, username);
  const src = mediaUrl(url);

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
