import { formatDateTimeMsk } from "../utils";
import { copyReconnectBlocked } from "../utils/copyReconnect";

type Props = {
  reconnectAllowedAfter: string | null | undefined;
};

export function CopyReconnectNotice({ reconnectAllowedAfter }: Props) {
  if (!copyReconnectBlocked(reconnectAllowedAfter)) return null;

  return (
    <p className="copy-reconnect-notice" role="status">
      Повторное подключение API — после{" "}
      <strong>{formatDateTimeMsk(reconnectAllowedAfter)} МСК</strong> (не раньше 24 ч и ночного
      выставления счёта).
    </p>
  );
}
