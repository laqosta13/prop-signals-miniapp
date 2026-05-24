# Prop Signals Mini App — контекст проекта

Документ для напоминания контекста в новых сессиях с AI.  
Вставь в начало чата: *«Продолжаем prop-signals-miniapp, контекст в PROJECT.md»*

---

## Общее

| Параметр | Значение |
|---|---|
| **Репозиторий** | `laqosta13/prop-signals-miniapp` |
| **Путь локально** | `prop-signals-miniapp/` (корень репозитория) |
| **Стек** | FastAPI + SQLite + React/Vite + Telegram Mini App |
| **Деплой** | Docker → Amvera Cloud, постоянный диск `/data` |
| **Брендинг** | PROP-DESK · Hash Hedge |

**Суть:** Telegram Mini App с лентой торговых сигналов. Публикуют только **админы** (`TELEGRAM_ADMIN_IDS`). Пользователи смотрят ленту по **подписке**.

---

## Вкладки приложения

1. **Лента** — сигналы, просмотры/лайки, мини-трекеры админов, галочка уведомлений
2. **Трекер** — Hash Hedge challenge для каждого админа
3. **ТОП** — рейтинг трейдеров + кривая доходности по дням
4. **Подписка** — оплата USDT TON, рефералы, trial

---

## Роли

- **Админ** — публикует/редактирует/удаляет/дополняет сигналы, свой трекер, доступ без подписки
- **Подписчик** — активные сигналы при подписке (trial 3 дня = подписка) + уведомления в Telegram

---

## Доступ без подписки vs с подпиской

| Раздел | Без подписки | С подпиской / админ |
|---|---|---|
| Лента: **отработанные** (win/lose) | ✓ `GET /signals/preview` | ✓ |
| Лента: **активные** сигналы | ✗ | ✓ `GET /signals` |
| Трекер Hash Hedge | ✓ | ✓ |
| ТОП / equity curve | ✓ | ✓ |
| Лайки / просмотры (win/lose) | ✓ | ✓ |
| Лайки / просмотры (active) | ✗ | ✓ |
| Уведомления в Telegram | ✗ (кроме trial/оплаты) | ✓ |

Frontend: без подписки вызывает `fetchSignalsPreview()`, с подпиской — `fetchSignals()`. Дополнительный фильтр `visibleFeedSignals()` на клиенте.

---

## Сигналы — поля и UI

- **Инструмент**, **LONG/SHORT**
- **Вход / Стоп / Цель**
- **Плечо** (по умолчанию **1**)
- **Сумма входа %** (раньше «Риск %») — доля от баланса трекера
- **Трекер $** — только чтение, берётся **фактический баланс** Hash Hedge трекера админа (не фикс 5000)
- **Скрин / Видео / Комментарий** (на русском)

**Кнопка «+»** — в **правом верхнем углу** шапки на вкладке Лента (не FAB снизу).

**Автор на карточке:** имя (Telegram `first_name` + `last_name`), строка `@username`, **аватар** слева от инструмента. Не показываем числовой `telegram_id` в UI.

---

## Статусы сигнала

| Статус | Условие | UI |
|---|---|---|
| Ожидание входа | `active`, вход не сработал | waiting |
| Активен (в сделке) | `entry_filled_at` есть | цвет **#E0AFFF** |
| Цель достигнута | `win` | green |
| Стоп | `lose` | red |

---

## Логика входа (лимитный)

Функция `entry_triggered()` в `backend/app/signal_utils.py`:

- **LONG**, вход 76901: рынок **≤ 76901** → вход сработал, сигнал активен
- **SHORT**, вход 76901: рынок **≥ 76901** → вход сработал
- Проверка: при **публикации**, **редактировании**, **загрузке ленты** (`GET /signals`), **старте сервера**, каждые **60 сек** (price monitor)

**Источники цен:** Binance → Bybit → Binance US (`backend/app/price_service.py`).

---

## Правила редактирования / удаления / дополнения

| Действие | Когда доступно |
|---|---|
| **Изменить / Удалить** | Только до срабатывания входа (`signal_awaiting_entry`) |
| **Дополнить сигнал** | После входа в сделку (`signal_in_trade`) — комментарий, скрин, видео |

Дополнения: таблица `signal_supplements`, блок «Дополнения» в карточке.

Frontend-правила: `frontend/src/utils/signalActions.ts`.

---

## Профиль админа (Trader) и аватары

Таблица **`traders`** (PK = `telegram_id`): `username`, `first_name`, `last_name`, `avatar_path`, рейтинг и статистика.

