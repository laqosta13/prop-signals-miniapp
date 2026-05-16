import { traderName } from "../utils";

type Props = {
  url: string | null | undefined;
  username: string | null;
  telegramId: number;
  size?: number;
};

export function Avatar({ url, username, telegramId, size = 40 }: Props) {
  const name = traderName(username, telegramId);
  const initials = name.replace("@", "").slice(0, 2).toUpperCase() || "?";

  if (url) {
    return (
      <img
        className="avatar"
        src={url}
        alt={name}
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
