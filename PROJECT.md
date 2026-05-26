# Prop Signals Mini App — контекст проекта

Документ для напоминания контекста в новых сессиях с AI.  
Вставь в начало чата: *«Продолжаем prop-signals-miniapp, контекст в PROJECT.md»*

---

## Общее

| Параметр | Значение |
|---|---|
| **Репозиторий** | `laqosta13/prop-signals-miniapp` |
| **Путь локально** | `~/prop-signals-miniapp` |
| **Стек** | FastAPI + SQLite + React/Vite + Telegram Mini App |
| **Деплой** | Docker → Amvera Cloud, постоянный диск `/data` |
| **Брендинг** | PROP-DESK · Hash Hedge |
| **Прод (Amvera)** | тариф **Стандартный**, 1 реплика — достаточно для ~2–3k заходов на публикацию сигнала |

**Суть:** Telegram Mini App с лентой торговых сигналов. Публикуют только **админы** (`TELEGRAM_ADMIN_IDS`). **Активные** сигналы — по подписке; **отработанные** (win/lose), трекер и ТОП — **бесплатно** для всех авторизованных пользователей.

---

## Вкладки приложения

1. **Лента** — сигналы, просмотры/лайки, мини-трекеры админов, галочка уведомлений
2. **Трекер** — Hash Hedge challenge для каждого админа + таблица правил по этапам
3. **ТОП** — рейтинг трейдеров, equity curve, **описание рангов** (раскрывающийся блок)
4. **Отзывы** — оценка 1–5 и текст; один отзыв на пользователя
5. **Новости** — публикации админов; чтение для всех
6. **Подписка** — оплата USDT TON, рефералы, trial

**Lazy-load:** вкладки Трекер, ТОП, Отзывы, Новости, Подписка подгружаются через `React.lazy`.

---

## Роли

- **Админ** — публикует сигналы, **редактирует/удаляет/дополняет только свои**, свой трекер, доступ без подписки
- **Подписчик** — активные сигналы при подписке (trial 3 дня) + уведомления в Telegram
- **Без подписки** — win/lose в ленте, трекер, ТОП, лайки/просмотры на отработанных сигналах

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
| Отзывы / Новости (чтение) | ✓ | ✓ |
| Отзывы (запись) | ✗ (платная + 3 дня) | ✓ |
| Уведомления в Telegram | ✗ (кроме trial/оплаты) | ✓ |

Frontend: без подписки — `fetchSignalsPreview()`, с подпиской — `fetchSignals()`.  
**Bootstrap:** `fetchMe` + сигналы сразу; трекеры — при первом заходе на Лента/Трекер.  
**Polling:** на вкладке Лента раз в **60 с** только `refreshSignalsOnly()` (не полный reload).

---

## Сигналы — поля и UI

- **Инструмент**, **LONG/SHORT**
- **Вход / Стоп / Цель**
- **Плечо** (по умолчанию **1**)
- **Сумма входа %** — доля от баланса трекера; **при смене плеча пересчитывается пропорционально** (`frontend/src/utils/signalForm.ts`)
- **Трекер $** — только чтение, баланс Hash Hedge трекера админа
- **Скрин / Видео / Комментарий** (на русском)
- **Рынок при публикации** — `published_market_price` + `published_market_source` на карточке

**Кнопка «+» новый сигнал** — **FAB снизу** на вкладке Лента (`fab-bottom`).  
**Кнопка «+» новость** — **FAB сверху** на вкладке Новости (`fab-top`).

**Кнопка «Дополнить сигнал»** — компактная pill по центру (фиолетовый градиент, тонкая рамка).

**Автор на карточке:** имя, `@username`, аватар слева.

**Загрузка медиа:** прогресс-бар (XHR), лимит видео **100 MB**, таймаут до 10 мин. Дополнения — тоже через XHR (не `fetch`, иначе «Load failed» в Telegram WebKit).

---

## Статусы сигнала

| Статус | Условие | UI |
|---|---|---|
| Ожидание входа | `active`, вход не сработал | waiting |
| Активен (в сделке) | `entry_filled_at` есть | цвет **#E0AFFF** |
| Цель достигнута | `win` | green |
| Стоп | `lose` | red |

---

## Логика входа и цены

### Лимитный вход

`entry_triggered()` в `backend/app/signal_utils.py`:

- **LONG**: рынок **≤** уровня входа → вход сработал
- **SHORT**: рынок **≥** уровня входа → вход сработал

### Источники цен (6 котировок параллельно)

`backend/app/price_service.py`:

| Биржа | Spot | Бессрочные |
|---|---|---|
| Binance | ✓ | ✓ (fapi) |
| Bybit | ✓ | ✓ (linear) |
| BingX | ✓ | ✓ (swap) |

**Правило:** вход и закрытие (win/lose) — по **первой бирже**, где цена достигла уровня в цикле мониторинга.  
Если одновременно стоп и цель на разных биржах — **стоп важнее**.

