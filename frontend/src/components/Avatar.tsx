import { initialsFromAuthor } from "../utils";

type Props = {
  url: string | null | undefined;
  displayName?: string | null;
  username?: string | null;
  telegramId?: number;
  size?: number;
};

export function Avatar({ url, displayName, username, size = 40 }: Props) {
  const initials = initialsFromAuthor(displayName, username);

  if (url) {
    return (
      <img
        className="avatar"
        src={url}
        alt={displayName || username || "Аватар"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span className="avatar avatar--fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
