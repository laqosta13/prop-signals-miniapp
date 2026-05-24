import { useCallback, useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import {
  createReview,
  deleteReview,
  fetchReviews,
  updateReview,
  type Review,
} from "../api";
import { authorProfile, formatTime } from "../utils";
import { Avatar } from "./Avatar";

type Props = {
  isAdmin: boolean;
};

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function ReviewsTab({ isAdmin }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = reviews.find((r) => r.is_mine) ?? null;

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
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (body.length < 3) {
      setErr("Минимум 3 символа");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (mine) {
        await updateReview(mine.id, { text: body, rating });
      } else {
        await createReview({ text: body, rating });
      }
      WebApp.HapticFeedback.notificationOccurred("success");
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
        <form onSubmit={submit}>
          <label className="field-label">Оценка</label>
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={rating >= n ? "on" : ""}
                onClick={() => setRating(n)}
                aria-label={`${n} звёзд`}
              >
                ★
              </button>
            ))}
          </div>
          <label className="field-label">Текст</label>
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Расскажите о своём опыте…"
            maxLength={2000}
          />
          {err && <p className="err">{err}</p>}
          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? "…" : mine ? "Сохранить" : "Опубликовать"}
          </button>
        </form>
      </section>

      {reviews.length === 0 && <p className="meta">Пока нет отзывов — будьте первым.</p>}

      <ul className="review-list">
        {reviews.map((r) => {
          const profile = authorProfile(r.author_display_name, r.author_username);
          const canDelete = r.is_mine || isAdmin;
          return (
            <li key={r.id} className="review-card">
              <header className="review-card__head">
                <Avatar url={r.author_avatar_url} displayName={profile.title} username={r.author_username} size={36} />
                <div>
                  <strong>{profile.title}</strong>
                  {profile.subtitle && <span className="author-line">{profile.subtitle}</span>}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
