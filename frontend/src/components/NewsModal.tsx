import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createNewsPost, updateNewsPost, type NewsPost } from "../api";

type Props = {
  open: boolean;
  post: NewsPost | null;
  onClose: () => void;
  onSaved: () => void;
};

export function NewsModal({ open, post, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(post?.title ?? "");
    setBody(post?.body ?? "");
    setImage(null);
    setRemoveImage(false);
    setErr(null);
  }, [open, post]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("body", body.trim());
    if (post && removeImage) fd.append("remove_image", "true");
    if (image) fd.append("image", image);
    try {
      if (post) {
        await updateNewsPost(post.id, fd);
      } else {
        await createNewsPost(fd);
      }
      WebApp.HapticFeedback.notificationOccurred("success");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{post ? "Редактировать новость" : "Новая новость"}</h2>
        <form onSubmit={submit}>
          <label className="field-label">Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />

          <label className="field-label">Текст</label>
          <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} required />

          <label className="field-label">Обложка (необязательно)</label>
          {post?.image_url && !removeImage && !image && (
            <p className="meta">
              Текущая обложка сохранена.{" "}
              <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => setRemoveImage(true)}>
                Убрать
              </button>
            </p>
          )}
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />

          {err && <p className="err">{err}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="submit-btn" disabled={busy}>
              {busy ? "…" : post ? "Сохранить" : "Опубликовать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
