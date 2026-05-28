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

1. **Лента** — сигналы, график на карточке, просмотры/лайки, мини-трекеры админов, галочка уведомлений, **одноразовая анимация WIN/LOSE** при заходе
2. **Трекер** — Hash Hedge challenge для каждого админа + таблица правил по этапам
3. **ТОП** — рейтинг трейдеров, equity curve, **описание рангов** (раскрывающийся блок)
4. **Отзывы** — оценка 1–5 и текст; один отзыв на пользователя
5. **Новости** — публикации админов; чтение для всех
6. **Подписка** — оплата USDT TON (проверка TXID в блокчейне), реферальные ссылки, trial

**Шапка:** круглая кнопка **↻** (ручное обновление ленты/трекера/ТОП в зависимости от вкладки) вместо зелёной точки статуса.

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
- **Плечо** (кнопки 1–5x, по умолчанию **1**)
- **Сумма входа %** — бегунок 0–25–50–75–100; **при смене плеча сбрасывается на 10%** (`onLeveragePick` в `signalForm.ts`)
- **Номинал позиции** = трекер × сумма входа % × плечо / 100 — в форме **выделен цветом** (сумма зелёным, % и плечо фиолетовым)
- **Трекер $** — только чтение, баланс Hash Hedge трекера админа
- **Скрин / Видео / Комментарий** (на русском)
- **График на карточке** — `SignalChart.tsx`: свечи **Bybit USDT perpetual (linear)** 1m / 5m / 15m, линии входа / стопа / целей (`lightweight-charts` **v4**, `addCandlestickSeries`); lazy-load в viewport; TradingView `BYBIT:…` ↗; фон как у карточки, **без сетки**; **`z-index` ниже нижней панели** (график не перекрывает вкладки)
- **График после win/lose** — `frozen`: свечи грузятся **один раз**, таймфреймы **скрыты**, график обрезается на свече `closed_at`, повторных запросов нет
- **Вход на графике** — вертикальная линия + маркер «Вход» после срабатывания входа; линия ставится на **последнюю свечу** текущего графика (приглушённый цвет)
- **Рынок при публикации** — `published_market_price` / `published_market_source` (`bybit_perp`) в БД и **Telegram**; на карточке — график, не текст

**Кнопка «+» новый сигнал** — **FAB снизу** на вкладке Лента (`fab-bottom`).  
При открытии формы: **`GET /signals/market-price`** → курс **Bybit perp**, стоп/цель **±1%**; смена LONG/SHORT пересчитывает уровни (`utils/signalLevels.ts`).

**Кнопка «+» новость** — **FAB сверху** на вкладке Новости (`fab-top`).

**«Дополнить» и «Закрыть по рынку»** — в **один ряд** (`signal-admin-actions`), отступ до блока лайков; только **свои** сигналы после входа; закрытие → `POST /signals/{id}/close-market`.

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

### Источник цен — Bybit perpetual

`backend/app/price_service.py`:

- Крипто USDT: только **`bybit_perp`** (Bybit v5 `category=linear`)
- Форекс / золото: Frankfurter / gold-api (как раньше)
- Мониторинг входа, win/lose, публикация, `GET /signals/market-price` — одна котировка Bybit
- На фронте график: публичный API `GET /v5/market/kline?category=linear` (без бэкенда)

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
| **Закрыть по рынку** | Только **свои**, после входа (`signal_in_trade`) — ручное закрытие по текущей цене с бирж |

Backend: `require_signal_owner()` — 403 если не автор.

Frontend: `frontend/src/utils/signalActions.ts`.

---

## P/L, трекер и рейтинг

**Номинал позиции** = `трекер × сумма входа % × плечо / 100`  
**P/L $** = номинал × **% движения цены** (вход → выход) / 100  
**Рейтинг (ТОП)** = сумма **чистого % движения цены** по сделкам (**без плеча**).

**Закрытие по рынку:** P/L и win/lose по фактическому движению вход→рыночная цена; в Telegram — «ЗАКРЫТ ПО РЫНКУ».

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

## WIN / LOSE reveal (лента)

- При заходе на **Ленту** — полноэкранная анимация по **последнему** win/lose, который пользователь ещё не видел
- **Только сигналы, закрытые после `member_since`** (`subscribers.created_at` из `/auth/me`) — новому подписчику **не** показывается история до регистрации
- Уже показанные — `localStorage` per user (`outcomeRevealStorage.ts`); при новом закрытии (poll 60 с) анимация снова может появиться
- Звуки: `outcomeSounds.ts` (Web Audio)

---

## Hash Hedge трекер