### Публикация сигнала

`stamp_signal_at_publication()` в `signal_service.py`:

1. Запрос цен с бирж
2. **`created_at`** = момент публикации (после медиа)
3. Сохранение **`published_market_price`** / **`published_market_source`**
4. Если вход уже достигнут — сразу `entry_filled_at`

### Мониторинг

- Фоновый цикл каждые **`PRICE_CHECK_INTERVAL_SECONDS`** (по умолчанию 60)
- **Не** вызывается `sync_pending_entry_fills` / `sync_admin_avatars` на каждый `GET /signals` (только price monitor + publish/edit)

---

## Правила редактирования / удаления / дополнения

| Действие | Когда доступно |
|---|---|
| **Изменить / Удалить** | Только **свои** сигналы, до срабатывания входа |
| **Дополнить сигнал** | Только **свои**, после входа — комментарий, скрин, видео |

Backend: `require_signal_owner()` — 403 если не автор.

Frontend: `frontend/src/utils/signalActions.ts`.

---

## P/L, трекер и рейтинг

**Номинал позиции** = `трекер × сумма входа % / 100`  
**P/L $** = номинал × **% движения цены** (вход → выход) / 100  
**Рейтинг** = сумма **% движения цены** по сделкам.

Логика: `trader_stats.py`, `leaderboard_service.py`.  
ТОП: equity curve (`EquityCurve.tsx`), daily stats **14 дней** (не 30), без скачивания аватаров на каждый запрос.

---

## Система рангов

8 уровней: `rank_constants.py`, `rank_service.py`, `rank_scheduler.py` (понедельник).

- Поля в `traders`, API `/traders/me/rank-pending`, `/confirm`, `/shield`
- UI: `RankBadge`, `RankConfirmModal`, `TraderProfileModal`, `RankGuide` под списком в ТОП
- В списке ТОП **без** полной `rank_history` (полная — в профиле)

---

## Просмотры и лайки

- Просмотр записывается через **IntersectionObserver** (когда карточка в зоне видимости), не при каждом mount
- Лайк toggle на видимых сигналах
- Lightbox для скринов

---

## Hash Hedge трекер

- Только **админы** (`UserChallenge`)
- Все трекеры видны в ленте (`PropTrackerMini`) и на вкладке Трекер
- **Таблица правил** по этапам 1–3: `HashHedgeRulesTable.tsx`, данные **статически** в `frontend/src/data/hashhedgeRules.ts` (без лишнего API)
- Backend: `hashhedge_rules.py`, `GET /challenge/rules` (опционально)
- P/L закрытых сигналов меняет `balance` трекера

---

## Подписка и оплата

| План | Цена | Срок |
|---|---|---|
| Неделя | $20 | 7 дней |
| Месяц | $70 | 30 дней |
| Trial | — | 3 дня при первом входе |

- USDT TON: `UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe`
- Подтверждение по **TXID** (`payment_txs`) — **без проверки в блокчейне** (слабое место безопасности/фрода)
- Рефералы: **+3 дня** рефереру

---

## Telegram-уведомления

| Событие | Содержание |
|---|---|
| Новый сигнал | Описание + **рынок при публикации** |
| Редактирование | Diff + **кто изменил** (`format_actor_label`) |
| Дополнение | Комментарий/медиа + **кто дополнил** |
| Удаление | **Кто удалил** |
| Вход в зоне | Позиция в работе |
| WIN / LOSE | Доходность + P/L $ |

Новости: `notify_news_enabled` только для **платной** подписки (`subscriber_ids_for_news_notify`).

---

## Производительность (важно помнить)

| Что | Как |
|---|---|
| Лента API | Батч-сериализация `feed_serializers.py`, лимит **80** сигналов |
| GZip | JSON-ответы >800 байт |
| Polling | Только сигналы, 60 с, только на вкладке Лента |
| Трекеры | Lazy fetch при первом открытии Лента/Трекер |
| Вкладки | Code-splitting (`React.lazy`, chunks vendor/telegram) |
| Просмотры | IntersectionObserver, не N POST при загрузке ленты |

---

## Безопасность (кратко)

| Риск | Мера |
|---|---|
| Подделка пользователя | `X-Telegram-Init-Data` + `BOT_TOKEN` на проде (**обязательно**) |
| Админ | Только ID из `TELEGRAM_ADMIN_IDS` |
| Dev bypass | Только без `BOT_TOKEN` локально — **никогда на проде** |
| Секреты | Только env Amvera, не в Git (`.gitignore`) |
| Публичный Git | Код виден; сервер защищён токеном, не репозиторием |
| Оплата TXID | Принимается без on-chain проверки — доработать при росте |

---

## Медиа и статика

- **`MEDIA_ROOT`** (prod: `/data/media`) — скрины/видео, дополнения, аватары
- Mount `/media` → `StaticFiles`
- Vite dev: proxy `/api` и `/media` → `:8000`

---

## API (основное)

