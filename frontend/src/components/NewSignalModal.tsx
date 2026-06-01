import { useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignalWithMedia, fetchMarketPrice } from "../api";
import type { UploadProgress } from "../api";
import { useAdminTrackerSnapshot } from "../hooks/useAdminTrackerSnapshot";
import { preserveAccountStopOnLeverageChange, useDailyStopSync } from "../hooks/useDailyStopSync";
import { useSignalLevelFields } from "../hooks/useSignalLevelFields";
import { normalizeTakeProfits } from "../utils";
import { ruTextFieldProps } from "../utils/textFieldProps";
import { entryNominalUsd, formatRiskPercent, parseLeverage, parseRiskPercent } from "../utils/signalForm";
import { parseRiskPctValue } from "../utils/signalLevels";
import {
  ACCOUNT_STOP_MIN_STEP,
  dailyTradingBlocked,
  dailyTradesRemaining,
  priceStopToAccountRiskPct,
  SIGNAL_DAILY_TRADE_LIMIT,
} from "../utils/dailyStopLimit";
import {
  accountStopPctFromTracker,
  defaultStakePct,
  formatPriceRiskFromAccountStop,
  formatStakeForForm,
} from "../utils/signalFormLimits";
import {
  initialUploadProgress,
  mediaBytesInForm,
  uploadProgressLabel,
} from "../utils/upload";
import { UploadProgressBar } from "./UploadProgressBar";
import { SignalLevelsFields } from "./SignalLevelsFields";
import { SignalMediaPicker } from "./SignalMediaPicker";
import { appendPastedText } from "./FieldLabelWithPaste";
import { isTelegramDesktop } from "../utils/platform";
import { PasteButton } from "./PasteButton";
import { SignalFormSection } from "./signal-form/SignalFormSection";
import { SignalFormLimitsBar } from "./signal-form/SignalFormLimitsBar";
import { SignalFormPositionCard } from "./signal-form/SignalFormPositionCard";

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
  const [accountStopSel, setAccountStopSel] = useState<number | null>(null);
  const priceInitKeyRef = useRef<string | null>(null);

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

  const maxStakePct = trackerSnap?.maxStakePct ?? 100;
  const stakePoolBlocked = !trackerLoading && maxStakePct <= 0;

  useEffect(() => {
    if (!open || trackerLoading || trackerSnap == null) return;
    const cap = trackerSnap.maxStakePct;
    if (parseRiskPercent(risk) > cap) {
      setRisk(formatRiskPercent(Math.max(0, cap)));
    }
  }, [open, trackerLoading, trackerSnap?.maxStakePct, risk]);

  const stakePct = parseRiskPercent(risk);
  const lev = parseLeverage(leverage);
  const { dailyRemaining, dailyLossPct, blocked: dailyStopBlocked } = useDailyStopSync({
    enabled: open && !trackerLoading,
    riskPct,
    onRiskPctChange,
    dailyLossPct: trackerSnap?.dailyLossPct,
    stakePct,
    leverage: lev,
    onAccountStopClamped: setAccountStopSel,
  });

  const loadMarketPrice = useCallback(
    async (sym: string, opts?: { stake?: number; accountStop?: number }) => {
      const normalized = sym.trim().toUpperCase();
      if (!normalized) return;
      setPriceLoading(true);
      try {
        const { price } = await fetchMarketPrice(normalized);
        const stake =
          opts?.stake ??
          (trackerSnap != null
            ? defaultStakePct(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct)
            : parseRiskPercent(risk));
        const lev = parseLeverage(leverage);
        const accountStop =
          opts?.accountStop ?? accountStopPctFromTracker(trackerSnap?.dailyLossPct);
        if (accountStop != null) {
          setAccountStopSel(accountStop);
        }
        const priceRisk =
          accountStop != null
            ? parseRiskPctValue(formatPriceRiskFromAccountStop(accountStop, stake, lev))
            : parseRiskPctValue(riskPct);
        applyMarketPrice(price, directionRef.current, priceRisk);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить курс");
      } finally {
        setPriceLoading(false);
      }
    },
    [applyMarketPrice, trackerSnap, leverage, risk, riskPct],
  );

  useEffect(() => {
    if (!open) {
      priceInitKeyRef.current = null;
      setAccountStopSel(null);
      return;
    }
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
    if (!open || trackerLoading || trackerSnap == null) return;
    const key = `${symbol}|${trackerSnap.dailyLossPct}|${trackerSnap.maxStakePct}|${trackerSnap.stakePoolRemainingPct}`;
    if (priceInitKeyRef.current === key) return;
    priceInitKeyRef.current = key;

    const stakeDefault = defaultStakePct(
      trackerSnap.maxStakePct,
      trackerSnap.stakePoolRemainingPct,
    );
    setRisk(formatStakeForForm(trackerSnap.maxStakePct, trackerSnap.stakePoolRemainingPct));
    const t = window.setTimeout(() => {
      void loadMarketPrice(symbol, { stake: stakeDefault });
    }, 150);
    return () => clearTimeout(t);
  }, [symbol, open, trackerLoading, trackerSnap, loadMarketPrice]);

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
  const formBlocked = dailyLimit.blocked || stakePoolBlocked;
  const dailyTradesRemainingCount = dailyTradesRemaining(dailyTradesCount, dailyTradesLimit);

  const onStakeChange = (nextRisk: string) => {
    const prevStake = stakePct;
    const account =
      accountStopSel ??
      (entry && dailyRemaining != null
        ? Math.min(
            dailyRemaining,
            priceStopToAccountRiskPct(parseRiskPctValue(riskPct), prevStake, lev),
          )
        : null);
    setRisk(nextRisk);
    const newStake = parseRiskPercent(nextRisk);
    if (account != null && account >= ACCOUNT_STOP_MIN_STEP && newStake > 0) {
      onRiskPctChange(formatPriceRiskFromAccountStop(account, newStake, lev));
    }
  };

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
      <form className="modal signal-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head signal-form__head">
          <div>
            <h2>Новый сигнал</h2>
            <p>Публикация в ленту</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <SignalFormLimitsBar
          active={open}
          loading={trackerLoading}
          dailyRemaining={dailyRemaining}
          dailyTradesRemaining={dailyTradesRemainingCount}
          dailyTradesLimit={dailyTradesLimit}
          stakePoolRemainingPct={trackerSnap?.stakePoolRemainingPct}
          rankName={trackerSnap?.currentRankName}
          rankMaxStakePct={trackerSnap?.rankMaxStakePct}
          dailyBlocked={dailyLimit.blocked}
          dailyBlockReason={dailyLimit.reason}
          stakePoolBlocked={stakePoolBlocked}
          maxStakePct={maxStakePct}
        />

        <SignalFormSection title="Сделка">
          <div className="signal-form__deal">
            <label className="signal-form__deal-symbol">
              <span className="signal-form__deal-k">Тикер</span>
              <input
                className="signal-form__symbol-input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
                autoCapitalize="characters"
              />
            </label>
            <div className="dir-toggle dir-toggle--compact" role="group" aria-label="Направление">
              <button
                type="button"
                className={direction === "long" ? "active long" : ""}
                onClick={() => setDirection("long")}
              >
                Long
              </button>
              <button
                type="button"
                className={direction === "short" ? "active short" : ""}
                onClick={() => setDirection("short")}
              >
                Short
              </button>
            </div>
          </div>
        </SignalFormSection>

        <SignalFormSection
          title="Уровни"
          hint={priceLoading ? "Курс Bybit…" : "Perp USDT · цель 1:3 от стопа"}
        >
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
            accountStopPct={accountStopSel}
            onAccountStopChange={setAccountStopSel}
          />
        </SignalFormSection>

        <SignalFormSection title="Размер позиции">
          <SignalFormPositionCard
            leverage={leverage}
            onLeverageChange={(nextLev) => {
              const prevStake = parseRiskPercent(risk);
              const prevLev = parseLeverage(leverage);
              const nextLevNum = parseLeverage(nextLev);
              const nextStake = parseRiskPercent(risk);
              setLeverage(nextLev);
              const account =
                accountStopSel ??
                (dailyRemaining != null
                  ? Math.min(
                      dailyRemaining,
                      priceStopToAccountRiskPct(parseRiskPctValue(riskPct), prevStake, prevLev),
                    )
                  : null);
              if (account != null && account >= ACCOUNT_STOP_MIN_STEP && nextStake > 0) {
                setAccountStopSel(account);
                onRiskPctChange(formatPriceRiskFromAccountStop(account, nextStake, nextLevNum));
              } else {
                const nextPrice = preserveAccountStopOnLeverageChange({
                  riskPct,
                  prevStakePct: prevStake,
                  prevLeverage: prevLev,
                  nextStakePct: nextStake,
                  nextLeverage: nextLevNum,
                  dailyRemaining: dailyRemaining ?? 2,
                });
                if (nextPrice) onRiskPctChange(nextPrice);
              }
            }}
            risk={risk}
            onRiskChange={onStakeChange}
            maxStakePct={maxStakePct}
            disabled={stakePoolBlocked}
            balanceUsd={balanceForNominal}
            stakeUsd={stakeUsd}
            stakePct={stakePct}
            lev={lev}
          />
        </SignalFormSection>

        <SignalFormSection title="Медиа" hint="необязательно">
          <SignalMediaPicker
            screenshot={screenshot}
            video={video}
            shotPreview={shotPreview}
            onScreenshot={onScreenshot}
            onVideo={onVideo}
            label="Скрин или видео"
          />
        </SignalFormSection>

        <SignalFormSection title="Комментарий" hint="на русском">
          {isTelegramDesktop() ? (
            <div className="signal-form__paste-row">
              <PasteButton
                onPaste={(text) => setComment((prev) => appendPastedText(prev, text))}
                disabled={submitting}
              />
            </div>
          ) : null}
          <textarea
            {...ruTextFieldProps}
            className="signal-form__comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Краткий разбор сделки…"
          />
        </SignalFormSection>

        {error ? (
          <p className="signal-form__alert signal-form__alert--err" role="alert">
            {error}
          </p>
        ) : null}

        {submitting && uploadProgress ? (
          <UploadProgressBar
            progress={uploadProgress}
            label={uploadProgressLabel(!!video, uploadProgress.phase)}
          />
        ) : null}

        <button
          type="submit"
          className="submit-btn signal-form__submit"
          disabled={submitting || priceLoading || formBlocked}
        >
          {submitting && uploadProgress
            ? uploadProgress.phase === "processing"
              ? "Сохранение…"
              : `Загрузка… ${uploadProgress.percent}%`
            : submitting
              ? "Публикация…"
              : "Опубликовать"}
        </button>
      </form>
    </div>
  );
}