| Где показывается | Поля API |
|---|---|
| Карточка сигнала | `author_display_name`, `author_username`, `author_avatar_url` |
| ТОП | `display_name`, `username`, `avatar_url` |
| Трекер / PropTrackerMini | `owner_display_name`, `owner_username`, `owner_avatar_url` |

**Отображение имени:** `trader_display_name()` — склеивает `first_name` + `last_name`; fallback на `@username`.  
Frontend: `authorProfile()` в `frontend/src/utils.ts` (title + subtitle `@login`).

**Загрузка аватара** (`backend/app/telegram_avatar.py`):

1. При каждом запросе с initData админ вызывает `get_or_create_trader(..., photo_url=...)` в `deps.py`.
2. Сначала скачивание по **`photo_url`** из Telegram Web App initData (`telegram_auth.py`).
3. Fallback: Bot API `getUserProfilePhotos` + `getFile` (нужен **`BOT_TOKEN`**).
4. Файл на диске: `{MEDIA_ROOT}/avatars/{telegram_id}.jpg` → URL `/media/avatars/{id}.jpg`.
5. Если файл на диске есть, но в БД пути нет — путь восстанавливается; если файла нет — повторная загрузка.

**Важно:** `get_db()` делает `commit()` при успешном завершении запроса — иначе `avatar_path` терялся после read-only запросов (лента).

**UI:** компонент `Avatar.tsx` — картинка или инициалы при отсутствии/ошибке загрузки (`onError`).

Админы создаются только через **`TELEGRAM_ADMIN_IDS`** (нет UI добавления админов).

---

## P/L, трекер и рейтинг

**Номинал позиции** = `трекер × сумма входа % / 100`  
Пример: трекер $5000, вход 50% → **$2500**

**P/L $** = номинал × **% движения цены** (вход → выход) / 100  
Пример: +1% движения → **+$25** на трекер

**Рейтинг** (`rating_percent`) = сумма **% движения цены** по сделкам (не ±сумма входа %).

**ТОП:** кумулятивная **кривая доходности** (`frontend/src/components/EquityCurve.tsx`) + P/L $ и % по дням.

При закрытии сигнала баланс трекера админа обновляется на `realized_pnl`.

Логика: `backend/app/trader_stats.py`, `leaderboard_service.py`.

---

## Просмотры и лайки

- Уникальный просмотр на пользователя (`signal_views`)
- Лайк toggle (`signal_likes`)
- Счётчики на карточке, `liked_by_me`
- Скрин открывается **lightbox** внутри приложения

---

## Hash Hedge трекер

- Только для **админов** (`UserChallenge`, `TELEGRAM_ADMIN_IDS`)
- Все админ-трекеры видны всем в ленте (`PropTrackerMini`) и на вкладке Трекер
- P/L закрытых сигналов меняет `balance` трекера
- Настройки: размер счёта, этап 1–3 (`hashhedge_rules.py`)

---

## Подписка и оплата

| План | Цена | Срок |
|---|---|---|
| Неделя | $20 | 7 дней |
| Месяц | $70 | 30 дней |
| Trial | — | 3 дня при первом входе |

- Оплата: **USDT TON** по адресу `UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe` (`config.py`)
- Подтверждение по **TXID** (`payment_txs`)
- **Рефералы:** код в ссылке, бонус **+3 дня** рефереру
- Кнопка «Копировать адрес» с fallback clipboard

---

## Telegram-уведомления

Получатели: `notify_enabled=true` + активная подписка (админы всегда активны).  
Выбор через `subscription_active()` в Python (`signal_service.subscriber_ids_for_notify`).

| Событие | Содержание |
|---|---|
| Новый сигнал | Полное описание |
| Редактирование | **Список изменений** (было → стало) |
| Дополнение | Комментарий + скрин/видео |
| Вход в зоне | Позиция в работе |
| WIN / LOSE | Доходность + P/L $ |
| Удаление | Сигнал снят |

Требуется **`BOT_TOKEN`**. HTML экранируется (`telegram_notify.py`).

---

## Медиа и статика

- **`MEDIA_ROOT`** (prod: `/data/media`) — скрины/видео сигналов, дополнения, аватары
- FastAPI mount: `/media` → `StaticFiles` (`main.py`)
- Vite dev proxy: `/media` → backend `:8000` (`vite.config.ts`)
- Публичные URL: `public_url()` → `/media/{relative_path}` (`media_storage.py`)

---

## API (основное)