- Только **админы** (`UserChallenge`)
- Все трекеры видны в ленте (`PropTrackerMini`) и на вкладке Трекер
- **Таблица правил** по этапам 1–3: `HashHedgeRulesTable.tsx`, данные **статически** в `frontend/src/data/hashhedgeRules.ts` (без лишнего API)
- Backend: `hashhedge_rules.py`, `GET /challenge/rules` (опционально)
- P/L закрытых сигналов меняет `balance` трекера
- Внизу блока правил: **«Лимит дня для всех трейдеров»** — фиксированный общий лимит **5%** (без бегунка), шкала убывает при минусах

---

## Подписка и оплата

| План | Цена | Срок |
|---|---|---|
| Неделя | $20 | 7 дней |
| Месяц | $70 | 30 дней |
| Trial | — | 3 дня при первом входе |

- USDT TON (jetton): `USDT_TON_ADDRESS` в env
- **TXID** проверяется **on-chain** через Toncenter (`ton_payments.py`): USDT jetton, сумма ≥ плана, подтверждения; дубликаты TXID отклоняются (`subscription_billing.py` → `record_payment`)
- Опционально: `TONCENTER_API_KEY`, `TONCENTER_API_BASE`
- UI: `SubscriptionTab.tsx` — копирование кошелька, ввод TXID, обновление по `refreshKey` из шапки
- **Рефералы:** `referral_code`; ссылка `startapp`; **+3 дня рефереру после первой оплаты** приглашённого (неделя или месяц), не при регистрации
- В блоке рефералов: оставлены кнопки **«Пригласить друга»** и **«Копировать ссылку»**; `Переслать` и подсказки-шаги убраны

---

## Время и зона

- Время в UI нормализовано в **МСК** (`Europe/Moscow`)
- Форматирование дат/времени и расчёт дневных границ (для общего лимита дня) выполняются по МСК
- В подписке срок отображается с подписью **«МСК»**

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
| Закрыт по рынку | 📤 «ЗАКРЫТ ПО РЫНКУ» + движение и P/L |

Новости: push **всем** зарегистрированным пользователям mini app при публикации — подписка и оплата не проверяются; галочка на вкладке «Новости» — для UI (рассылка идёт всем в БД)

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
| Нижняя панель | `z-index: 200`; график `z-index: 0` + `isolation` |

---

## Дизайн-система (актуально)

- Единый стиль **glassmorphism**: полупрозрачные карточки/модалки/кнопки, blur, мягкие тени
- Нижнее меню: вместо эмодзи используются SVG-иконки (современный iOS-like стиль)
- Полиш взаимодействий: active/focus состояния, мягкие микро-анимации, поддержка `prefers-reduced-motion`
- ТОП: процент рейтинга окрашивается по знаку (**плюс зелёный**, **минус красный**); кривая доходности — вверх зелёная, вниз красная

---

## Очистка опубликованного контента

`data_cleanup.py` → `purge_all_published_content()`:

- Удаляет **сигналы**, **новости**, **отзывы** + медиа; сброс ТОП и трекеров админов ($10k)
- **Не** трогает подписчиков, trial, `payment_txs`

| Способ | Как |
|---|---|
| Одноразово при деплое | маркер `/data/.purged_all_published_may2026` в `migrate.py` |
| Вручную (админ) | `POST /admin/purge-published` |
| Скрипт на сервере | `python backend/scripts/purge_published.py` |

---

## Безопасность (кратко)

