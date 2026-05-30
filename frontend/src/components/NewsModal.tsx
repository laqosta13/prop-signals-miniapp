import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createNewsPost, fetchNewsLinkPreview, updateNewsPost, type NewsLinkPreview, type NewsPost } from "../api";
import { LinkPreviewCard } from "./LinkPreviewCard";

type Props = {
  open: boolean;
  post: NewsPost | null;
  onClose: () => void;
  onSaved: () => void;
};

export function NewsModal({ open, post, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState<NewsLinkPreview | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewErr, setLinkPreviewErr] = useState<string | null>(null);
  const [removeLink, setRemoveLink] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const previewReq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTitle(post?.title ?? "");
    setBody(post?.body ?? "");
    setLinkUrl(post?.link?.url ?? "");
    setLinkPreview(post?.link ?? null);
    setLinkPreviewLoading(false);
    setLinkPreviewErr(null);
    setRemoveLink(false);
    setImage(null);
    setVideo(null);
    setRemoveImage(false);
    setRemoveVideo(false);
    setErr(null);
  }, [open, post]);

  useEffect(() => {
    if (!open || removeLink) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkPreview(null);
      setLinkPreviewErr(null);
      setLinkPreviewLoading(false);
      return;
    }
    if (post?.link?.url === trimmed && post.link) {
      setLinkPreview(post.link);
      setLinkPreviewErr(null);
      setLinkPreviewLoading(false);
      return;
    }

    const reqId = ++previewReq.current;
    setLinkPreviewLoading(true);
    setLinkPreviewErr(null);
    const timer = window.setTimeout(() => {
      void fetchNewsLinkPreview(trimmed)
        .then((preview) => {
          if (previewReq.current !== reqId) return;
          setLinkPreview(preview);
          setLinkPreviewErr(null);
        })
        .catch((e) => {
          if (previewReq.current !== reqId) return;
          setLinkPreview(null);
          setLinkPreviewErr(e instanceof Error ? e.message : "Не удалось загрузить предпросмотр");
        })
        .finally(() => {
          if (previewReq.current === reqId) setLinkPreviewLoading(false);
        });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [open, linkUrl, post, removeLink]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("body", body.trim());
    if (post && removeImage) fd.append("remove_image", "true");
    if (post && removeVideo) fd.append("remove_video", "true");
    if (post && removeLink) {
      fd.append("remove_link", "true");
    } else {
      fd.append("link_url", linkUrl.trim());
    }
    if (image) fd.append("image", image);
    if (video) fd.append("video", video);
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

  const clearLink = () => {
    setLinkUrl("");
    setLinkPreview(null);
    setLinkPreviewErr(null);
    setRemoveLink(true);
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

          <label className="field-label">Ссылка (необязательно)</label>
          <input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setRemoveLink(false);
            }}
          />
          {linkPreviewLoading && <p className="meta">Загрузка предпросмотра…</p>}
          {linkPreviewErr && <p className="err">{linkPreviewErr}</p>}
          {linkPreview && !removeLink && <LinkPreviewCard link={linkPreview} compact />}
          {(linkUrl.trim() || (post?.link && !removeLink)) && (
            <button type="button" className="ghost-btn ghost-btn--sm news-modal__clear-link" onClick={clearLink}>
              Убрать ссылку
            </button>
          )}

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

          <label className="field-label">Видео (необязательно)</label>
          {post?.video_url && !removeVideo && !video && (
            <p className="meta">
              Видео прикреплено.{" "}
              <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => setRemoveVideo(true)}>
                Убрать
              </button>
            </p>
          )}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
          />

          {err && <p className="err">{err}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="submit-btn" disabled={busy || linkPreviewLoading}>
              {busy ? "…" : post ? "Сохранить" : "Опубликовать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
