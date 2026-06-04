import { useCallback, useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { fetchSubscriptionInfo, submitPayment, type SubscriptionInfo } from "../api";
import { PasteButton } from "./PasteButton";
import { copyToClipboard, formatDateTimeMsk, selectFieldText } from "../utils";
import { copyReferralLink, openReferralShare } from "../utils/referralShare";
import { SUPPORT_WRITE_LABEL } from "../data/support";
import { PartnerLinks } from "./PartnerLinks";

type Props = {
  onPaid: () => void;
  refreshKey?: number;
  onOpenSupport?: () => void;
};

export function SubscriptionTab({ onPaid, refreshKey = 0, onOpenSupport }: Props) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [tx, setTx] = useState("");
  const [plan, setPlan] = useState<"week" | "month">("month");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const walletRef = useRef<HTMLInputElement>(null);
  const referralRef = useRef<HTMLInputElement>(null);

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
      return;
    }
    if (walletRef.current) {
      selectFieldText(walletRef.current);
      WebApp.showAlert("Адрес выделен — нажмите Ctrl+C (или ⌘+C).");
      return;
    }
    WebApp.showAlert("Не удалось скопировать. Выделите адрес вручную.");
  };

  const shareReferral = () => {
    if (!info?.referral_link) return;
    openReferralShare(info.referral_link, info.referral_share_text || "PROP-DESK");
    WebApp.HapticFeedback.impactOccurred("medium");
  };

  const copyReferral = async () => {
    if (!info?.referral_link) return;
    const ok = await copyReferralLink(
      info.referral_link,
      info.referral_share_text || "PROP-DESK — торговые сигналы",
    );
    WebApp.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    if (ok) {
      setRefCopied(true);
      window.setTimeout(() => setRefCopied(false), 2000);
      return;
    }
    if (referralRef.current) {
      selectFieldText(referralRef.current);
      WebApp.showAlert("Ссылка выделена — нажмите Ctrl+C (или ⌘+C).");
      return;
    }
    WebApp.showAlert("Не удалось скопировать ссылку.");
  };

  if (!info) return <p className="meta">{err || "Загрузка…"}</p>;

  const hasReferralLink = Boolean(info.referral_link);

  return (
    <div className="sub-pay">
      <p className={`sub-pay__status ${info.subscription_active ? "on" : "off"}`}>
        {info.subscription_active ? (
          <>Подписка активна до {formatDateTimeMsk(info.subscription_until)} МСК</>
        ) : (
          <>Подписка не активна. Новым пользователям — {info.trial_days} дня бесплатно.</>
        )}
      </p>
      {info.subscription_pause_hint && (
        <p className="meta sub-pay__pause-hint">{info.subscription_pause_hint}</p>
      )}

      <section className="sub-card sub-card--pay">
        <h3>Оплата USDT в сети TON</h3>
        <p className="meta">TXID проверяется on-chain и засчитывается только после подтверждений сети.</p>
        <div className="pay-addr-row">
          <input
            ref={walletRef}
            readOnly
            className="pay-addr"
            value={info.usdt_ton_address}
            onFocus={(e) => selectFieldText(e.currentTarget)}
            onClick={(e) => selectFieldText(e.currentTarget)}
            aria-label="Адрес USDT TON"
          />
          <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copyWallet()}>
            {copied ? "Скопировано ✓" : "Копировать адрес"}
          </button>
        </div>

        <div className="sub-price-grid">
          <button type="button" className={`sub-plan${plan === "week" ? " on" : ""}`} onClick={() => setPlan("week")}>
            <span>7 дней</span>
            <strong>${info.week_usd}</strong>
          </button>
          <button type="button" className={`sub-plan${plan === "month" ? " on" : ""}`} onClick={() => setPlan("month")}>
            <span>30 дней</span>
            <strong>${info.month_usd}</strong>
          </button>
        </div>
        <p className="meta small">Лента активных сигналов · USDT TON · TXID</p>

        <form onSubmit={pay} className="pay-form">
          <div className="field-row">
            <label className="field-label">TXID транзакции</label>
            <PasteButton onPaste={setTx} disabled={busy} />
          </div>
          <input
            value={tx}
            onChange={(e) => setTx(e.target.value)}
            placeholder="Вставьте hash транзакции TON"
            lang="en"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="meta small">Убедитесь, что оплата отправлена именно в USDT (TON) на адрес выше.</p>
          {err && <p className="err">{err}</p>}
          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? "Проверяем в сети…" : "Проверить TXID и активировать"}
          </button>
        </form>
      </section>

      <section className="sub-card sub-card--referral">
        <div className="referral-head">
          <h3>Реферальная программа</h3>
          <span className="referral-bonus-pill">+{info.referral_bonus_days} дня за друга</span>
        </div>
        <p className="meta">Пригласите друга — +{info.referral_bonus_days} дня вам, когда он оплатит подписку.</p>

        <div className="referral-code-box">
          <span className="referral-code-box__label">Ваш код</span>
          <strong className="referral-code-box__code">{info.referral_code || "—"}</strong>
        </div>

        {hasReferralLink ? (
          <>
            <input
              ref={referralRef}
              readOnly
              className="referral-link"
              value={info.referral_link}
              onFocus={(e) => selectFieldText(e.currentTarget)}
              onClick={(e) => selectFieldText(e.currentTarget)}
              aria-label="Реферальная ссылка"
            />
            <div className="referral-actions">
              <button type="button" className="referral-btn referral-btn--primary" onClick={shareReferral}>
                Пригласить друга
              </button>
              <button
                type="button"
                className={`referral-btn referral-btn--ghost${refCopied ? " copied" : ""}`}
                onClick={() => void copyReferral()}
              >
                {refCopied ? "Скопировано ✓" : "Копировать ссылку"}
              </button>
            </div>
          </>
        ) : (
          <p className="meta referral-warn">{info.referral_link_hint}</p>
        )}
      </section>

      <section className="sub-card sub-card--support">
        <h3>Поддержка</h3>
        <p className="meta">
          Вопросы по оплате, подписке, сигналам и работе приложения — напишите нам в Telegram.
        </p>
        {onOpenSupport && (
          <button type="button" className="submit-btn submit-btn--outline" onClick={onOpenSupport}>
            {SUPPORT_WRITE_LABEL}
          </button>
        )}
      </section>

      <PartnerLinks title="Биржи и вывод" />
    </div>
  );
}
