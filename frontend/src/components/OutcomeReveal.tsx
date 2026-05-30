import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import WebApp from "@twa-dev/sdk";
import type { Signal } from "../api";
import { markOutcomeRevealPlayed } from "../utils/outcomeRevealStorage";
import { playLoseOutcomeSounds, playWinOutcomeSounds } from "../utils/outcomeSounds";

type Props = {
  signal: Signal;
  userId: number;
  onDone: () => void;
};

type Phase = "slam" | "shrink" | "done";

export function OutcomeReveal({ signal, userId, onDone }: Props) {
  const isWin = signal.status === "win";
  const word = isWin ? "WIN" : "LOSE";
  const [phase, setPhase] = useState<Phase>("slam");
  const [target, setTarget] = useState<DOMRect | null>(null);
  const [flyStyle, setFlyStyle] = useState<CSSProperties | null>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    markOutcomeRevealPlayed(userId, signal.id);
    const el = document.querySelector(`[data-outcome-badge="${signal.id}"]`);
    el?.classList.add("outcome--reveal-pop");
    window.setTimeout(() => el?.classList.remove("outcome--reveal-pop"), 900);
    onDone();
  };

  useEffect(() => {
    if (isWin) playWinOutcomeSounds();
    else playLoseOutcomeSounds();
    WebApp.HapticFeedback.notificationOccurred(isWin ? "success" : "error");

    const scrollT = window.setTimeout(() => {
      document
        .querySelector(`[data-outcome-badge="${signal.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);

    const shrinkT = window.setTimeout(() => {
      const el = document.querySelector(`[data-outcome-badge="${signal.id}"]`);
      if (el) setTarget(el.getBoundingClientRect());
      setPhase("shrink");
    }, 1550);

    const endT = window.setTimeout(() => {
      setPhase("done");
      finish();
    }, 2650);

    return () => {
      clearTimeout(scrollT);
      clearTimeout(shrinkT);
      clearTimeout(endT);
    };
  }, [isWin, signal.id]);

  useLayoutEffect(() => {
    if (phase !== "shrink" || !target || !flyRef.current) return;
    const fly = flyRef.current;
    const startCx = window.innerWidth / 2;
    const startCy = window.innerHeight * 0.42;
    const endCx = target.left + target.width / 2;
    const endCy = target.top + target.height / 2;
    const endScale = Math.max(0.14, Math.min(0.42, target.width / 140));

    fly.style.transition = "none";
    fly.style.left = `${startCx}px`;
    fly.style.top = `${startCy}px`;
    fly.style.transform = "translate(-50%, -50%) scale(1)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fly.style.transition =
          "left 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53), top 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53), transform 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53), opacity 0.35s ease 0.55s";
        fly.style.left = `${endCx}px`;
        fly.style.top = `${endCy}px`;
        fly.style.transform = `translate(-50%, -50%) scale(${endScale})`;
        fly.style.opacity = "0.15";
      });
    });

    setFlyStyle({
      left: startCx,
      top: startCy,
    });
  }, [phase, target]);

  if (phase === "done") return null;

  return (
    <div className="outcome-reveal" role="presentation" aria-hidden>
      <div className={`outcome-reveal__backdrop ${isWin ? "win" : "lose"}`} />
      <div className={`outcome-reveal__shake ${phase === "slam" ? "on" : ""}`} />

      {phase === "slam" && (
        <div className="outcome-reveal__center">
          <div className={`outcome-reveal__flash ${isWin ? "win" : "lose"}`} />
          <p className={`outcome-reveal__word ${isWin ? "win" : "lose"}`}>{word}</p>
          <p className="outcome-reveal__sub">#{signal.number} · {signal.symbol}</p>
        </div>
      )}

      {phase === "shrink" && (
        <div
          ref={flyRef}
          className={`outcome-reveal__fly ${isWin ? "win" : "lose"}`}
          style={flyStyle ?? undefined}
        >
          <span>{word}</span>
        </div>
      )}

    </div>
  );
}