```
GET  /health
GET  /auth/me
GET  /signals              — полная лента (подписка / админ)
GET  /signals/preview      — только win/lose (бесплатно)
POST /signals              — админ, multipart
PUT  /signals/{id}         — админ, до входа
DELETE /signals/{id}       — админ, до входа
POST /signals/{id}/supplement — админ, после входа
POST /signals/{id}/view|like
GET  /traders/leaderboard
GET  /challenge/trackers
PUT  /challenge/settings
GET  /subscriptions/info
POST /subscriptions/pay
PUT  /subscriptions/me     — notify_enabled
```

---

## Ключевые файлы

| Область | Файлы |
|---|---|
| Модели | `backend/app/models.py` |
| БД / сессии | `backend/app/database.py` |
| Auth initData | `backend/app/telegram_auth.py`, `deps.py` |
| Аватары | `telegram_avatar.py`, `media_storage.py`, `serializers.py` |
| Сигналы API | `backend/app/routers/signals.py` |
| Логика сигналов | `backend/app/signal_service.py`, `signal_utils.py` |
| Цены / монитор | `price_service.py`, `price_monitor.py` |
| P/L и рейтинг | `trader_stats.py`, `leaderboard_service.py` |
| Трекер | `challenge_service.py`, `hashhedge_rules.py` |
| Подписка | `subscription_billing.py`, `routers/subscriptions.py` |
| Уведомления | `telegram_notify.py` |
| Миграции / purge | `migrate.py`, `data_cleanup.py` |
| Frontend shell | `frontend/src/App.tsx` |
| Лента | `FeedTab.tsx`, `SignalCard.tsx`, `Avatar.tsx` |
| Модалки | `NewSignalModal.tsx`, `EditSignalModal.tsx`, `AppendSupplementModal.tsx` |
| ТОП | `LeaderboardTab.tsx`, `EquityCurve.tsx` |
| Подписка UI | `SubscriptionTab.tsx` |
| Трекер UI | `TrackerTab.tsx`, `PropTrackerMini.tsx` |
| API клиент | `frontend/src/api.ts` |
| Утилиты UI | `frontend/src/utils.ts`, `frontend/src/utils/signalActions.ts` |

---

## Env / деплой

```env
BOT_TOKEN=...
TELEGRAM_ADMIN_IDS=123456789,...
DATABASE_URL=sqlite:////data/signals.db
MEDIA_ROOT=/data/media
CORS_ORIGINS=...
PRICE_CHECK_INTERVAL_SECONDS=60
USDT_TON_ADDRESS=UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe
```

Деплой: `git push origin main` → Amvera пересобирает Docker (`Dockerfile`, `amvera.yml`).

Локально: см. `README.md`.

---

## Одноразовые миграции (маркеры на диске)

- `.purged_test_v2` — первый purge тестовых данных
- `.purged_reset_v3` — удаление всех сигналов + обнуление рейтинга (трекеры не трогает)

Функции: `backend/app/data_cleanup.py`, вызов из `migrate.py`.

---

## История доработок

1. Редактирование активных сигналов, уведомления, просмотры/лайки, ТОП, трекеры админов, P/L
2. Только админ-трекеры, purge тестов, дневная статистика ТОП, оптимизация
3. Lightbox скринов, PropTrackerMini в ленте, подписка USDT TON, рефералы, «Сумма входа %»
4. Кнопка + в шапке; edit/delete только до входа; дополнения к сигналу
5. Плечо=1, трекер из баланса, P/L от % движения цены, equity curve в ТОП
6. Purge сигналов + обнуление рейтинга
7. Автовход если цена уже прошла уровень; sync при загрузке ленты; 3 источника цен
8. Починка уведомлений + diff при редактировании
9. Профиль админа на карточках: имя, @username, аватар; `photo_url` из initData; commit в `get_db()`; fallback инициалов в `Avatar.tsx`

---

## Быстрое напоминание для AI

> **prop-signals-miniapp** — FastAPI + React Telegram Mini App на Amvera. Админы публикуют сигналы, подписчики смотрят ленту. На карточках — имя, @username и аватар автора. Hash Hedge трекеры, ТОП с equity curve, подписка USDT TON. P/L = (трекер × сумма входа %) × % движения цены. LONG: вход срабатывает если рынок ≤ уровня. Edit/delete до входа, дополнения после. Уведомления в Telegram с diff при редактировании. Аватары: `photo_url` из initData → `/data/media/avatars/`. Полный контекст — этот файл.
