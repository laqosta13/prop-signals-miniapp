import { normalizeTakeProfits } from "../utils";
import { parseLeverage, parseRiskPercent } from "./signalForm";

export type SignalFormPayload = {
  symbol: string;
  direction: "long" | "short";
  entry: string;
  stop: string;
  target: string;
  comment: string;
  leverage: string;
  risk: string;
  screenshot: File | null;
  video: File | null;
  removeScreenshot?: boolean;
  removeVideo?: boolean;
  /** Редактирование: комментарий всегда в теле запроса. */
  alwaysSendComment?: boolean;
};

export function buildSignalFormData(payload: SignalFormPayload): FormData {
  const fd = new FormData();
  fd.append("symbol", payload.symbol);
  fd.append("direction", payload.direction);
  if (payload.entry) {
    fd.append("entry_low", payload.entry);
    fd.append("entry_high", payload.entry);
  }
  if (payload.stop) fd.append("stop_loss", payload.stop);
  const tp = normalizeTakeProfits(payload.target);
  if (tp) fd.append("take_profits", tp);
  if (payload.alwaysSendComment || payload.comment) {
    fd.append("comment", payload.comment);
  }
  fd.append("leverage", String(parseLeverage(payload.leverage)));
  fd.append("risk_percent", String(parseRiskPercent(payload.risk)));
  if (payload.removeScreenshot != null) {
    fd.append("remove_screenshot", payload.removeScreenshot ? "true" : "false");
  }
  if (payload.removeVideo != null) {
    fd.append("remove_video", payload.removeVideo ? "true" : "false");
  }
  if (payload.screenshot) fd.append("screenshot", payload.screenshot);
  if (payload.video) fd.append("video", payload.video);
  return fd;
}
