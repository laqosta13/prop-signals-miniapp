import { useCallback, useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  createReview,
  deleteReview,
  fetchReviews,
  updateReview,
  type Review,
} from "../api";
import { REVIEW_RULES, REVIEW_RULES_TITLE } from "../data/reviewRules";
import { authorProfile, formatTime, mediaUrl } from "../utils";
import { reviewTextError } from "../utils/reviewText";
import { ruTextFieldProps } from "../utils/textFieldProps";
import { Avatar } from "./Avatar";
import { FieldLabelWithPaste, appendPastedText } from "./FieldLabelWithPaste";

type Props = {
  isAdmin: boolean;
  canWriteReview: boolean;
  reviewWriteBlockedReason: string | null;
  daysUntilReview: number | null;
  refreshKey?: number;
};

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function writeBlockMessage(reason: string | null, days: number | null): string {
  if (reason === "wait_days") return `Отзыв через ${days ?? 7} дн. после регистрации.`;
  if (reason === "subscription_required") return "Нужна активная подписка.";
  return "Отзыв недоступен.";
}

export function ReviewsTab({
  isAdmin,
  canWriteReview,
  reviewWriteBlockedReason,
  daysUntilReview,
  refreshKey = 0,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = reviews.find((r) => r.is_mine) ?? null;
  const canEdit = canWriteReview || isAdmin;

  const load = useCallback(async () => {
    try {
      const data = await fetchReviews();
      setReviews(data);
      setErr(null);
      const own = data.find((r) => r.is_mine);
      if (own) {
        setText(own.text);
        setRating(own.rating);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onScreenshot = (file: File | null) => {
    setImage(file);
    setRemoveImage(false);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const body = text.trim();
    if (body.length < 3) {
      setErr("Минимум 3 символа");
      return;
    }
    const textErr = reviewTextError(body);
    if (textErr) {
      setErr(textErr);
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("text", body);
    fd.append("rating", String(rating));
    if (mine && removeImage) fd.append("remove_image", "true");
    if (image) fd.append("image", image);
    try {
      if (mine) {
        await updateReview(mine.id, fd);
      } else {
        await createReview(fd);
      }
      WebApp.HapticFeedback.notificationOccurred("success");
      setImage(null);
      if (shotPreview) URL.revokeObjectURL(shotPreview);
      setShotPreview(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить отзыв?")) return;
    setBusy(true);
    try {
      await deleteReview(id);
      if (mine?.id === id) {
        setText("");
        setRating(5);
        setImage(null);
        if (shotPreview) URL.revokeObjectURL(shotPreview);
        setShotPreview(null);
      }
      WebApp.HapticFeedback.notificationOccurred("success");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="meta">Загрузка…</p>;

  return (
    <div className="reviews-tab">
      <section className="review-form-card">
        <h3>{mine ? "Ваш отзыв" : "Оставить отзыв"}</h3>
        <div className="review-rules" aria-label={REVIEW_RULES_TITLE}>
          <p className="review-rules__title">{REVIEW_RULES_TITLE}</p>
          <ul className="review-rules__list">
            {REVIEW_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        {!canEdit && !mine && (
          <p className="meta review-hint">{writeBlockMessage(reviewWriteBlockedReason, daysUntilReview)}</p>
        )}
        {(canEdit || mine) && (
          <form onSubmit={submit}>
            <label className="field-label">Оценка</label>
            <div className="star-picker">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={rating >= n ? "on" : ""}
                  onClick={() => canEdit && setRating(n)}
                  disabled={!canEdit}
                  aria-label={`${n} звёзд`}
                >
                  ★
                </button>
              ))}
            </div>
            <FieldLabelWithPaste
              label="Текст"
              onPaste={(text) => setText((prev) => appendPastedText(prev, text))}
              disabled={!canEdit || busy}
            />
            <textarea
              {...ruTextFieldProps}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Расскажите о своём опыте…"
              maxLength={2000}
              disabled={!canEdit}
            />
            <label className="field-label">Скрин (необязательно)</label>
            {mine?.image_url && !removeImage && !image && (
              <p className="meta">
                Скрин прикреплён.{" "}
                {canEdit && (
                  <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => setRemoveImage(true)}>
                    Убрать
                  </button>
                )}
              </p>
            )}
            {canEdit && (
              <input type="file" accept="image/*" onChange={(e) => onScreenshot(e.target.files?.[0] ?? null)} />
            )}
            {shotPreview && <img className="review-shot-preview" src={shotPreview} alt="" />}
            {err && <p className="err">{err}</p>}
            {canEdit && (
              <button type="submit" className="submit-btn" disabled={busy}>
                {busy ? "…" : mine ? "Сохранить" : "Опубликовать"}
              </button>
            )}
          </form>
        )}
      </section>

      {reviews.length === 0 && <p className="meta">Пока нет отзывов.</p>}

      <ul className="review-list">
        {reviews.map((r) => {
          const profile = authorProfile(r.author_display_name, r.author_username);
          const canDelete = r.is_mine || isAdmin;
          const imgSrc = mediaUrl(r.image_url);
          return (
            <li key={r.id} className="review-card">
              <header className="review-card__head">
                <Avatar url={r.author_avatar_url} displayName={profile.title} username={r.author_username} size={36} />
                <div>
                  <strong>{profile.title}</strong>
                  <span className="meta">{formatTime(r.created_at)}</span>
                </div>
                {canDelete && (
                  <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => void remove(r.id)} disabled={busy}>
                    ✕
                  </button>
                )}
              </header>
              <p className="review-stars" aria-label={`Оценка ${r.rating} из 5`}>
                {stars(r.rating)}
              </p>
              <p className="review-text">{r.text}</p>
              {imgSrc && (
                <button type="button" className="review-shot-btn" onClick={() => setLightbox(imgSrc)}>
                  <img className="signal-media-img" src={imgSrc} alt="Скрин отзыва" loading="lazy" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {lightbox && (
        <div className="lightbox" role="dialog" onClick={() => setLightbox(null)}>
          <button type="button" className="lightbox__close" aria-label="Закрыть" onClick={() => setLightbox(null)}>
            ✕
          </button>
          <img src={lightbox} alt="" className="lightbox__img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
