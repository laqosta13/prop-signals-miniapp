import { useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignalWithMedia, fetchMarketPrice } from "../api";
import type { UploadProgress } from "../api";
import { useAdminTrackerSnapshot } from "../hooks/useAdminTrackerSnapshot";
import { preserveAccountStopOnLeverageChange, useDailyStopSync } from "../hooks/useDailyStopSync";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { normalizeTakeProfits } from "../utils";
import { ruTextFieldProps } from "../utils/textFieldProps";
import { entryNominalUsd, parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { formatRiskPct } from "../utils/signalLevels";
import {
  dailyLimitBlockedMessage,
  dailyTradingBlocked,
  dailyTradesRemaining,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../utils/dailyStopLimit";
import {
  initialUploadProgress,
  mediaBytesInForm,
  uploadProgressLabel,
} from "../utils/upload";
import { UploadProgressBar } from "./UploadProgressBar";
import { LeveragePicker } from "./LeveragePicker";
import { RiskPercentSlider } from "./RiskPercentSlider";
import { SignalLevelsFields } from "./SignalLevelsFields";
import { SignalMediaPicker } from "./SignalMediaPicker";
import { FieldLabelWithPaste, appendPastedText } from "./FieldLabelWithPaste";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const DEFAULT_SYMBOL = "BTCUSDT";

export function NewSignalModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [leverage, setLeverage] = useState("1");
  const [risk, setRisk] = useState("10");
  const [comment, setComment] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const {
    direction,
    entry,
    stop,
    target,
    riskPct,
    setDirection,
    onEntryChange,
    onStopChange,
    onTargetChange,
    onRiskPctChange,
    applyMarketPrice,
    resetForm,
  } = useSignalLevelFields("long");

  const directionRef = useRef(direction);
  directionRef.current = direction;

  const { snapshot: trackerSnap, loading: trackerLoading } = useAdminTrackerSnapshot(open);

  const stakePct = parseRiskPercent(risk);
  const lev = parseLeverage(leverage);
  const { dailyRemaining, dailyLossPct, blocked: dailyStopBlocked } = useDailyStopSync({
    enabled: open && !trackerLoading,
    riskPct,
    onRiskPctChange,
    dailyLossPct: trackerSnap?.dailyLossPct,
    stakePct,
    leverage: lev,
  });

  const loadMarketPrice = useCallback(
    async (sym: string) => {
      const normalized = sym.trim().toUpperCase();
      if (!normalized) return;
      setPriceLoading(true);
      try {
        const { price } = await fetchMarketPrice(normalized);
        applyMarketPrice(price, directionRef.current);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить курс");
      } finally {
        setPriceLoading(false);
      }
    },
    [applyMarketPrice],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSymbol(DEFAULT_SYMBOL);
    setLeverage("1");
    setRisk("10");
    setComment("");
    resetForm();
    setScreenshot(null);
    setVideo(null);
    setShotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void loadMarketPrice(symbol);
    }, 150);
    return () => clearTimeout(t);
  }, [symbol, open, loadMarketPrice]);

  if (!open) return null;

  const trackerBalance = trackerSnap?.balance ?? 0;
  const balanceForNominal = trackerBalance > 0 ? trackerBalance : (trackerSnap?.accountSize ?? 0);
  const stakeUsd = entryNominalUsd(balanceForNominal, stakePct, lev);
  const dailyTradesCount = trackerSnap?.dailyTradesCount ?? 0;
  const dailyTradesLimit = trackerSnap?.dailyTradesLimit ?? SIGNAL_DAILY_TRADE_LIMIT;
  const dailyLimit = dailyTradingBlocked({
    dailyLossPct,
    dailyTradesCount,
    dailyTradesLimit,
  });
  const formBlocked = dailyLimit.blocked;
  const dailyTradesRemainingCount = dailyTradesRemaining(dailyTradesCount, dailyTradesLimit);

  const onScreenshot = (file: File | null) => {
    setScreenshot(file);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
  };

  const onVideo = (file: File | null) => {
    setVideo(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("symbol", symbol);
      fd.append("direction", direction);
      if (entry) {
        fd.append("entry_low", entry);
        fd.append("entry_high", entry);
      }
      if (stop) fd.append("stop_loss", stop);
      const tp = normalizeTakeProfits(target);
      if (tp) fd.append("take_profits", tp);
      if (comment) fd.append("comment", comment);
      fd.append("leverage", String(parseLeverage(leverage)));
      fd.append("risk_percent", String(parseRiskPercent(risk)));
      if (screenshot) fd.append("screenshot", screenshot);
      if (video) fd.append("video", video);

      const uploadBytes = mediaBytesInForm(fd);
      const trackUpload = uploadBytes > 0;
      if (trackUpload) {
        setUploadProgress(initialUploadProgress(uploadBytes));
      } else {
        setUploadProgress(null);
      }

      await createSignalWithMedia(fd, trackUpload ? (p) => setUploadProgress(p) : undefined);
      WebApp.HapticFeedback.notificationOccurred("success");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="modal-backdrop modal-backdrop--sheet modal-backdrop--signal" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <div>
            <h2>Новый сигнал</h2>
            <p>Публикация в ленту</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="field-label">Инструмент</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} required />

        <label className="field-label">Направление</label>
        <div className="dir-toggle">
          <button type="button" className={direction === "long" ? "active long" : ""} onClick={() => setDirection("long")}>
            LONG
          </button>
          <button type="button" className={direction === "short" ? "active short" : ""} onClick={() => setDirection("short")}>
            SHORT
          </button>
        </div>

        <SignalLevelsFields
          entry={entry}
          stop={stop}
          target={target}
          riskPct={riskPct}
          priceLoading={priceLoading}
          onEntryChange={onEntryChange}
          onStopChange={onStopChange}
          onTargetChange={onTargetChange}
          onRiskPctChange={onRiskPctChange}
          stakePct={stakePct}
          leverage={lev}
          dailyRemainingPct={dailyRemaining}
          dailyLossPct={dailyLossPct}
          dailyStopBlocked={dailyStopBlocked}
        />
        {priceLoading && <p className="meta">Загрузка курса Bybit USDT perpetual…</p>}

        <label className="field-label">Плечо</label>
        <LeveragePicker
          leverage={leverage}
          onLeverageChange={(nextLev, nextRisk) => {
            const prevStake = parseRiskPercent(risk);
            const prevLev = parseLeverage(leverage);
            setLeverage(nextLev);
            setRisk(nextRisk);
            const nextPrice = preserveAccountStopOnLeverageChange({
              riskPct,
              prevStakePct: prevStake,
              prevLeverage: prevLev,
              nextStakePct: parseRiskPercent(nextRisk),
              nextLeverage: parseLeverage(nextLev),
              dailyRemaining: dailyRemaining ?? 2,
            });
            if (nextPrice) onRiskPctChange(nextPrice);
          }}
        />

        <RiskPercentSlider value={risk} onChange={setRisk} />

        <label className="field-label">Трекер $</label>
        <input
          value={
            trackerLoading
              ? "Загрузка…"
              : trackerBalance > 0
                ? String(Math.round(trackerBalance))
                : "—"
          }
          readOnly
          className="readonly"
        />
        {balanceForNominal > 0 && (
          <p className="meta signal-nominal">
            Номинал позиции:{" "}
            <span className="signal-nominal__usd">
              ${stakeUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>{" "}
            (<span className="signal-nominal__pct">{risk}%</span> × <span className="signal-nominal__lev">{lev}x</span>)
          </p>
        )}
        {balanceForNominal > 0 && (
          <p className="meta signal-nominal-hint">Номинал от текущего баланса трекера</p>
        )}
        {!trackerLoading && (
          <>
            <p className="meta signal-daily-trades">
              Лимит: 3 сделки или 2% стопа · остаток{" "}
              <strong>
                {dailyTradesRemainingCount} сделок · {formatRiskPct(dailyRemaining ?? 0)}% стопа
              </strong>
            </p>
            {formBlocked && (
              <p className="err signal-daily-trades-blocked">
                {dailyLimitBlockedMessage(dailyLimit.reason)}
              </p>
            )}
          </>
        )}

        <SignalMediaPicker
          screenshot={screenshot}
          video={video}
          shotPreview={shotPreview}
          onScreenshot={onScreenshot}
          onVideo={onVideo}
        />

        <FieldLabelWithPaste
          label="Комментарий (на русском)"
          onPaste={(text) => setComment((prev) => appendPastedText(prev, text))}
          disabled={submitting}
        />
        <textarea {...ruTextFieldProps} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Краткий анализ по-русски…" />

        {error && <p className="err">{error}</p>}

        {submitting && uploadProgress && (
          <UploadProgressBar
            progress={uploadProgress}
            label={uploadProgressLabel(!!video, uploadProgress.phase)}
          />
        )}

        <button type="submit" className="submit-btn" disabled={submitting || priceLoading || formBlocked}>
          {submitting && uploadProgress
            ? uploadProgress.phase === "processing"
              ? "Сохранение…"
              : `Загрузка… ${uploadProgress.percent}%`
            : submitting
              ? "Публикация…"
              : "Опубликовать сигнал"}
        </button>
      </form>
    </div>
  );
}
