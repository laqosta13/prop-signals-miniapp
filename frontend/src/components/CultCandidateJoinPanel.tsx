import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { fetchCultCandidateMe, joinCultCandidate, type CultCandidateMe } from "../api";
import { CultCandidateBybitPanel } from "./CultCandidateBybitPanel";
import { CultCandidatePaySection } from "./CultCandidatePaySection";

type Props = {
  onJoined: () => void;
};

export function CultCandidateJoinPanel({ onJoined }: Props) {
  const [me, setMe] = useState<CultCandidateMe | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    void fetchCultCandidateMe()
      .then(setMe)
      .catch(() => setMe(null));
  };

  useEffect(() => {
    reload();
  }, []);

  if (!me || me.is_candidate) return null;

  const onJoin = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setErr("Укажите имя для карточки (от 2 символов)");
      return;
    }
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        await joinCultCandidate(trimmed);
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
      <button type="button" className="cult-candidate-join__cta" onClick={() => setOpen(true)}>
        <span className="cult-candidate-join__plus" aria-hidden>
          +
        </span>
        Стать кандидатом
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div className="modal cult-candidate-join__modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>Кандидат в CULT</h2>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <p className="meta cult-candidate-join__intro">
              Ваши сделки попадают в рейтинг «Кондидаты в CULT». Подписка кандидата ($20 / 30 дней) — отдельно от
              подписки на ленту во вкладке «Подписка».
            </p>
            <ol className="cult-candidate-join__steps">
              <li className={me.cult_subscription_active ? "ok" : "pending"}>
                Оплатить подписку кандидата {me.cult_subscription_active ? "✓" : ""}
              </li>
              <li className={me.bybit_configured ? "ok" : "pending"}>
                Подключить API Bybit {me.bybit_configured ? "✓" : ""}
              </li>
              <li>Указать имя в карточке и нажать «Вступить»</li>
            </ol>
            <CultCandidatePaySection onPaid={reload} />
            <CultCandidateBybitPanel onConfigured={reload} />
            <label className="cult-candidate-join__label">
              3. Имя в карточке
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как вас показывать в ТОП"
                maxLength={64}
                disabled={busy}
              />
            </label>
            {me.blockers.length > 0 && !me.can_join && (
              <p className="meta cult-candidate-join__blockers">{me.blockers.join(" · ")}</p>
            )}
            {err && <p className="err">{err}</p>}
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !me.can_join || name.trim().length < 2}
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
