import { useCallback, useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { fetchSubscriptionInfo, submitPayment, type SubscriptionInfo } from "../api";
import { copyToClipboard } from "../utils";

export function SubscriptionTab({ onPaid, refreshKey = 0 }: { onPaid: () => void; refreshKey?: number }) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [tx, setTx] = useState("");
  const [plan, setPlan] = useState<"week" | "month">("week");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await fetchSubscriptionInfo());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await submitPayment(plan, tx.trim());
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

  const copyWallet = async () => {
    if (!info?.usdt_ton_address) return;
    const ok = await copyToClipboard(info.usdt_ton_address);
    WebApp.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      WebApp.showAlert("Не удалось скопировать. Выделите адрес вручную.");
    }
  };

  if (!info) return <p className="meta">{err || "Загрузка…"}</p>;

  return (
    <div className="sub-pay">
      <p className={`sub-pay__status ${info.subscription_active ? "on" : "off"}`}>
        {info.subscription_active ? (
          <>Подписка активна до {info.subscription_until ? new Date(info.subscription_until).toLocaleString() : "—"}</>
        ) : (
          <>Подписка не активна. Новым пользователям — {info.trial_days} дня бесплатно.</>
        )}
      </p>

      <section className="sub-card sub-card--pay">
        <h3>Оплата USDT в сети TON</h3>
        <p className="meta">TXID проверяется on-chain и засчитывается только после подтверждений сети.</p>
        <div className="pay-addr-row">
          <code className="pay-addr" title={info.usdt_ton_address}>
            {info.usdt_ton_address}
          </code>
          <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyWallet()}>
            {copied ? "Скопировано ✓" : "Копировать адрес"}
          </button>
        </div>

        <div className="sub-price-grid">
          <button type="button" className={`sub-plan${plan === "week" ? " on" : ""}`} onClick={() => setPlan("week")}>
            <span>Неделя</span>
            <strong>${info.week_usd}</strong>
          </button>
          <button type="button" className={`sub-plan${plan === "month" ? " on" : ""}`} onClick={() => setPlan("month")}>
            <span>30 дней</span>
            <strong>${info.month_usd}</strong>
          </button>
        </div>

        <form onSubmit={pay} className="pay-form">
          <label className="field-label">TXID транзакции</label>
          <input
            value={tx}
            onChange={(e) => setTx(e.target.value)}
            placeholder="Вставьте hash транзакции TON"
            required
          />
          <p className="meta small">Убедитесь, что оплата отправлена именно в USDT (TON) на адрес выше.</p>
          {err && <p className="err">{err}</p>}
          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? "Проверяем в сети…" : "Проверить TXID и активировать"}
          </button>
        </form>
      </section>

      <section className="sub-card">
        <h3>Реферальная программа</h3>
        <p className="meta">За каждого приведённого пользователя — +{info.referral_bonus_days} дня подписки.</p>
        <p className="ref-code">Ваш код: <strong>{info.referral_code || "—"}</strong></p>
        <p className="meta small">{info.referral_link_hint}</p>
      </section>
    </div>
  );
}
