import { useCallback, useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { fetchSubscriptionInfo, submitPayment, type SubscriptionInfo } from "../api";

export function SubscriptionTab({ onPaid }: { onPaid: () => void }) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [tx, setTx] = useState("");
  const [plan, setPlan] = useState<"week" | "month">("week");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  }, [load]);

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

  const copy = (t: string) => {
    void navigator.clipboard.writeText(t);
    WebApp.HapticFeedback.impactOccurred("light");
  };

  if (!info) return <p className="meta">{err || "Загрузка…"}</p>;

  return (
    <div className="sub-pay">
      <p className="sub-pay__status">
        {info.subscription_active ? (
          <>Подписка активна до {info.subscription_until ? new Date(info.subscription_until).toLocaleString() : "—"}</>
        ) : (
          <>Подписка не активна. Новым пользователям — {info.trial_days} дня бесплатно.</>
        )}
      </p>

      <section className="sub-card">
        <h3>Оплата USDT (TON)</h3>
        <p className="meta">Неделя — ${info.week_usd}, 30 дней — ${info.month_usd}</p>
        <div className="pay-addr-row">
          <code className="pay-addr">{info.usdt_ton_address}</code>
          <button type="button" className="ghost-btn" onClick={() => copy(info.usdt_ton_address)}>
            Копировать
          </button>
        </div>
        <form onSubmit={pay} className="pay-form">
          <label className="field-label">Тариф</label>
          <div className="dir-toggle">
            <button type="button" className={plan === "week" ? "active long" : ""} onClick={() => setPlan("week")}>
              Неделя ${info.week_usd}
            </button>
            <button type="button" className={plan === "month" ? "active short" : ""} onClick={() => setPlan("month")}>
              30 дней ${info.month_usd}
            </button>
          </div>
          <label className="field-label">TXID транзакции</label>
          <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Вставьте хеш / TXID" required />
          {err && <p className="err">{err}</p>}
          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? "Отправка…" : "Подтвердить оплату"}
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
