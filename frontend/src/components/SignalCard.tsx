import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { recordSignalView, toggleSignalLike, type Signal } from "../api";
import { calcRR, authorProfile, formatTakeProfits, formatTime, formatUsd, mediaUrl } from "../utils";
import { canEditOrDeleteSignal, canSupplementSignal } from "../utils/signalActions";
import { Avatar } from "./Avatar";

type Props = {
  signal: Signal;
  isAdmin?: boolean;
  myId?: number | null;
  canEngage?: boolean;
  onEdit?: (signal: Signal) => void;
  onDelete?: (id: number) => void;
  onSupplement?: (signal: Signal) => void;
  deleting?: boolean;
  onPatch?: (id: number, patch: Partial<Signal>) => void;
};

export function SignalCard({
  signal: s,
  isAdmin,
  myId,
  canEngage = true,
  onEdit,
  onDelete,
  onSupplement,
  deleting,
  onPatch,
}: Props) {
  const [views, setViews] = useState(s.views_count);
  const [likes, setLikes] = useState(s.likes_count);
  const [liked, setLiked] = useState(s.liked_by_me);
  const [liking, setLiking] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const viewRecorded = useRef(false);

  useEffect(() => {
    setViews(s.views_count);
    setLikes(s.likes_count);
    setLiked(s.liked_by_me);
  }, [s.views_count, s.likes_count, s.liked_by_me]);

  useEffect(() => {
    viewRecorded.current = false;
  }, [s.id]);

  useEffect(() => {
    if (!canEngage || viewRecorded.current) return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || viewRecorded.current) return;
        viewRecorded.current = true;
        void recordSignalView(s.id)
          .then((r) => {
            setViews(r.views_count);
            onPatch?.(s.id, { views_count: r.views_count });
          })
          .catch(() => {});
      },
      { threshold: 0.2, rootMargin: "40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [s.id, canEngage, onPatch]);

  const entry = s.entry_low || s.entry_high || "—";
  const target = formatTakeProfits(s.take_profits);
  const isLong = s.direction === "long";
  const pnl = s.realized_pnl;
  const stake = s.risk_percent ?? s.points_percent ?? 1;
  const tracker = s.tracker_balance;
  const entryDone = !!(s.entry_filled_at || (!s.entry_low && !s.entry_high));

  let statusBadge = "Активен";
  let statusClass = "active";
  if (s.status === "win") {
    statusBadge = "Цель достигнута";
    statusClass = "win";
  } else if (s.status === "lose") {
    statusBadge = "Стоп";
    statusClass = "lose";
  } else if (!entryDone) {
    statusBadge = "Ожидание входа";
    statusClass = "waiting";
  } else {
    statusClass = "active-in";
  }

  const author = authorProfile(s.author_display_name, s.author_username);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const r = await toggleSignalLike(s.id);
      setLiked(r.liked);
      setLikes(r.likes_count);
      onPatch?.(s.id, { liked_by_me: r.liked, likes_count: r.likes_count });
      WebApp.HapticFeedback.impactOccurred("light");
    } catch {
      /* */
    } finally {
      setLiking(false);
    }
  };

  return (
    <article ref={cardRef} className="signal-card">
      {lightbox && (
        <div className="lightbox" role="dialog" onClick={() => setLightbox(null)}>
          <button type="button" className="lightbox__close" aria-label="Закрыть" onClick={() => setLightbox(null)}>
            ×
          </button>
          <img src={lightbox} alt="" className="lightbox__img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <header className="signal-card__head">
        <div className="signal-card__author">
          <Avatar url={s.author_avatar_url} displayName={s.author_display_name} username={s.author_username} size={36} />
          <div>
            <h3>{s.symbol}</h3>
            <span className="author-line author-line--name">{author.title}</span>
            {author.subtitle && <span className="author-line author-line--login">{author.subtitle}</span>}
            <span className={`dir-badge ${isLong ? "long" : "short"}`}>
              {isLong ? "↑ LONG" : "↓ SHORT"}
            </span>
          </div>
        </div>
        <div className="signal-card__actions">
          <span className="risk-tag">Вход {stake}%</span>
          {tracker != null && tracker > 0 && <span className="risk-tag">Трекер {formatUsd(tracker)}</span>}
          {isAdmin && canEditOrDeleteSignal(s, myId, !!isAdmin) && (
            <div className="admin-actions">
              {onEdit && (
                <button type="button" className="edit-btn" onClick={() => onEdit(s)}>
                  Изменить
                </button>
              )}
              {onDelete && (
                <button type="button" className="delete-btn" disabled={deleting} onClick={() => onDelete(s.id)}>
                  Удалить
                </button>
              )}
            </div>
          )}
        </div>
      </header>
      <p className="signal-card__time">{formatTime(s.created_at)}</p>
      <div className="levels-grid">
        <div>
          <span>вход</span>
          <strong>{entry}</strong>
        </div>
        <div className="stop">
          <span>стоп</span>
          <strong>{s.stop_loss || "—"}</strong>
        </div>
        <div className="target">
          <span>цель</span>
          <strong>{target}</strong>
        </div>
      </div>
      {s.media_image_url && (
        <button type="button" className="media-thumb" onClick={() => setLightbox(mediaUrl(s.media_image_url))}>
          <img src={mediaUrl(s.media_image_url)!} alt="Скрин" className="signal-media-img" />
        </button>
      )}
      {s.media_video_url && (
        <video src={mediaUrl(s.media_video_url)!} controls className="signal-media-video" playsInline />
      )}
      {s.comment && <p className="signal-card__comment">{s.comment}</p>}
      {(s.supplements?.length ?? 0) > 0 && (
        <section className="signal-supplements">
          <h4 className="signal-supplements__title">Дополнения</h4>
          {s.supplements!.map((sup) => (
            <div key={sup.id} className="signal-supplement">
              <p className="signal-supplement__time">{formatTime(sup.created_at)}</p>
              {sup.comment && <p className="signal-card__comment">{sup.comment}</p>}
              {sup.media_image_url && (
                <button type="button" className="media-thumb" onClick={() => setLightbox(mediaUrl(sup.media_image_url))}>
                  <img src={mediaUrl(sup.media_image_url)!} alt="Скрин дополнения" className="signal-media-img" />
                </button>
              )}
              {sup.media_video_url && (
                <video src={mediaUrl(sup.media_video_url)!} controls className="signal-media-video" playsInline />
              )}
            </div>
          ))}
        </section>
      )}
      {isAdmin && canSupplementSignal(s, myId, !!isAdmin) && onSupplement && (
        <button type="button" className="supplement-btn" onClick={() => onSupplement(s)}>
          Дополнить сигнал
        </button>
      )}
      <div className="signal-engagement">
        <span className="engagement-stat" title="Просмотры">
          👁 {views}
        </span>
        <button
          type="button"
          className={`like-btn ${liked ? "on" : ""}`}
          disabled={liking}
          onClick={() => void handleLike()}
        >
          {liked ? "♥" : "♡"} {likes}
        </button>
      </div>
      <footer className="signal-card__foot">
        <span>Плечо {s.leverage ?? 5}x</span>
        <span>RR {calcRR(entry === "—" ? null : entry, s.stop_loss, s.take_profits)}</span>
        {pnl != null && (
          <span className={pnl >= 0 ? "pnl-win" : "pnl-lose"}>
            {pnl >= 0 ? "+" : ""}
            {formatUsd(pnl)}
          </span>
        )}
        <span className={`outcome ${statusClass}`}>{statusBadge}</span>
      </footer>
    </article>
  );
}
