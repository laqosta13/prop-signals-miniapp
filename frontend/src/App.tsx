import { useCallback, useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { createSignal, fetchMe, fetchSignals, type Signal } from "./api";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Показ тейков: и старый JSON, и обычный текст через запятую */
function formatTakeProfits(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) return arr.map(String).join(", ");
    } catch {
      /* как есть */
    }
  }
  return trimmed;
}

/** Ввод: 1.08, 1.09 или старый JSON — на сервер уходит простая строка */
function normalizeTakeProfits(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) {
        const levels = arr.map(String).map((s) => s.trim()).filter(Boolean);
        if (levels.length) return levels.join(", ");
      }
    } catch {
      /* ниже — через запятую */
    }
  }
  const levels = trimmed
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return levels.length ? levels.join(", ") : undefined;
}

export default function App() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const user = WebApp.initDataUnsafe.user;
  const isDevBypass = import.meta.env.DEV && !!import.meta.env.VITE_DEV_TELEGRAM_USER_ID;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [data, me] = await Promise.all([fetchSignals(), fetchMe()]);
      setSignals(data);
      setIsAdmin(me.is_admin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [form, setForm] = useState({
    symbol: "",
    direction: "long" as "long" | "short",
    entry_low: "",
    entry_high: "",
    stop_loss: "",
    take_profits: "",
    comment: "",
  });

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSignal({
        symbol: form.symbol,
        direction: form.direction,
        entry_low: form.entry_low || undefined,
        entry_high: form.entry_high || undefined,
        stop_loss: form.stop_loss || undefined,
        take_profits: normalizeTakeProfits(form.take_profits),
        comment: form.comment || undefined,
      });
      setForm((f) => ({ ...f, symbol: "", comment: "" }));
      await load();
      WebApp.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать сигнал");
      WebApp.HapticFeedback.notificationOccurred("error");
    } finally {
      setSubmitting(false);
    }
  };

  const headerSub = useMemo(() => {
    if (user?.username) return `@${user.username}`;
    if (user?.id) return `id: ${user.id}`;
    if (isDevBypass) return "режим разработки (VITE_DEV_TELEGRAM_USER_ID)";
    return "откройте из Telegram Mini App";
  }, [user, isDevBypass]);

  return (
    <>
      <h1>Лента сигналов</h1>
      <p className="sub">{headerSub}</p>

      {isAdmin && (
        <form className="admin" onSubmit={onSubmit}>
          <div>
            <label>Инструмент</label>
            <input
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              placeholder="EURUSD / XAUUSD / NQ ..."
              required
            />
          </div>
          <div>
            <label>Направление</label>
            <select
              value={form.direction}
              onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as "long" | "short" }))}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label>Вход (низ)</label>
            <input value={form.entry_low} onChange={(e) => setForm((f) => ({ ...f, entry_low: e.target.value }))} />
          </div>
          <div>
            <label>Вход (верх)</label>
            <input value={form.entry_high} onChange={(e) => setForm((f) => ({ ...f, entry_high: e.target.value }))} />
          </div>
          <div>
            <label>Стоп</label>
            <input value={form.stop_loss} onChange={(e) => setForm((f) => ({ ...f, stop_loss: e.target.value }))} />
          </div>
          <div>
            <label>Тейки</label>
            <input
              value={form.take_profits}
              onChange={(e) => setForm((f) => ({ ...f, take_profits: e.target.value }))}
              placeholder="1.0850, 1.0900"
            />
          </div>
          <div>
            <label>Комментарий</label>
            <textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
          </div>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "Отправка…" : "Опубликовать"}
          </button>
        </form>
      )}

      {error && <div className="err">{error}</div>}
      {loading && <p className="meta">Загрузка…</p>}
      {!loading && signals.length === 0 && <p className="meta">Пока нет сигналов.</p>}

      {signals.map((s) => (
        <article key={s.id} className="card">
          <div className="card-head">
            <span className="symbol">{s.symbol}</span>
            <span className={`badge ${s.direction}`}>{s.direction}</span>
          </div>
          <div className="meta">{formatTime(s.created_at)}</div>
          {(s.entry_low || s.entry_high) && (
            <div className="row">
              Вход: {s.entry_low ?? "—"} — {s.entry_high ?? "—"}
            </div>
          )}
          {s.stop_loss && <div className="row">Стоп: {s.stop_loss}</div>}
          {s.take_profits && <div className="row">Тейки: {formatTakeProfits(s.take_profits)}</div>}
          {s.comment && <div className="row">{s.comment}</div>}
          <div className="meta" style={{ marginTop: 8 }}>
            Статус: {s.status}
          </div>
        </article>
      ))}
    </>
  );
}
