import { useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  fetchCultSubscriptionInfo,
  payCultSubscription,
  type CultCandidateSubscriptionInfo,
} from "../api";
import { copyToClipboard, formatDateTimeMsk, selectFieldText } from "../utils";
import { PaymentMemoRow } from "./PaymentMemoRow";
import { PasteButton } from "./PasteButton";

type Props = {
  onPaid: () => void;
};

export function CultCandidatePaySection({ onPaid }: Props) {
  const [info, setInfo] = useState<CultCandidateSubscriptionInfo | null>(null);
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const walletRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setInfo(await fetchCultSubscriptionInfo());
  }, []);

  useEffect(() => {
    void load().catch(() => setInfo(null));
  }, [load]);

  const copyWallet = async () => {
    const addr = info?.usdt_ton_address;
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

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await payCultSubscription(tx.trim());
      setInfo(r);
      setTx("");
      WebApp.HapticFeedback.notificationOccurred("success");
      onPaid();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!info) return <p className="meta">Загрузка оплаты…</p>;

  if (info.cult_subscription_active) {
    return (
      <p className="meta cult-candidate-pay__active">
        Подписка кандидата активна
        {info.cult_subscription_until ? ` до ${formatDateTimeMsk(info.cult_subscription_until)} МСК` : ""}.
      </p>
    );
  }

  return (
    <section className="cult-candidate-pay">
      <h3 className="cult-candidate-pay__title">1. Подписка кандидата</h3>
      <p className="meta cult-candidate-pay__hint">$20 · 30 дней · USDT(в сети TON) · проверка TXID</p>
      <div className="sub-price-single cult-candidate-pay__price">
        <p className="sub-price-single__label">30 дней</p>
        <p className="sub-price-single__value">
          <strong>${info.subscription_usd}</strong>
          <span className="sub-price-single__days">USDT(в сети TON)</span>
        </p>
      </div>
      <div className="pay-addr-row">
        <input
          ref={walletRef}
          readOnly
          className="pay-addr"
          value={info.usdt_ton_address}
          onFocus={(e) => selectFieldText(e.currentTarget)}
          aria-label="Адрес USDT(в сети TON)"
        />
        <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyWallet()}>
          {copied ? "✓" : "Копировать"}
        </button>
      </div>
      <PaymentMemoRow memo={info.payment_memo} />
      <form onSubmit={(e) => void pay(e)} className="pay-form">
        <div className="field-row">
          <label className="field-label">TXID транзакции</label>
          <PasteButton onPaste={setTx} disabled={busy} />
        </div>
        <input
          value={tx}
          onChange={(e) => setTx(e.target.value)}
          placeholder="Hash транзакции TON"
          autoComplete="off"
          spellCheck={false}
          required
        />
        {err && <p className="err">{err}</p>}
        <button type="submit" className="btn-primary" disabled={busy || !tx.trim()}>
          {busy ? "Проверяем…" : "Проверить TXID и активировать"}
        </button>
      </form>
    </section>
  );
}
