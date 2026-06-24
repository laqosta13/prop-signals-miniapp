import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import type { CopyTradingStatus, TimeCapsuleDelay } from "../api";
import {
  deleteCopyTradingSettings,
  fetchCopyTradingStatus,
  topUpCopyDeposit,
  patchCopyTradingSettings,
  saveCopyTradingSettings,
  scheduleTimeCapsule,
  testCopyTradingConnection,
} from "../api";
import { copyToClipboard, formatUsdCents, selectFieldText } from "../utils";
import { PasteButton } from "./PasteButton";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { BybitLogo } from "./BrandLogos";
import { BybitApiGuide } from "./BybitApiGuide";
import { PartnerLinks } from "./PartnerLinks";
import { PaymentMemoRow } from "./PaymentMemoRow";
import { RiskPercentSlider } from "./RiskPercentSlider";

const EMPTY_STATUS: CopyTradingStatus = {
  configured: false,
  enabled: false,
  account_balance_usd: 10000,
  stake_percent: 100,
  usdt_ton_address: "",
  fee_percent: 20,
  min_topup_usd: 1,
  fee_deposit_usd: 0,
  accrued_fee_usd: 0,
  profit_usd: 0,
  unbilled_profit_usd: 0,
  copy_allowed: false,
  fee_exempt: false,
  payment_memo: "",
  copy_errors: [],
};

