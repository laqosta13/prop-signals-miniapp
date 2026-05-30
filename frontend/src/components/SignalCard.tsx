import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { recordSignalView, toggleSignalLike, type Signal } from "../api";
import { calcRR, authorProfile, formatTakeProfits, formatTime, formatUsd, mediaUrl } from "../utils";
import { signalEntryStakePct, signalPriceMovePct, signalRealizedPnl, signalTrackerBalanceUsd } from "../utils/signalPnl";
import { useSignalLivePnl } from "../hooks/useSignalLivePnl";
import { canEditOrDeleteSignal, canCloseAtMarketSignal, canSupplementSignal } from "../utils/signalActions";
import { signalOutcomeDisplay } from "../utils/signalChartLevels";
import { Avatar } from "./Avatar";
import { SignalChart } from "./SignalChart";

type Props = {
  signal: Signal;
  liveTrackerBalance?: number | null;
  isAdmin?: boolean;
  myId?: number | null;
  canEngage?: boolean;
  onEdit?: (signal: Signal) => void;
  onDelete?: (id: number) => void;
  onSupplement?: (signal: Signal) => void;
  onCloseAtMarket?: (id: number) => void;
  deleting?: boolean;
  closing?: boolean;
  onPatch?: (id: number, patch: Partial<Signal>) => void;
};

