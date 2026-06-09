import { useState } from "react";
import { resetTraderRoster, setTraderRoster } from "../api";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { confirmAction } from "../utils/confirmAction";

export type TraderRosterPlacement = "top" | "candidate" | "fired";

type Props = {
  telegramId: number;
  placement: TraderRosterPlacement;
  onChanged: () => void;
};

const LABELS: Record<TraderRosterPlacement, string> = {
  top: "В ТОП",
  candidate: "В кандидаты",
  fired: "Уволить",
};

const CONFIRM: Record<TraderRosterPlacement, string> = {
  top: "Перевести трейдера в блок «ТРЕЙДЕРЫ CULT»?",
  candidate: "Перевести трейдера в блок «КОНДИДАТЫ В CULT»?",
  fired: "Уволить трейдера? Публикация сигналов будет заблокирована.",
};

function rosterErrorMessage(err: unknown, cooldownMsg: string): string {
  const text = err instanceof Error ? err.message : "";
  if (text.includes("fired_cooldown")) return cooldownMsg;
  return text || "Не удалось изменить статус";
}

export function TraderRosterActions({ telegramId, placement, onChanged }: Props) {
  const copy = useThemedCopy();
  const [busy, setBusy] = useState(false);

  const move = async (section: TraderRosterPlacement) => {
    if (busy) return;
    const ok = await confirmAction(CONFIRM[section]);
    if (!ok) return;
    setBusy(true);
    try {
      await setTraderRoster(telegramId, section);
      onChanged();
    } catch (e) {
      window.alert(rosterErrorMessage(e, copy.rosterFiredCooldownMsg));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    const ok = await confirmAction("Сбросить ручную ротацию и вернуть автоматические правила?");
    if (!ok) return;
    setBusy(true);
    try {
      await resetTraderRoster(telegramId);
      onChanged();
    } catch (e) {
      window.alert(rosterErrorMessage(e, copy.rosterFiredCooldownMsg));
    } finally {
      setBusy(false);
    }
  };

  const actions: TraderRosterPlacement[] =
    placement === "top"
      ? ["candidate", "fired"]
      : placement === "candidate"
        ? ["top", "fired"]
        : ["top", "candidate"];

  return (
    <div className="trader-roster-actions" onClick={(e) => e.stopPropagation()}>
      {actions.map((section) => (
        <button
          key={section}
          type="button"
          className={`ghost-btn ghost-btn--sm trader-roster-actions__btn${section === "fired" ? " trader-roster-actions__btn--danger" : ""}`}
          disabled={busy}
          onClick={() => void move(section)}
        >
          {LABELS[section]}
        </button>
      ))}
      <button type="button" className="ghost-btn ghost-btn--sm" disabled={busy} onClick={() => void reset()}>
        Авто
      </button>
    </div>
  );
}