| Риск | Мера |
|---|---|
| Подделка пользователя | `X-Telegram-Init-Data` + `BOT_TOKEN` на проде (**обязательно**) |
| Админ | Только ID из `TELEGRAM_ADMIN_IDS` |
| Dev bypass | Только без `BOT_TOKEN` локально — **никогда на проде** |
| Секреты | Только env Amvera, не в Git (`.gitignore`) |
| Публичный Git | Код виден; сервер защищён токеном, не репозиторием |
| Оплата TXID | On-chain через Toncenter; лимит API / подделка initData — следить при росте |

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
GET  /signals/market-price       — require_admin, курс для формы нового сигнала
POST /signals                    — require_admin → stamp_signal_at_publication
PUT  /signals/{id}               — require_admin + owner
DELETE /signals/{id}             — require_admin + owner
POST /signals/{id}/supplement    — require_admin + owner (multipart, XHR на фронте)
POST /signals/{id}/close-market  — require_admin + owner, после входа
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
POST /admin/purge-published      — require_admin, полная очистка ленты/новостей/отзывов
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
| Очистка данных | `data_cleanup.py`, `routers/admin.py`, `scripts/purge_published.py` |
| P/L, ТОП | `trader_stats.py`, `leaderboard_service.py` |
| Ранги | `rank_service.py`, `rank_scheduler.py`, `rank_constants.py` |
| Трекер | `challenge_service.py`, `hashhedge_rules.py` |
| Уведомления | `telegram_notify.py` |
| Frontend shell | `App.tsx` |
| Лента | `FeedTab.tsx`, `SignalCard.tsx`, `SignalChart.tsx`, `utils/signalChartLevels.ts` |
| WIN/LOSE reveal | `OutcomeReveal.tsx`, `hooks/useOutcomeReveal.ts`, `utils/outcomeRevealStorage.ts`, `utils/outcomeSounds.ts` |
| Подписка / рефералы | `SubscriptionTab.tsx`, `subscription_billing.py`, `ton_payments.py`, `referral_links.py`, `utils/referralShare.ts` |
| Форма сигнала | `NewSignalModal.tsx`, `EditSignalModal.tsx`, `utils/signalForm.ts`, `utils/signalLevels.ts` |
| Права на сигнал | `utils/signalActions.ts` (`canCloseAtMarketSignal`, …) |
| Дополнения | `AppendSupplementModal.tsx` |
| Трекер UI | `TrackerTab.tsx`, `HashHedgeRulesTable.tsx`, `data/hashhedgeRules.ts` |
| ТОП | `LeaderboardTab.tsx`, `RankGuide.tsx`, `EquityCurve.tsx` |
| Upload | `api.ts` (`sendFormWithProgress`), `UploadProgressBar.tsx`, `utils/upload.ts` |
| API клиент | `frontend/src/api.ts` |

---

## Env / деплой

```env
BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=PropDeskBot   # для реферальных startapp-ссылок
TELEGRAM_ADMIN_IDS=123456789,...
DATABASE_URL=sqlite:////data/signals.db
MEDIA_ROOT=/data/media
PRICE_CHECK_INTERVAL_SECONDS=60
PRICE_HTTP_TIMEOUT_SECONDS=10
USDT_TON_ADDRESS=UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe
TONCENTER_API_KEY=          # опционально, выше лимиты Toncenter
TONCENTER_API_BASE=https://toncenter.com/api/v2
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

- `.purged_test_v2`, `.purged_reset_v3`, `.purged_all_published_may2026` — purge через `data_cleanup.py` / `migrate.py`

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
8. **Цены:** snapshot при публикации (сейчас только **Bybit perp**)
9. UI: кнопка «Дополнить» pill; **плечо + бегунок суммы входа %**; номинал с плечом
10. **Форма нового сигнала:** автозаполнение курса, стоп/цель ±1%, подсветка номинала
11. **Закрыть по рынку** — ручное закрытие активного сигнала после входа
12. **USDT TON on-chain** — проверка TXID через Toncenter; обновлён UI подписки
13. **Реферальная программа** — `startapp`-ссылки, share/copy в Mini App
14. **WIN/LOSE reveal** — одноразовая анимация на ленте, localStorage
15. **График на карточке** — Bybit klines, уровни, `lightweight-charts` v4; UI: ряд админ-кнопок, z-index ленты
16. **Кнопка ↻** в шапке — ручной refresh вкладки
17. **Purge published** — сигналы + новости + отзывы; API `/admin/purge-published`
18. **Только Bybit perp** — мониторинг и график; график **frozen** после win/lose
19. **Точный UI-апдейт ТОП** — цвет рейтинга по знаку (green/red), сохранён цвет кривой доходности по направлению
20. **График входа/закрытия** — вход отмечается линией/маркером на последней свече после входа; закрытый график обрезается по `closed_at`, таймфреймы скрыты
21. **MSK everywhere** — единая зона времени Europe/Moscow + MSK-день для лимита
22. **UI refresh** — glass дизайн + SVG-иконки в nav, обновлённые состояния контролов/форм

---

## Быстрое напоминание для AI

> **prop-signals-miniapp** — FastAPI + React Telegram Mini App на Amvera (SQLite, `/data`). Админы публикуют сигналы; активные — по подписке, win/lose + трекер + ТОП — бесплатно. **Цены и график: Bybit USDT perp (linear).** После win/lose график не обновляется. На карточке — график + уровни; snapshot в Telegram. P/L = (трекер × сумма входа % × плечо) × % движения; ТОП — без плеча. Дополнить/закрыть по рынку — один ряд. Оплата: USDT + Toncenter. Рефералы +3 дня. WIN/LOSE reveal. Purge: `POST /admin/purge-published`. Perf: batch `/signals`, lazy tabs, poll 60s, bottom nav поверх графика. Полный контекст — этот файл.
