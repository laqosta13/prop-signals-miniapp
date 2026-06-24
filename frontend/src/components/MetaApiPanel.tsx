import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import type { MetaApiStatus } from "../api";
import { deleteMetaApiSettings, fetchMetaApiStatus, saveMetaApiSettings } from "../api";
import { formatUsdCents } from "../utils";

const EMPTY: MetaApiStatus = {
  configured: false,
  enabled: false,
  account_id_hint: null,
  lot_size: 0.01,
  balance: null,
  currency: null,
  balance_error: null,
  connected_at: null,
};

export function MetaApiPanel() {
  const [status, setStatus] = useState<MetaApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [lotSize, setLotSize] = useState("0.01");
  const [enabled, setEnabled] = useState(true);

  const refresh = async () => {
    const s = await fetchMetaApiStatus();
    setStatus(s);
    if (s.configured) {
      setEnabled(s.enabled);
      setLotSize(String(s.lot_size));
    }
    return s;
  };

  useEffect(() => {
    void refresh()
      .catch(() => setStatus(EMPTY))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    const id = accountId.trim();
    if (!id && !status?.configured) {
      setErr("Введите MetaAPI Account ID");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = await saveMetaApiSettings({
        account_id: id || "keep", // "keep" = не менять account_id на сервере
        lot_size: Number(lotSize) || 0.01,
        enabled,
      });
      setStatus(s);
      setAccountId("");
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!confirm("Отключить MetaAPI и остановить копирование?")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteMetaApiSettings();
      setStatus(EMPTY);
      setAccountId("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
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
        <span className="cta-btn__label">
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>MT</span>
          <span>MetaAPI · Forex MT4/MT5</span>
        </span>
        <span className="volnovoi-copy__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="volnovoi-copy__panel">
          <p className="volnovoi-copy__desc">
            Копирование сигналов на твой MT4/MT5 аккаунт через MetaAPI.
          </p>

          <ul className="volnovoi-copy__hints">
            <li>
              Зарегистрируйся на <strong>metaapi.cloud</strong>, подключи MT аккаунт
            </li>
            <li>Скопируй Account ID из дашборда и вставь ниже</li>
            <li>Лот — размер сделки на твоём MT аккаунте (0.01 = микролот)</li>
          </ul>

          {loading ? (
            <p className="meta">Загрузка…</p>
          ) : (
            <>
              {status?.configured && (
                <div className="volnovoi-copy__stats">
                  {status.account_id_hint && <span>Account {status.account_id_hint}</span>}
                  {status.balance != null && (
                    <span>
                      Баланс {formatUsdCents(status.balance)} {status.currency ?? ""}
                    </span>
                  )}
                  {status.balance_error && (
                    <span className="signal-form__alert--err">{status.balance_error}</span>
                  )}
                  {status.connected_at && (
                    <span className="meta">
                      Подключён {new Date(status.connected_at).toLocaleDateString("ru")}
                    </span>
                  )}
                </div>
              )}

              <div className="volnovoi-copy__form">
                <label className="field-label">
                  MetaAPI Account ID
                  {status?.configured && (
                    <span className="meta"> (оставьте пустым чтобы не менять)</span>
                  )}
                </label>
                <input
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder={status?.configured ? status.account_id_hint ?? "Account ID" : "Вставьте Account ID"}
                  autoComplete="off"
                  spellCheck={false}
                />

                <label className="field-label">Размер лота</label>
                <input
                  type="number"
                  min="0.001"
                  max="100"
                  step="0.01"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                />

                {status?.configured && (
                  <label className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    Копирование включено
                  </label>
                )}

                {err && (
                  <p className="signal-form__alert signal-form__alert--err" role="alert">
                    {err}
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void onSave()}
                  >
                    {busy ? "…" : status?.configured ? "Сохранить" : "Подключить"}
                  </button>
                  {status?.configured && (
                    <button
                      type="button"
                      className="btn-ghost btn-ghost--danger"
                      disabled={busy}
                      onClick={() => void onDisconnect()}
                    >
                      Отключить
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
