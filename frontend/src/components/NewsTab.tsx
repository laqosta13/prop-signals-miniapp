import { useCallback, useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { deleteNewsPost, fetchNews, type NewsPost } from "../api";
import { formatTime, mediaUrl } from "../utils";

type Props = {
  isAdmin: boolean;
  onEdit: (post: NewsPost) => void;
  refreshKey?: number;
};

export function NewsTab({ isAdmin, onEdit, refreshKey = 0 }: Props) {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPosts(await fetchNews());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const remove = async (id: number) => {
    if (!confirm("Удалить новость?")) return;
    try {
      await deleteNewsPost(id);
      WebApp.HapticFeedback.notificationOccurred("success");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (loading) return <p className="meta">Загрузка…</p>;
  if (err) return <p className="err">{err}</p>;
  if (posts.length === 0) return <p className="meta">Пока нет новостей.</p>;

  return (
    <ul className="news-list">
      {posts.map((p) => {
        const videoSrc = mediaUrl(p.video_url);
        const imageSrc = mediaUrl(p.image_url);
        return (
          <li key={p.id} className="news-card">
            <header className="news-card__head">
              <div>
                <h3>{p.title}</h3>
                <p className="meta">
                  {formatTime(p.created_at)}
                  {p.author_display_name ? ` · ${p.author_display_name}` : ""}
                </p>
              </div>
              {isAdmin && (
                <div className="news-card__actions">
                  <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => onEdit(p)}>
                    Изм.
                  </button>
                  <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => void remove(p.id)}>
                    ✕
                  </button>
                </div>
              )}
            </header>
            {imageSrc && <img className="news-card__img" src={imageSrc} alt="" loading="lazy" />}
            {videoSrc && (
              <video className="news-card__video" src={videoSrc} controls playsInline preload="metadata" />
            )}
            <p className="news-card__body">{p.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
