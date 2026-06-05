import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { fetchCultCandidateMe, joinCultCandidate, type CultCandidateMe } from "../api";
import { CULT_JOIN_INTRO, CULT_JOIN_TITLE } from "../data/appCopy";
import { CultCandidateBybitPanel } from "./CultCandidateBybitPanel";
import { CultCandidatePaySection } from "./CultCandidatePaySection";
import { telegramCardDisplayName } from "../utils/telegramProfile";

type Props = {
  onJoined: () => void;
};

export function CultCandidateJoinPanel({ onJoined }: Props) {
  const [me, setMe] = useState<CultCandidateMe | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tgName = telegramCardDisplayName();

  const reload = () => {
    void fetchCultCandidateMe()
      .then(setMe)
      .catch(() => setMe(null));
  };

  useEffect(() => {
    reload();
  }, []);

  if (!me || me.is_candidate || me.main_feed_publisher) return null;

  const openModal = () => {
    reload();
    setErr(null);
    setOpen(true);
  };

  const onJoin = () => {
    if (!me.can_join) {
      setErr(me.blockers[0] ?? "Сначала выполните шаги выше");
      WebApp.HapticFeedback.notificationOccurred("error");
      return;
    }
    if (tgName.length < 2) {
      setErr("В профиле Telegram нужны имя или username (от 2 символов)");
      WebApp.HapticFeedback.notificationOccurred("error");
      return;
    }
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        await joinCultCandidate();
        WebApp.HapticFeedback.notificationOccurred("success");
        setOpen(false);
        onJoined();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="cult-candidate-join">
      <button type="button" className="cult-candidate-join__cta" onClick={openModal}>
        <span className="cult-candidate-join__plus" aria-hidden>
          +
        </span>
        Стать кандидатом
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div className="modal cult-candidate-join__modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{CULT_JOIN_TITLE}</h2>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <p className="meta cult-candidate-join__intro">{CULT_JOIN_INTRO}</p>
            <ol className="cult-candidate-join__steps">
              <li className={me.cult_subscription_active ? "ok" : "pending"}>
                Оплатить подписку кандидата {me.cult_subscription_active ? "✓" : ""}
              </li>
              <li className={me.bybit_configured ? "ok" : "pending"}>
                Подключить API Bybit {me.bybit_configured ? "✓" : ""}
              </li>
              <li>Нажать «Вступить»</li>
            </ol>
            <CultCandidatePaySection onPaid={reload} />
            <CultCandidateBybitPanel onConfigured={reload} />
            <p className="cult-candidate-join__tg-name meta">
              {tgName.length >= 2 ? (
                <>
                  Имя в карточке: <strong>{tgName}</strong> (из Telegram)
                </>
              ) : (
                <>Добавьте имя или @username в профиле Telegram</>
              )}
            </p>
            {!me.can_join && me.blockers.length > 0 && (
              <p className="cult-candidate-join__blockers" role="status">
                {me.blockers.join(" · ")}
              </p>
            )}
            {err && <p className="err">{err}</p>}
            <button
              type="button"
              className={`btn-primary${me.can_join && tgName.length >= 2 ? "" : " btn-primary--muted"}`}
              disabled={busy}
              onClick={onJoin}
            >
              Вступить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