export function VolnovoiCopyPanel() {
  const copy = useThemedCopy();
  const [status, setStatus] = useState<CopyTradingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<string | null>(null);
  const [tx, setTx] = useState("");
  const [copied, setCopied] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [stakePercent, setStakePercent] = useState("100");

  const walletRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const s = await fetchCopyTradingStatus();
    setStatus(s);
    if (s.configured) {
      setEnabled(s.enabled);
      setStakePercent(String(s.stake_percent));
    }
    return s;
  };

  useEffect(() => {
    void refresh()
      .catch(() => setStatus(EMPTY_STATUS))
      .finally(() => setLoading(false));
  }, []);

  const stakePayload = {
    enabled,
    stake_percent: Number(stakePercent) || 100,
  };

  const onSave = async () => {
    const hasNewKeys = apiKey.trim() && apiSecret.trim();
    if (!hasNewKeys && !status?.configured) {
      setErr("Введите API Key и Secret");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = hasNewKeys
        ? await saveCopyTradingSettings({
            api_key: apiKey.trim(),
            api_secret: apiSecret.trim(),
            ...stakePayload,
          })
        : await patchCopyTradingSettings(stakePayload);
      setStatus(s);
      setApiKey("");
      setApiSecret("");
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    const hasKey = !!apiKey.trim();
    const hasSecret = !!apiSecret.trim();
    if (hasKey !== hasSecret) {
      setErr("Для смены ключей введите API Key и Secret вместе");
      return;
    }
    setBusy(true);
    setErr(null);
    setTestOk(null);
    try {
      if (hasKey && hasSecret) {
        await saveCopyTradingSettings({
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          ...stakePayload,
        });
        setApiKey("");
        setApiSecret("");
      } else if (status?.configured) {
        await patchCopyTradingSettings(stakePayload);
      }
      setStatus(await testCopyTradingConnection());
      setTestOk("Проверка пройдена");
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  };

  const onTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setStatus(await topUpCopyDeposit(tx.trim()));
      setTx("");
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка пополнения");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!confirm("Отключить API и остановить копирование?")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteCopyTradingSettings();
      setStatus(EMPTY_STATUS);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const copyWallet = async () => {
    const addr = status?.usdt_ton_address;
    if (!addr) return;
    const ok = await copyToClipboard(addr);
    WebApp.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (walletRef.current) {
      selectFieldText(walletRef.current);
      WebApp.showAlert("Адрес выделен — нажмите Ctrl+C (или ⌘+C).");
    }
  };

  const depositBlocked = status != null && !status.copy_allowed;
  const feeExempt = status?.fee_exempt === true;
  const minTopup = status?.min_topup_usd ?? 1;

  // Капсула времени
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [capsuleText, setCapsuleText] = useState("");
  const [capsuleDelay, setCapsuleDelay] = useState<TimeCapsuleDelay>("1m");
  const [capsuleBusy, setCapsuleBusy] = useState(false);
  const [capsuleOk, setCapsuleOk] = useState<string | null>(null);
  const [capsuleErr, setCapsuleErr] = useState<string | null>(null);

  const onSendCapsule = async () => {
    if (!capsuleText.trim()) return;
    setCapsuleBusy(true);
    setCapsuleErr(null);
    setCapsuleOk(null);
    try {
      const res = await scheduleTimeCapsule(capsuleText.trim(), capsuleDelay);
      const date = new Date(res.deliver_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
      setCapsuleOk(`Отправлено — получишь ${date}`);
      setCapsuleText("");
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setCapsuleErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCapsuleBusy(false);
    }
  };

  const DELAYS: { key: TimeCapsuleDelay; label: string }[] = [
    { key: "test", label: "Тест" },
    { key: "1w", label: "1 нед" },
    { key: "1m", label: "1 мес" },
    { key: "3m", label: "3 мес" },
  ];

  return (
    <div className="volnovoi-copy" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`volnovoi-copy__toggle${open ? " volnovoi-copy__toggle--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="cta-btn__label">
          <BybitLogo size={22} />
          <span>{copy.volnovoiCopyTitle}</span>
        </span>
        <span className="volnovoi-copy__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="volnovoi-copy__panel">
          <p className="volnovoi-copy__desc">{copy.volnovoiCopyDesc}</p>

          <ul className="volnovoi-copy__hints">
            {!feeExempt && (
              <li>
                Комиссия <strong>{status?.fee_percent ?? 20}%</strong> с прибыли копирования
              </li>
            )}
            {feeExempt && <li>Комиссия за копирование не взимается</li>}
            {!feeExempt && <li>{copy.volnovoiCopyHintBilling}</li>}
            <li>{copy.volnovoiCopyHintApi}</li>
          </ul>

          {loading ? (
            <p className="meta">Загрузка…</p>
          ) : (
            <>
              {!feeExempt && (
              <section className="volnovoi-copy__bill">
                <h4 className="volnovoi-copy__bill-title">Депозит комиссии</h4>
                <p className="volnovoi-copy__bill-row volnovoi-copy__bill-row--due">
                  <span>На депозите</span>
                  <strong>{formatUsdCents(status?.fee_deposit_usd ?? 0)}</strong>
                </p>
                {status && status.accrued_fee_usd > 0 && (
                  <p className="volnovoi-copy__bill-row">
                    <span>К списанию ({status.fee_percent}% прибыли)</span>
                    <strong>{formatUsdCents(status.accrued_fee_usd)}</strong>
                  </p>
                )}
                {depositBlocked && (
                  <p className="volnovoi-copy__bill-warn">
                    Депозит пуст — новые сделки не копируются. Пополните ниже.
                  </p>
                )}
                {status?.configured && status.copy_allowed && status.fee_deposit_usd > 0 && (
                  <p className="meta volnovoi-copy__bill-hint">
                    Комиссия списывается с депозита автоматически при росте прибыли.
                  </p>
                )}
                <p className="meta volnovoi-copy__bill-hint">
                  Мин. пополнение ${minTopup} · USDT(в сети TON) · TXID
                </p>
                <div className="pay-addr-row">
                  <input
                    ref={walletRef}
                    readOnly
                    className="pay-addr"
                    value={status?.usdt_ton_address ?? ""}
                    onFocus={(e) => selectFieldText(e.currentTarget)}
                    aria-label="Адрес USDT TON"
                  />
                  <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyWallet()}>
                    {copied ? "✓" : "Копировать"}
                  </button>
                </div>
                <PaymentMemoRow memo={status?.payment_memo ?? ""} />
                <form className="volnovoi-copy__pay-form" onSubmit={(e) => void onTopUp(e)}>
                  <div className="field-row">
                    <label className="field-label">TXID пополнения</label>
                    <PasteButton onPaste={setTx} disabled={busy} />
                  </div>
                  <input
                    value={tx}
                    onChange={(e) => setTx(e.target.value)}
                    placeholder="Hash транзакции TON"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="submit" className="btn-primary" disabled={busy || !tx.trim()}>
                    Пополнить депозит
                  </button>
                </form>
              </section>
              )}

              {status?.configured && (
                <div className="volnovoi-copy__stats">
                  {status.api_key_hint && <span>Ключ {status.api_key_hint}</span>}
                  {status.current_equity_usd != null && (
                    <span>Баланс Bybit {formatUsdCents(status.current_equity_usd)}</span>
                  )}
                  <span>Прибыль копирования {formatUsdCents(status.profit_usd)}</span>
                </div>
              )}

              <div className="volnovoi-copy__form">
                {!status?.configured && (
                  <>
                    <label className="volnovoi-copy__field">
                      <span className="field-label">API Key</span>
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder="Bybit API Key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </label>
                    <label className="volnovoi-copy__field">
                      <span className="field-label">API Secret</span>
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder="Bybit API Secret"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                      />
                    </label>
                    <BybitApiGuide />
                  </>
                )}

                <div className="volnovoi-copy__deposit">
                  <RiskPercentSlider
                    value={stakePercent}
                    onChange={setStakePercent}
                    label="Сумма входа для расчёта, %"
                  />
                  <p className="meta volnovoi-copy__deposit-hint">
                    {status?.current_equity_usd != null ? (
                      <>
                        Баланс Bybit: <strong>{formatUsdCents(status.current_equity_usd)}</strong>
                      </>
                    ) : status?.configured ? (
                      "Нажмите «Проверить» — баланс подтянется с Bybit"
                    ) : (
                      "После подключения API баланс подтянется автоматически"
                    )}
                  </p>
                </div>

                <label className="volnovoi-copy__check">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                  <span className="volnovoi-copy__check-text">Копирование включено</span>
                </label>
              </div>

              {testOk && <p className="volnovoi-copy__ok">{testOk}</p>}
              {err && <p className="err volnovoi-copy__err">{err}</p>}
              {status?.balance_error && <p className="meta volnovoi-copy__err">{status.balance_error}</p>}
              {status?.copy_errors && status.copy_errors.length > 0 && (
                <div className="volnovoi-copy__err">
                  <p className="meta">Последние ошибки копирования:</p>
                  <ul className="volnovoi-copy__hints">
                    {status.copy_errors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="volnovoi-copy__actions">
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void onSave()}>
                  Сохранить
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void onTest()}>
                  Проверить
                </button>
                {status?.configured && (
                  <button
                    type="button"
                    className="btn-ghost volnovoi-copy__disconnect"
                    disabled={busy}
                    onClick={() => void onDisconnect()}
                  >
                    Отключить
                  </button>
                )}
              </div>

              <div className="capsule-section">
                <button
                  type="button"
                  className={`capsule-section__toggle${capsuleOpen ? " capsule-section__toggle--open" : ""}`}
                  onClick={() => { setCapsuleOpen((v) => !v); setCapsuleOk(null); setCapsuleErr(null); }}
                >
                  <span>🔒 Отправить пароль в будущее</span>
                  <span className="capsule-section__chevron">{capsuleOpen ? "▾" : "▸"}</span>
                </button>

                {capsuleOpen && (
                  <div className="capsule-section__body">
                    <p className="meta capsule-section__hint">
                      Создай новый пароль Bybit, вставь его сюда — бот пришлёт его тебе через выбранный срок.
                      Без доступа к бирже соблазна меньше, торговля идёт только через риск-менеджмент.
                    </p>
                    <textarea
                      className="capsule-section__input"
                      placeholder="Новый пароль Bybit…"
                      rows={3}
                      maxLength={1000}
                      value={capsuleText}
                      onChange={(e) => setCapsuleText(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className="capsule-section__delays">
                      {DELAYS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          className={`capsule-delay-btn${capsuleDelay === key ? " capsule-delay-btn--active" : ""}`}
                          onClick={() => setCapsuleDelay(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {capsuleOk && <p className="capsule-section__ok">{capsuleOk}</p>}
                    {capsuleErr && <p className="err">{capsuleErr}</p>}
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={capsuleBusy || !capsuleText.trim()}
                      onClick={() => void onSendCapsule()}
                    >
                      {capsuleBusy ? "Отправка…" : "Запечатать и отправить"}
                    </button>
                  </div>
                )}
              </div>

              <PartnerLinks title="Нет аккаунта?" ids={["bybit"]} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
