import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import type { CopyTradingStatus } from "../api";
import {
  deleteCopyTradingSettings,
  fetchCopyTradingStatus,
  payCopyTradingFee,
  patchCopyTradingSettings,
  saveCopyTradingSettings,
  testCopyTradingConnection,
} from "../api";
import { copyToClipboard, formatUsd, selectFieldText } from "../utils";
import { PaymentMemoRow } from "./PaymentMemoRow";
import { PasteButton } from "./PasteButton";
import {
  VOLNOVOI_COPY_DESC,
  VOLNOVOI_COPY_HINT_API,
  VOLNOVOI_COPY_HINT_BILLING,
  VOLNOVOI_COPY_TITLE,
} from "../data/appCopy";
import { BybitLogo } from "./BrandLogos";
import { PartnerLinks } from "./PartnerLinks";
import { RiskPercentSlider } from "./RiskPercentSlider";

const EMPTY_STATUS: CopyTradingStatus = {
  configured: false,
  enabled: false,
  account_balance_usd: 10000,
  stake_percent: 10,
  usdt_ton_address: "",
  payment_memo: "",
  fee_percent: 20,
  profit_usd: 0,
  unbilled_profit_usd: 0,
  copy_allowed: true,
};

export function VolnovoiCopyPanel() {
  const [status, setStatus] = useState<CopyTradingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState("");
  const [copied, setCopied] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [stakePercent, setStakePercent] = useState("10");

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
    stake_percent: Number(stakePercent) || 10,
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
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  };

  const onPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const inv = status?.pending_invoice;
    if (!inv) return;
    setBusy(true);
    setErr(null);
    try {
      setStatus(await payCopyTradingFee(inv.id, tx.trim()));
      setTx("");
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка оплаты");
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

  const pending = status?.pending_invoice;
  const blocked = status?.configured && !status.copy_allowed && pending;

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
          <span>{VOLNOVOI_COPY_TITLE}</span>
        </span>
        <span className="volnovoi-copy__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="volnovoi-copy__panel">
          <p className="volnovoi-copy__desc">{VOLNOVOI_COPY_DESC}</p>

          <ul className="volnovoi-copy__hints">
            <li>
              Комиссия <strong>{status?.fee_percent ?? 20}%</strong> с прибыли копирования
            </li>
            <li>{VOLNOVOI_COPY_HINT_BILLING}</li>
            <li>{VOLNOVOI_COPY_HINT_API}</li>
          </ul>

          {loading ? (
            <p className="meta">Загрузка…</p>
          ) : (
            <>
              {status?.configured && (
                <div className="volnovoi-copy__stats">
                  {status.api_key_hint && <span>Ключ {status.api_key_hint}</span>}
                  {status.current_equity_usd != null && (
                    <span>Баланс {formatUsd(status.current_equity_usd)}</span>
                  )}
                  <span>Прибыль {formatUsd(status.profit_usd)}</span>
                  <span>К оплате {formatUsd(status.unbilled_profit_usd)} × {status.fee_percent}%</span>
                </div>
              )}

              {blocked && pending && (
                <section className="volnovoi-copy__bill">
                  <h4 className="volnovoi-copy__bill-title">Счёт за копирование</h4>
                  <p className="volnovoi-copy__bill-row">
                    <span>Прибыль с подключения</span>
                    <strong>{formatUsd(pending.profit_usd)}</strong>
                  </p>
                  <p className="volnovoi-copy__bill-row volnovoi-copy__bill-row--due">
                    <span>К оплате ({status?.fee_percent}%)</span>
                    <strong>{formatUsd(pending.fee_usd)}</strong>
                  </p>
                  <p className="meta volnovoi-copy__bill-hint">После TXID копирование включится снова.</p>
                  <div className="pay-addr-row">
                    <input
                      ref={walletRef}
                      readOnly
                      className="pay-addr"
                      value={status?.usdt_ton_address ?? ""}
                      onFocus={(e) => selectFieldText(e.currentTarget)}
                      aria-label="Адрес USDT(в сети TON)"
                    />
                    <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyWallet()}>
                      {copied ? "✓" : "Копировать"}
                    </button>
                  </div>
                  <PaymentMemoRow memo={status?.payment_memo ?? ""} />
                  <form className="volnovoi-copy__pay-form" onSubmit={(e) => void onPay(e)}>
                    <div className="field-row">
                      <label className="field-label">TXID перевода</label>
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
                      Оплатить счёт
                    </button>
                  </form>
                </section>
              )}

              {status?.configured && status.copy_allowed && !pending && status.unbilled_profit_usd > 0 && (
                <p className="volnovoi-copy__ok meta">
                  Копирование активно. Следующий счёт — при росте прибыли (раз в сутки).
                </p>
              )}

              <div className="volnovoi-copy__form">
                <label className="volnovoi-copy__field">
                  <span className="field-label">API Key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={status?.configured ? "Новый ключ" : "Bybit API Key"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </label>
                <label className="volnovoi-copy__field">
                  <span className="field-label">API Secret</span>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={status?.configured ? "Новый secret" : "Bybit API Secret"}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                  />
                </label>

                <div className="volnovoi-copy__deposit">
                  <RiskPercentSlider
                    value={stakePercent}
                    onChange={setStakePercent}
                    label="Депозит для расчёта, %"
                  />
                  <p className="meta volnovoi-copy__deposit-hint">
                    {status?.current_equity_usd != null ? (
                      <>
                        Баланс Bybit для расчёта:{" "}
                        <strong>{formatUsd(status.current_equity_usd)}</strong>
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

              {err && <p className="err volnovoi-copy__err">{err}</p>}
              {status?.balance_error && <p className="meta volnovoi-copy__err">{status.balance_error}</p>}

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

              <PartnerLinks title="Нет аккаунта?" ids={["bybit"]} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