export function SignalCard({
  signal: s,
  liveTrackerBalance,
  isAdmin,
  myId,
  canEngage = true,
  onEdit,
  onDelete,
  onSupplement,
  onCloseAtMarket,
  deleting,
  closing,
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
  const pnl = signalRealizedPnl(s) ?? s.realized_pnl;
  const stake = signalEntryStakePct(s);
  const trackerUsd = signalTrackerBalanceUsd(s, liveTrackerBalance);
  const movePct = signalPriceMovePct(s);
  const entryDone = !!(s.entry_filled_at || (!s.entry_low && !s.entry_high));
  const livePnl = useSignalLivePnl(s, s.status === "active" && entryDone, cardRef);
  const headerPnl = s.status === "active" && entryDone ? livePnl.pnl : pnl ?? null;
  const headerMove = s.status === "active" && entryDone ? livePnl.movePct : movePct ?? null;
  const pnlUp = (headerPnl ?? headerMove ?? 0) >= 0;
  const outcome = signalOutcomeDisplay(
    s.status,
    entryDone,
    s.close_reason,
    s.closed_exit_price,
    s.entry_low,
    s.entry_high,
    s.stop_loss,
    s.take_profits,
  );
  const statusBadge = outcome.label;
  const statusClass = outcome.className;
  const author = authorProfile(s.author_display_name, s.author_username);
  const rr = calcRR(entry === "—" ? null : entry, s.stop_loss, s.take_profits);
  const showResult = headerPnl != null || headerMove != null || (livePnl.loading && s.status === "active" && entryDone);

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

      <header className="signal-card__top">
        <div className="signal-card__identity">
          <Avatar url={s.author_avatar_url} displayName={s.author_display_name} username={s.author_username} size={40} />
          <div className="signal-card__who">
            <p className="signal-card__name">{author.title}</p>
            <div className="signal-card__sym">
              <span className="signal-number">#{s.number}</span>
              <span className="signal-ticker">{s.symbol}</span>
              <span className={`dir-badge ${isLong ? "long" : "short"}`}>
                {isLong ? "↑ LONG" : "↓ SHORT"}
              </span>
            </div>
          </div>
        </div>

        <div className="signal-card__perf">
          <span className={`outcome outcome--head ${statusClass}`} data-outcome-badge={s.id}>
            {statusBadge}
          </span>
          {showResult && (
            <div className={`signal-card__result ${pnlUp ? "up" : "down"}`} aria-live="polite">
              <span className="signal-card__result-label">PnL</span>
              {headerPnl != null ? (
                <span className="signal-card__result-usd">
                  {headerPnl >= 0 ? "+" : ""}
                  {formatUsd(headerPnl)}
                </span>
              ) : livePnl.loading ? (
                <span className="signal-card__result-usd signal-card__result-usd--pending">…</span>
              ) : null}
              {headerMove != null && (
                <span className="signal-card__result-pct">
                  {headerMove >= 0 ? "+" : ""}
                  {headerMove.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {isAdmin && canEditOrDeleteSignal(s, myId, !!isAdmin) && (
        <div className="signal-card__admin-bar">
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

      <time className="signal-card__time">{formatTime(s.created_at)}</time>

      <div className="signal-card__params" aria-label="Условия входа">
        <div className="signal-param">
          <span className="signal-param__label">Вход</span>
          <span className="signal-param__value">{stake}%</span>
        </div>
        <div className="signal-param">
          <span className="signal-param__label">Трекер</span>
          <span className="signal-param__value">{trackerUsd > 0 ? formatUsd(trackerUsd) : "—"}</span>
        </div>
        <div className="signal-param">
          <span className="signal-param__label">Плечо</span>
          <span className="signal-param__value">{s.leverage ?? 1}x</span>
        </div>
        <div className="signal-param">
          <span className="signal-param__label">RR</span>
          <span className="signal-param__value">{rr}</span>
        </div>
      </div>

      <SignalChart
        key={`${s.id}-${s.status}-${s.closed_at ?? "open"}`}
        symbol={s.symbol}
        createdAt={s.created_at}
        entryLow={s.entry_low}
        entryHigh={s.entry_high}
        stopLoss={s.stop_loss}
        takeProfits={s.take_profits}
        closedAt={s.closed_at}
        closeReason={s.close_reason}
        closedExitPrice={s.closed_exit_price}
        status={s.status}
        entryFilledAt={s.entry_filled_at}
        entryPrice={s.published_market_price}
        frozen={s.status === "win" || s.status === "lose"}
      />

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
        <section className="signal-supplements" aria-label="Дополнения к сигналу">
          <header className="signal-supplements__head">
            <span className="signal-supplements__badge" aria-hidden>
              ＋
            </span>
            <span className="signal-supplements__title">Дополнения</span>
            <span className="signal-supplements__count">{s.supplements!.length}</span>
          </header>
          {s.supplements!.map((sup, idx) => (
            <article key={sup.id} className="signal-supplement">
              <header className="signal-supplement__head">
                <span className="signal-supplement__label">Доп. {idx + 1}</span>
                <time className="signal-supplement__time">{formatTime(sup.created_at)}</time>
              </header>
              {sup.comment && <p className="signal-supplement__comment">{sup.comment}</p>}
              {sup.media_image_url && (
                <button type="button" className="media-thumb" onClick={() => setLightbox(mediaUrl(sup.media_image_url))}>
                  <img src={mediaUrl(sup.media_image_url)!} alt="Скрин дополнения" className="signal-media-img" />
                </button>
              )}
              {sup.media_video_url && (
                <video src={mediaUrl(sup.media_video_url)!} controls className="signal-media-video" playsInline />
              )}
            </article>
          ))}
        </section>
      )}

      {isAdmin &&
        ((canSupplementSignal(s, myId, !!isAdmin) && onSupplement) ||
          (canCloseAtMarketSignal(s, myId, !!isAdmin) && onCloseAtMarket)) && (
          <div className="signal-admin-actions">
            {canSupplementSignal(s, myId, !!isAdmin) && onSupplement && (
              <button type="button" className="supplement-btn" onClick={() => onSupplement(s)}>
                <span className="supplement-btn__icon" aria-hidden>
                  ＋
                </span>
                Дополнить
              </button>
            )}
            {canCloseAtMarketSignal(s, myId, !!isAdmin) && onCloseAtMarket && (
              <button
                type="button"
                className="close-market-btn"
                disabled={closing}
                onClick={() => onCloseAtMarket(s.id)}
              >
                Закрыть по рынку
              </button>
            )}
          </div>
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
    </article>
  );
}
