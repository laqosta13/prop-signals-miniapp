import { useEffect, useState } from "react";
import type { CopyTradingStatus } from "../api";
import {
  deleteCopyTradingSettings,
  fetchCopyTradingStatus,
  saveCopyTradingSettings,
  testCopyTradingConnection,
} from "../api";

type Props = {
  subscriptionActive: boolean;
};

export function VolnovoiCopyPanel({ subscriptionActive }: Props) {
  const [status, setStatus] = useState<CopyTradingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [accountBalance, setAccountBalance] = useState("10000");
  const [stakePercent, setStakePercent] = useState("10");

  useEffect(() => {
    void fetchCopyTradingStatus()
      .then((s) => {
        setStatus(s);
        if (s.configured) {
          setTestnet(s.testnet);
          setEnabled(s.enabled);
          setAccountBalance(String(s.account_balance_usd));
          setStakePercent(String(s.stake_percent));
        }
      })
      .catch(() => setStatus({ configured: false, enabled: false, testnet: true, account_balance_usd: 10000, stake_percent: 10 }))
      .finally(() => setLoading(false));
  }, []);

    if (!subscriptionActive) {
      alert("Копирование доступно с активной подпиской");
      return;
    }
    if (!apiKey.trim() || !apiSecret.trim()) {
      alert("Введите API Key и Secret");
      return;
    }
    setBusy(true);
    try {
      const s = await saveCopyTradingSettings({
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
        testnet,
        enabled,
        account_balance_usd: Number(accountBalance) || 10000,
        stake_percent: Number(stakePercent) || 10,
      });
      setStatus(s);
      setApiKey("");
      setApiSecret("");
      alert("API сохранён. Сделки volnovoi будут копироваться автоматически.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      if (apiKey.trim() && apiSecret.trim()) {
        await saveCopyTradingSettings({
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          testnet,
          enabled,
          account_balance_usd: Number(accountBalance) || 10000,
          stake_percent: Number(stakePercent) || 10,
        });
        setApiKey("");
        setApiSecret("");
      }
      const s = await testCopyTradingConnection();
      setStatus(s);
      alert(s.usdt_balance != null ? `Подключено. Баланс USDT: ${s.usdt_balance.toFixed(2)}` : "Подключено");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!confirm("Отключить API и остановить копирование?")) return;
    setBusy(true);
    try {
      await deleteCopyTradingSettings();
      setStatus({ configured: false, enabled: false, testnet: true, account_balance_usd: 10000, stake_percent: 10 });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="volnovoi-copy" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`volnovoi-copy__toggle${open ? " volnovoi-copy__toggle--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Копирование на Bybit</span>
        <span className="volnovoi-copy__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="volnovoi-copy__panel">
          <p className="volnovoi-copy__desc">
            Подключите API Bybit — сделки аккаунта <strong>volnovoi</strong> (все сигналы трейдеров) будут
            автоматически открываться на вашем счёте USDT perpetual с теми же стопом и целью.
          </p>
          <ul className="volnovoi-copy__hints">
            <li>Ключи хранятся на сервере в зашифрованном виде</li>
            <li>Нужны права <strong>Trade</strong>, без вывода средств</li>
            <li>Размер позиции = ваш депозит × сумма входа % × плечо сигнала</li>
            <li>Сначала протестируйте на testnet</li>
          </ul>

          {!subscriptionActive && (
            <p className="volnovoi-copy__warn">Нужна активная подписка для сохранения API и копирования.</p>
          )}

          {loading ? (
            <p className="meta">Загрузка…</p>
          ) : (
            <>
              {status?.configured && status.api_key_hint && (
                <p className="volnovoi-copy__status">
                  Ключ: {status.api_key_hint}
                  {status.usdt_balance != null && (
                    <>
                      {" "}
                      · USDT <strong>{status.usdt_balance.toFixed(2)}</strong>
                    </>
                  )}
                  {status.balance_error && <span className="volnovoi-copy__err"> · {status.balance_error}</span>}
                </p>
              )}

              <label className="field">
                <span>API Key</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={status?.configured ? "Новый ключ (оставьте пустым)" : "Bybit API Key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </label>
              <label className="field">
                <span>API Secret</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={status?.configured ? "Новый secret" : "Bybit API Secret"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
              </label>

              <div className="volnovoi-copy__row">
                <label className="field">
                  <span>Депозит для расчёта, $</span>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Сумма входа, %</span>
                  <input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.5}
                    value={stakePercent}
                    onChange={(e) => setStakePercent(e.target.value)}
                  />
                </label>
              </div>

              <label className="volnovoi-copy__check">
                <input type="checkbox" checked={testnet} onChange={(e) => setTestnet(e.target.checked)} />
                Testnet (демо-счёт)
              </label>
              <label className="volnovoi-copy__check">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Копирование включено
              </label>

              <div className="volnovoi-copy__actions">
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void onSave()}>
                  Сохранить
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void onTest()}>
                  Проверить
                </button>
                {status?.configured && (
                  <button type="button" className="btn-ghost volnovoi-copy__disconnect" disabled={busy} onClick={() => void onDisconnect()}>
                    Отключить
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