```
GET  /health
GET  /auth/me
GET  /signals                    — require_active_subscription, batch read, limit 80
GET  /signals/preview            — win/lose only
POST /signals                    — require_admin → stamp_signal_at_publication
PUT  /signals/{id}               — require_admin + owner
DELETE /signals/{id}             — require_admin + owner
POST /signals/{id}/supplement    — require_admin + owner (multipart, XHR на фронте)
POST /signals/{id}/view|like     — engagement rules
GET  /reviews | POST/PUT/DELETE /reviews
GET  /news | POST/PUT/DELETE /news
GET  /traders/leaderboard
GET  /traders/{id}/rank
GET  /traders/me/rank-pending | POST .../confirm | POST .../shield
GET  /challenge/trackers
GET  /challenge/rules
PUT  /challenge/settings
GET  /subscriptions/info | POST /subscriptions/pay | PUT /subscriptions/me
```

---

## Ключевые файлы

| Область | Файлы |
|---|---|
| Модели | `backend/app/models.py` |
| Миграции | `backend/app/migrate.py` |
| Auth | `telegram_auth.py`, `deps.py` |
| Сигналы API | `routers/signals.py` |
| Лента (batch) | `feed_serializers.py` |
| Сигналы логика | `signal_service.py`, `signal_utils.py`, `signal_permissions.py` |
| Цены | `price_service.py`, `price_monitor.py` |
| P/L, ТОП | `trader_stats.py`, `leaderboard_service.py` |
| Ранги | `rank_service.py`, `rank_scheduler.py`, `rank_constants.py` |
| Трекер | `challenge_service.py`, `hashhedge_rules.py` |
| Уведомления | `telegram_notify.py` |
| Frontend shell | `App.tsx` |
| Лента | `FeedTab.tsx`, `SignalCard.tsx` |
| Форма сигнала | `NewSignalModal.tsx`, `EditSignalModal.tsx`, `utils/signalForm.ts` |
| Дополнения | `AppendSupplementModal.tsx` |
| Трекер UI | `TrackerTab.tsx`, `HashHedgeRulesTable.tsx`, `data/hashhedgeRules.ts` |
| ТОП | `LeaderboardTab.tsx`, `RankGuide.tsx`, `EquityCurve.tsx` |
| Upload | `api.ts` (`sendFormWithProgress`), `UploadProgressBar.tsx`, `utils/upload.ts` |
| API клиент | `frontend/src/api.ts` |

---

## Env / деплой

```env
BOT_TOKEN=...
TELEGRAM_ADMIN_IDS=123456789,...
DATABASE_URL=sqlite:////data/signals.db
MEDIA_ROOT=/data/media
PRICE_CHECK_INTERVAL_SECONDS=60
PRICE_HTTP_TIMEOUT_SECONDS=10
USDT_TON_ADDRESS=UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe
```

**Деплой в терминале:**

```bash
cd ~/prop-signals-miniapp
git add -A
git commit -m "описание изменений"
git push origin main
```

Amvera пересобирает Docker (`Dockerfile`, `amvera.yml`, диск `/data`).  
Проверка: `curl -s https://ВАШ-ДОМЕН.amvera.io/health` → `{"status":"ok"}`.

BotFather: Mini App URL = HTTPS домен Amvera.

Локально: `README.md`.

---

## Одноразовые миграции (маркеры на диске)

- `.purged_test_v2`, `.purged_reset_v3` — purge через `data_cleanup.py` / `migrate.py`

Новые колонки через `migrate.py`: `published_market_price`, `published_market_source`, rank fields и др.

---

## История доработок

1. Редактирование, уведомления, просмотры/лайки, ТОП, трекеры, P/L
2. Freemium preview, профиль админа на карточках, только свои сигналы
3. Отзывы, новости, подписка USDT TON, equity curve
4. **Система рангов** (8 уровней), RankGuide в ТОП
5. Hash Hedge таблица правил, трекер по этапам
6. **Upload progress** (XHR), автор в push (дополнил/изменил/удалил)
7. **Perf:** batch лента, gzip, lazy tabs, polling только сигналов, IntersectionObserver views
8. **Цены:** 6 бирж spot+perp, первый достигший уровень; snapshot при публикации
9. UI: кнопка «Дополнить» pill; **плечо ↔ сумма входа %** в форме

---

## Быстрое напоминание для AI

> **prop-signals-miniapp** — FastAPI + React Telegram Mini App на Amvera (SQLite, `/data`). Админы публикуют сигналы; активные — по подписке, win/lose + трекер + ТОП — бесплатно. Цены: Binance/Bybit/BingX spot+perp, вход/выход по первой бирже на уровне. При публикации — snapshot цены и `created_at`. P/L = (трекер × сумма входа %) × % движения. Edit/delete до входа, дополнения после. Уведомления с diff и автором действия. Perf: batch `/signals`, lazy tabs, poll 60s. Полный контекст — этот файл.
