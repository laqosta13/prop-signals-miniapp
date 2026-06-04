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
| **Брендинг** | **Volnovoi Cult** · Marketplace крипто-сделок (`appCopy.ts`); трекер/проп — **Hash Hedge** |
| **Прод (Amvera)** | тариф **Стандартный**, 1 реплика — достаточно для ~2–3k заходов на публикацию сигнала |

**Суть:** Telegram Mini App с лентой торговых сигналов. Публикуют только **админы** (`TELEGRAM_ADMIN_IDS`). **Активные** сигналы — по подписке; **отработанные** (win/lose), трекер и ТОП — **бесплатно** для всех авторизованных пользователей.

---

## Вкладки приложения

1. **Лента** — шапка **Marketplace крипто-сделок** (без заголовка «Сигналы»); сигналы **#N**, график на карточке, просмотры/лайки, мини-трекеры админов, переключатель **«Уведомления в Telegram»** (`NotifySettingsPanel`), **дисклеймер** (кнопка **!** + принятие при первом заходе), **анимация WIN/LOSE** при **живом** закрытии
2. **Трекер** — Hash Hedge challenge для каждого админа + таблица правил по этапам
3. **ТОП** — **volnovoi** + копирование Bybit; **RankGuide**; **ТРЕЙДЕРЫ CULT**; **КОНДИДАТЫ В CULT** — админы + **Telegram-каналы** (аналитика % с момента подключения)
4. **Отзывы** — оценка 1–5 и текст; один отзыв на пользователя
5. **Новости** — публикации админов; чтение для всех
6. **Подписка** — оплата USDT TON (проверка TXID в блокчейне), реферальные ссылки, trial, **чат поддержки** (`SubscriptionSupportChat` → `POST /support/messages`)

**Шапка:** круглая кнопка **↻** — по вкладке: **Лента/Трекер** — полная перезагрузка сигналов (`refreshSignalsFull`) + `feedRefreshKey` (ремонт графиков), трекеры, `fetchMe`; **ТОП** — рейтинг + me; **Новости/Отзывы/Подписка** — `refreshKey` вкладки + me. Фоновый poll **15 с** — только лёгкий `refreshSignalsOnly()` (без remount графиков).

**Вкладки:** **Лента** (`FeedTab`) — в основном бандле; остальные вкладки и тяжёлые модалки — `React.lazy` + `Suspense`.

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
| **Копирование volnovoi на Bybit** | ✓ настройка API (без подписки на ленту) | ✓ авто-сделки; **оплата 20% прибыли** отдельно |
| Лайки / просмотры (win/lose) | ✓ | ✓ |
| Лайки / просмотры (active) | ✗ | ✓ |
| Отзывы / Новости (чтение) | ✓ | ✓ |
| Отзывы (запись) | ✗ (платная + 3 дня) | ✓ |
| Уведомления в Telegram | ✗ (кроме trial/оплаты) | ✓ |

Frontend: без подписки — `fetchSignalsPreview()`, с подпиской — `fetchSignals()`.  
**Bootstrap:** `fetchMe` + сигналы сразу; трекеры — при первом заходе на Лента/Трекер.  
**Polling:** раз в **15 с** по всему приложению — `refreshSignalsOnly()` (не полный reload); нужно для живого WIN/LOSE reveal и актуальной ленты.

---

## Сигналы — поля и UI

- **Номер #N** — сквозная нумерация по порядку публикации (`signals.number`); на карточке, в трекере, модалках, WIN/LOSE и Telegram; после полного purge снова с **#1**
- **Инструмент**, **LONG/SHORT**
- **Вход / Стоп / Цель**
- **Плечо** (кнопки 1–5x, по умолчанию **1**; **макс. по рангу** — `rank_max_leverage` из `GET /challenge/my-tracker`)
- **Сумма входа %** — бегунок 0–25–50–75–100; **при смене плеча сбрасывается на 10%** (`onLeveragePick` в `signalForm.ts`)
- **Номинал позиции** = трекер × сумма входа % × плечо / 100 — в форме **выделен цветом** (сумма зелёным, % и плечо фиолетовым)
- **Трекер $** — только чтение, **баланс Hash Hedge**; при открытии формы подгружается **`GET /challenge/my-tracker`** (`useAdminTrackerSnapshot`)
- **Дополнения** на карточке — отдельный блок с фиолетовым акцентом, бейдж «Доп. N», счётчик дополнений
- **Скрин / Видео / Комментарий** (на русском)
- **График на карточке** — `SignalChart.tsx` + палитра **`chartTheme.ts`** / `subscribeTheme()` (светлая и тёмная тема): свечи **Bybit USDT perpetual (linear)** 1m / 5m / 15m, линии входа / стопа / целей (`lightweight-charts` **v4**); **~220 видимых баров**, высота **268px**, скругление **12px**; lazy-load в viewport; TradingView `BYBIT:…` ↗; **`z-index` ниже нижней панели**
- **Ожидание лимитного входа** — серая линия с подписью **«Лимитка»** (цена на оси Y, без цены в title); после входа — **«Вход»** как раньше
- **График после win/lose** — `frozen`: свечи грузятся **один раз**, таймфреймы **скрыты**, график обрезается на свече `closed_at`, повторных запросов нет
- **Закрытие на графике** (только frozen): **точка** на свече `closed_at`, **вертикальная линия**, бейдж **«Стоп»** / **«Цель»** / **«По рынку»** (цвет: красный / фиолетовый / жёлтый); поля `close_reason`, `closed_exit_price` в БД
- **Активный график** — свечи обновляются каждые **30 с** (`CHART_POLL_MS`), пока сигнал не закрыт
- **Вход на графике** — вертикальная линия + маркер «Вход» после срабатывания входа; маркер **привязан к свече `entry_filled_at`** (не к последней свече)
- **Рынок при публикации** — `published_market_price` / `published_market_source` (`bybit_perp`) в БД и **Telegram**; на карточке — график, не текст

**Кнопка «+» новый сигнал** — **FAB снизу** на вкладке Лента (`fab-bottom`). Перед публикацией — **`confirmAction`** (подтверждение в WebView).  
При открытии формы: **`GET /signals/market-price`** → курс **Bybit perp**, стоп/цель **R:R 1:3**; **`GET /challenge/my-tracker`** — баланс, дневные потери, счётчик сделок за MSK-день.

**Дневной лимит трейдера в форме** (`daily_stop_limit.py`, `utils/dailyStopLimit.ts`):

| Параметр | Значение |
|---|---|
| Условие | **3 сделки или 2% стопа** за MSK-день — что наступит **раньше**, торговля блокируется |
| Сделки | Считаются **опубликованные** сигналы автора за сегодня (MSK) |
| Стоп | **Заморозка** на активных (стоп в форме × плечо); **списание** — стоп по уровню (как в форме) или **убыток по рынку** (фактический % вход→выход × плечо); win по рынку / цель — не списывают |
| Бегунок стопа | **% счёта** (не % цены): шкала **0 → остаток** на **весь трек**; метки равномерно по остатку |
| Весь риск в одну сделку | Можно выставить **весь остаток** стопа на один сигнал |
| Конвертация | риск счёта ↔ % цены: `(priceStop × stake% × leverage) / 100` |
| UI | `StopOffsetSlider.tsx`, `useDailyStopSync.ts`, `SignalLevelsFields.tsx`; остаток «N сделок · X% стопа» в `NewSignalModal` |
| Backend | `validate_signal_daily_trades` + `validate_signal_daily_stop` при `POST /signals`; `daily_trades_count` / `daily_trades_limit` в `GET /challenge/my-tracker` |
| Редактирование | Лимит **сделок** не применяется; лимит **стопа** — да |

Подсказки формы: «Цена с Bybit perp», «R:R 1:3 · лимит: 3 сделки или 2% стопа». Смена LONG/SHORT / плеча пересчитывает уровни (`utils/signalLevels.ts`, `useSignalLevelFields.ts`).

**Кнопка «+» новость** — **FAB сверху** на вкладке Новости (`fab-top`).

**«Дополнить» и «Закрыть по рынку»** — в **один ряд** (`signal-admin-actions`), отступ до блока лайков; только **свои** сигналы после входа; закрытие → `POST /signals/{id}/close-market`.

**Автор на карточке:** имя и аватар слева (без `@username` в тексте).

**Загрузка медиа:** прогресс-бар (XHR), лимит видео **100 MB**, таймаут до 10 мин. Дополнения — тоже через XHR (не `fetch`, иначе «Load failed» в Telegram WebKit).

---

## Статусы сигнала

| Статус | Условие | UI |
|---|---|---|
| Ожидание входа | `active`, вход не сработал | waiting |
| Активен (в сделке) | `entry_filled_at` есть | цвет **#E0AFFF** |
| Цель достигнута | `win` | green |
| Стоп | `lose` | red |

**Причина закрытия** (`close_reason`): `target` (монитор / win), `stop` (монитор / lose), `market` (ручное «Закрыть по рынку»). Старые сигналы: win→target, lose→stop (миграция).

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
- **Закрытие по стопу/цели:** котировка только **детектирует** касание; `closed_exit_price` = **ровно уровень** стопа или первой цели (`monitor_exit_price` в `price_monitor.py`) — без проскальзывания, если цена уже ушла дальше между опросами
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
- При срабатывании **входа** и **закрытии** сигнала — параллельно **`open_signal_copies` / `close_signal_copies`** для подписчиков с API Bybit (`copy_trading_service.py`)

---

## volnovoi — сводный портфель ТОП

- **`VOLNOVOI_TELEGRAM_ID = 0`**, отображение **`volnovoi`**, флаг **`is_aggregate: true`**
- Первая секция **«ТРЕЙДЕРЫ CULT»**: все **закрытые** сигналы **всех админов** в одном портфеле (рейтинг %, P/L $, W/L, WR, equity curve)
- Подпись карточки: **«Копирует · все сделки трейдеров»** (не «Аккаунт»)
- Backend: `volnovoi_account.py`, prepend в `build_leaderboard()`; `GET /traders/0/rank` — вычисленный ранг
- UI: карточка `top-card--aggregate`, символ **∑**; клик по **шапке** открывает профиль; **график и «Дни · N»** — отдельно (не открывают профиль)
- Профиль volnovoi: сводная статистика; **кнопка «Страховка»** — активирует **ваш** rank shield (если ещё не использован в месяце); без confirm ранга
- На карточке volnovoi — та же **«Страховка»** под графиком (для своего ранга)

---

## Копирование сигналов на Bybit (volnovoi)

Подписчик сохраняет **свои** API-ключи Bybit — сделки volnovoi копируются на **его** счёт USDT perpetual (linear). **Не требует подписки на ленту** — отдельная оплата за копирование.

| Параметр | Значение |
|---|---|
| UI | `VolnovoiCopyPanel.tsx` — под карточкой **volnovoi** на вкладке ТОП (раскрывающийся блок) |
| Доступ | Любой авторизованный пользователь — `GET/PUT /copy-trading/me` |
| Биржа | Bybit v5, **USDT perp**; forex/золото пропускаются |
| Вход | Market при `entry_filled_at` (монитор / публикация) |
| Выход | Reduce-only market при закрытии сигнала; SL/TP на позиции через `trading-stop` |
| Размер | `account_balance_usd × stake_percent × leverage_сигнала / 100` (депозит и % задаёт пользователь) |
| Ключи | Шифрование Fernet (`credentials_crypto.py`); ключ = `EXCHANGE_SECRETS_KEY` или `BOT_TOKEN`; права API — только **Trade** |
| Testnet | По умолчанию **true** в форме; переключатель в UI |

### Оплата копирования (отдельно от подписки)

| Параметр | Значение |
|---|---|
| Комиссия | **20%** от **прибыли** на Bybit с момента подключения (`equity_baseline_usd`) |
| Счёт | Раз в сутки (**00:00 UTC**), если выросла неоплаченная прибыль — `copy_billing_scheduler.py` |
| Оплата | USDT TON + **TXID** on-chain (тот же кошелёк, что подписка) |
| Блокировка | При неоплаченном счёте **`copy_allowed: false`** — новые копии не открываются |
| Админы | Счета и блокировка **не применяются** |

**Таблицы:** `user_bybit_settings` (+ `connected_at`, `equity_baseline_usd`, `billed_profit_usd`), `signal_copy_trades`, **`copy_trading_invoices`**.

**API:**

```
GET    /copy-trading/me          — статус (маска ключа, баланс, прибыль, счёт)
PUT    /copy-trading/me          — сохранить ключи
PATCH  /copy-trading/me          — enabled / testnet / депозит / stake %
POST   /copy-trading/me/test     — проверка подключения
POST   /copy-trading/me/pay      — оплата счёта (invoice_id + tx_id)
DELETE /copy-trading/me          — отключить
```

**Backend:** `bybit_trading.py`, `copy_trading_service.py`, `copy_billing.py`, `copy_billing_scheduler.py`, `routers/copy_trading.py`; хуки в `signal_service.py`, `price_monitor.py`.

**Env (опционально):** `EXCHANGE_SECRETS_KEY` — отдельный ключ шифрования (иначе `BOT_TOKEN`).

---

## Каналы-кандидаты CULT (Telegram)

Админ добавляет ссылку на публичный Telegram-канал в блок **«КОНДИДАТЫ В CULT»**. Аналитика как у трейдеров, но **только чистый %** (без $).

| Параметр | Значение |
|---|---|
| UI | `CultChannelCard.tsx`, форма `CultChannelAdminPanel.tsx` (только админ) |
| Подключение | `t.me/channel` или `@channel`; бот **админ канала** (для `channel_post` updates) |
| Старт учёта | **`connected_at`** — посты **до** подключения игнорируются (историю не парсим) |
| Парсинг поста | Тикер + LONG/SHORT + **вход + стоп + цель** (`channel_signal_parser.py`) |
| Мониторинг | Тот же price monitor (Bybit perp): вход → стоп/цель |
| Метрики | `rating_percent`, W/L, WR, equity curve и дни — **без P/L $** |
| Таблицы | `cult_channels`, `cult_channel_signals` |

**API:**

```
GET    /cult-channels           — список (все авторизованные)
POST   /cult-channels           — добавить канал (require_admin)
DELETE /cult-channels/{id}      — отключить (require_admin)
```

**Backend:** `cult_channel_service.py`, `telegram_updates.py` (polling `channel_post`), `routers/cult_channels.py`.

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

**База номинала** = **`account_size`** (размер счёта Hash Hedge), не накопленный баланс трекера.  
**Номинал позиции** = `account_size × сумма входа % × плечо / 100`  
**P/L $** = номинал × **% движения цены** (вход → выход) / 100  
**Рейтинг (ТОП)** = сумма **чистого % движения цены** по сделкам (**без плеча**).

**Win rate (WR)** и W/L в трекере и ТОП — по **фактическому P/L в $** (≥ 0 → win, < 0 → loss), не только по статусу win/lose.

**Референс входа на карточке** — как backend `effective_entry_price`: при зоне входа — **лимит** (`entry_low`/`entry_high`), иначе `published_market_price` (`chartEntryReference` в `signalChartLevels.ts` / `signalPnl.ts`).

**P/L на карточке после poll/refresh:** фронт пересчитывает exit из `closed_exit_price` или стоп/цели (`signalPnl.ts`); `mergeFeedSignals.ts` не теряет P/L при устаревшем ответе API.

**Закрытие по рынку:** P/L и win/lose по фактическому движению вход→рыночная цена; в Telegram — «ЗАКРЫТ ПО РЫНКУ».

Логика: `trader_stats.py`, `leaderboard_service.py`, `tracker_metrics.py`.  
ТОП: equity curve (`EquityCurve.tsx`) — вкладки **7д / 30д / 90д**, таблица дней **сворачивается** («Дни · N»; клик **не** открывает профиль); daily stats **90 дней** в API; без скачивания аватаров на каждый запрос.

---

## Система рангов

8 уровней: `rank_constants.py`, `rank_service.py`, `rank_scheduler.py` (понедельник).

- Поля в `traders`, API `/traders/me/rank-pending`, `/confirm`, `/shield`
- UI: `RankBadge` **в одной строке с именем** (карточка ТОП + профиль), `RankConfirmModal`, `TraderProfileModal`, `RankGuide` под volnovoi в ТОП
- **Страховка** — кнопка «Страховка» (не «Активировать…») в своём профиле и на карточке **volnovoi** для текущего пользователя
- В списке ТОП **без** полной `rank_history` (полная — в профиле кандидата)

---

## Просмотры и лайки

- Просмотр записывается через **IntersectionObserver** (когда карточка в зоне видимости), не при каждом mount
- Лайк toggle на видимых сигналах
- Lightbox для скринов

---

## Дисклеймер (лента)

- Текст в `frontend/src/data/disclaimer.ts` (мани-менеджмент, без плечей, ответственность за решения)
- **Первый заход** — модалка с принятием (`DisclaimerModal`, `disclaimerStorage.ts`)
- Кнопка **!** в шапке ленты — информационная модалка без повторного принятия
- Принятие хранится в `localStorage` per user

---

## WIN / LOSE reveal

- Полноэкранная анимация при **живом** закрытии: переход **active → win/lose** (не при первом появлении уже закрытого сигнала в ленте)
- При первом заходе `seedPlayedOutcomesForExistingFeed` помечает уже закрытые сигналы — **без** анимации на старой ленте
- **Только сигналы, закрытые после `member_since`** (`subscribers.created_at` из `/auth/me`)
- Логика в **`App.tsx`** (`useOutcomeReveal`), poll ленты **15 с** для быстрого обнаружения закрытия
- Уже показанные — `localStorage` per user (`outcomeRevealStorage.ts`)
- Звуки: `outcomeSounds.ts` (Web Audio)

---

## Hash Hedge трекер

- Только **админы** (`UserChallenge`)
- Все трекеры видны в ленте (`PropTrackerMini`) и на вкладке Трекер
- **Настройки трекера** — модалка `TrackerSettingsModal.tsx`: размер счёта, этап 1–3, **баланс с пропа**, скрин пропа («Заменить скрин»); `modal-backdrop--sheet` для клавиатуры
- **Баланс с пропа** (`apply_prop_balance_sync`) — обновляет **`balance`** везде (трекер, лента, форма сигнала); **`account_size`** = `balance − сумма P/L закрытых сигналов`; `trading_days` **не** сбрасываются. Если меняют только размер счёта (без баланса с пропа) — правится только `account_size`
- **Метрики трейдера** (`tracker_metrics.py`) — из **закрытых сигналов**, день **MSK**: **торговые дни**, **WR по P/L $**, **дневной убыток %**, **просадка** от `account_size`
- **Лимит дня в форме сигнала** — отдельно от Hash Hedge **5%**: у каждого админа **3 сделки или 2% стопа** (см. раздел «Сигналы — поля и UI»)
- **Список сделок** на вкладке Трекер — **свёрнут** по умолчанию («Сделки · N»)
- **Баланс с пропа** под скрином пропа **скрыт** в UI трекера
- **Скрин с пропа** — один актуальный на трекер (`prop_screenshot_path`); новый заменяет старый; показ на вкладке Трекер + lightbox
- `PUT /challenge/settings` — **multipart Form** (`account_size`, `stage`, `balance`, `screenshot`, `remove_screenshot`); `updateChallengeSettings()` в `api.ts`
- **Таблица правил** по этапам 1–3: `HashHedgeRulesTable.tsx`, данные **статически** в `frontend/src/data/hashhedgeRules.ts` (без лишнего API)
- Backend: `hashhedge_rules.py`, `GET /challenge/rules` (опционально); скрины — `save_tracker_screenshot` в `media_storage.py`
- P/L закрытых сигналов меняет `balance` трекера
- Внизу блока правил: **«Лимит дня для всех трейдеров»** — общий лимит **5%** по сумме убытков всех админов за MSK-день; кнопка **«Регистрация на проп»** → Hash Hedge (`HASHHEDGE_REGISTER_URL`)

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

## Telegram-бот и уведомления

**Доставка:** `telegram_notify.py` → `sendMessage` / `sendPhoto` подписчикам с `notify_enabled` и активной подпиской (`signal_service.subscriber_ids_for_notify`). Формат push — **блочный HTML**: заголовок (⚡️/✏️/…), `blockquote` с **#N · символ · LONG/SHORT**, секции *Уровни* / *Позиция* / *Трейдер*; снимок рынка при посте — только если **нет** лимитной зоны.

**Приём обновлений бота:** **long polling** (`telegram_updates.py`: `delete_webhook` при старте, `getUpdates`, offset в `/data/media/telegram_update_offset.txt`) — **не** зависит от webhook Amvera. В том же цикле: `channel_post` (CULT-каналы), `/start` и рефералы (`bot_welcome.py`), сообщения в группу поддержки (`support_chat.py`).

| Событие | Содержание |
|---|---|
| Новый сигнал | **НОВЫЙ СИГНАЛ** + уровни + позиция + автор |
| Редактирование | **ОБНОВЛЕНИЕ** + кто изменил + diff; для закрытых — P/L % и $ |
| Дополнение | **#N** + комментарий/медиа + кто дополнил |
| Удаление | **#N** + кто удалил |
| Вход в зоне | **#N** + позиция в работе |
| WIN / LOSE | итог + доходность + P/L $ |
| Закрыт по рынку | **ЗАКРЫТ ПО РЫНКУ** + движение и P/L |

**UI уведомлений:** вкладка **Лента** — toggle сигналов; **Новости** — отдельный toggle (`notify_news_enabled`). Без подсказок про `/start` в интерфейсе. `notify_push_active` в `/auth/me` = флаг «рассылка включена в настройках» (зеркало `notify_enabled`).

**Новости:** push **всем** зарегистрированным в БД при публикации админом; подписка на ленту не проверяется.

**Поддержка:** `TELEGRAM_SUPPORT_GROUP_ID` (+ `BOT_TOKEN`); UI на вкладке **Подписка**, API `routers/support.py`. На Amvera webhook бота для Mini App **не обязателен** — приложение ходит через initData, бот — через polling.

---

## Производительность (важно помнить)

| Что | Как |
|---|---|
| Лента API | Батч-сериализация `feed_serializers.py`, лимит **80** сигналов |
| GZip | JSON-ответы >800 байт |
| Polling | Только сигналы, **15 с**, по всему приложению (для WIN/LOSE reveal) |
| График active | Обновление свечей каждые **30 с** (`SignalChart.tsx`) |
| Трекеры | Lazy fetch при первом открытии Лента/Трекер |
| Вкладки | Один JS-бандл (без lazy-chunks вкладок — меньше «вечной загрузки» в WebView) |
| Просмотры | IntersectionObserver, не N POST при загрузке ленты |
| Нижняя панель | `z-index: 200`; график `z-index: 0` + `isolation` |

---

## Дизайн-система (актуально)

- **Светлая / тёмная тема** — переключатель в шапке (`ThemeToggle.tsx`, `theme.css`, `utils/theme.ts`); CSS-переменные для карточек, форм, CTA; **график сигнала** — отдельная палитра `utils/chartTheme.ts`
- Жёлтые CTA пропа / Bybit — общие токены `--prop-cta-*`; логотипы **Hash Hedge** и **Bybit** (`BrandLogos.tsx`, `public/brands/`)
- Единый стиль **glassmorphism**: полупрозрачные карточки/модалки/кнопки, blur, мягкие тени
- Нижнее меню: вместо эмодзи используются SVG-иконки (современный iOS-like стиль)
- Полиш взаимодействий: active/focus состояния, мягкие микро-анимации, поддержка `prefers-reduced-motion`
- ТОП: процент рейтинга окрашивается по знаку (**плюс зелёный**, **минус красный**); кривая доходности — вверх зелёная, вниз красная; секции **ТРЕЙДЕРЫ CULT** / **КОНДИДАТЫ В CULT**

---

## Очистка опубликованного контента

`data_cleanup.py` → `purge_all_published_content()`:

- Удаляет **сигналы** (+ copy-trades, лайки, просмотры, дополнения, в т.ч. сделки кандидатов CULT), **CULT-сигналы каналов** (каналы остаются, stats=0), **stats кандидатов CULT** (записи остаются), **новости**, **отзывы** + медиа
- Сброс ТОП (рейтинг, ранги) и трекеров админов ($10k); очистка скринов пропа
- **Не** трогает подписчиков, trial, `payment_txs`, подключённые CULT-каналы, настройки Bybit

| Способ | Как |
|---|---|
| Одноразово при деплое | маркеры `.purged_all_published_*` в `migrate.py` (актуально: `.purged_all_published_jun2026_v5`) |
| API (без UI) | `POST /admin/purge-published` — `require_admin` |
| Скрипт на сервере | `python backend/scripts/purge_published.py` |

---

## Безопасность (кратко)

| Риск | Мера |
|---|---|
| Подделка пользователя | `X-Telegram-Init-Data` + `BOT_TOKEN` на проде (**обязательно**) |
| Админ | Только ID из `TELEGRAM_ADMIN_IDS` |
| Dev bypass | Только без `BOT_TOKEN` локально — **никогда на проде** |
| Секреты | Только env Amvera, не в Git (`.gitignore`) |
| API Bybit пользователей | Шифрование Fernet; ключи **Trade** без Withdraw; testnet для тестов |
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
GET  /traders/{id}/rank          — id=0 → volnovoi
GET  /traders/me/rank-pending | POST .../confirm | POST .../shield
GET  /copy-trading/me | PUT /copy-trading/me | PATCH /copy-trading/me
POST /copy-trading/me/test | POST /copy-trading/me/pay | DELETE /copy-trading/me
GET  /cult-channels | POST /cult-channels | DELETE /cult-channels/{id}
GET  /challenge/trackers
GET  /challenge/my-tracker       — require_admin: balance, daily_loss_pct, daily_trades_count/limit
GET  /challenge/rules
PUT  /challenge/settings         — multipart: баланс с пропа / account_size, этап, скрин (require_admin)
GET  /subscriptions/info | POST /subscriptions/pay | PUT /subscriptions/me
POST /support/messages           — сообщение в группу поддержки (если настроена)
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
| Лимиты формы сигнала | `daily_stop_limit.py`, `utils/dailyStopLimit.ts`, `hooks/useDailyStopSync.ts` |
| P/L, ТОП | `trader_stats.py`, `leaderboard_service.py`, `volnovoi_account.py` |
| Copy-trading Bybit | `bybit_trading.py`, `copy_trading_service.py`, `copy_billing.py`, `copy_billing_scheduler.py`, `credentials_crypto.py`, `routers/copy_trading.py` |
| CULT каналы | `cult_channel_service.py`, `channel_signal_parser.py`, `telegram_updates.py`, `telegram_bot_api.py`, `routers/cult_channels.py` |
| Ранги | `rank_service.py`, `rank_scheduler.py`, `rank_constants.py` |
| Трекер | `challenge_service.py`, `tracker_metrics.py`, `hashhedge_rules.py` |
| Уведомления | `telegram_notify.py`, `telegram_updates.py`, `bot_welcome.py` |
| Поддержка | `support_chat.py`, `routers/support.py`, `SubscriptionSupportChat.tsx` |
| Frontend shell | `App.tsx`, `components/NotifySettingsPanel.tsx`, `data/appCopy.ts` |
| Лента | `FeedTab.tsx`, `SignalCard.tsx`, `SignalChart.tsx`, `utils/signalChartLevels.ts`, `utils/chartTheme.ts` |
| Подтверждения | `utils/confirmAction.ts` |
| Дисклеймер | `DisclaimerModal.tsx`, `data/disclaimer.ts`, `utils/disclaimerStorage.ts` |
| WIN/LOSE reveal | `OutcomeReveal.tsx`, `hooks/useOutcomeReveal.ts`, `utils/outcomeRevealStorage.ts`, `utils/outcomeSounds.ts` (логика в `App.tsx`) |
| Подписка / рефералы | `SubscriptionTab.tsx`, `subscription_billing.py`, `ton_payments.py`, `referral_links.py`, `utils/referralShare.ts` |
| Форма сигнала | `NewSignalModal.tsx`, `EditSignalModal.tsx`, `hooks/useAdminTrackerSnapshot.ts`, `SignalLevelsFields.tsx`, `StopOffsetSlider.tsx`, `hooks/useSignalLevelFields.ts`, `hooks/useDailyStopSync.ts`, `utils/signalForm.ts`, `utils/signalLevels.ts`, `utils/dailyStopLimit.ts` |
| Тема | `theme.css`, `ThemeToggle.tsx`, `utils/theme.ts` |
| Логотипы CTA | `BrandLogos.tsx`, `public/brands/` |
| P/L на ленте | `utils/signalPnl.ts`, `utils/mergeFeedSignals.ts` |
| Права на сигнал | `utils/signalActions.ts` (`canCloseAtMarketSignal`, …) |
| Дополнения | `AppendSupplementModal.tsx` |
| Трекер UI | `TrackerTab.tsx`, `TrackerSettingsModal.tsx`, `HashHedgeRulesTable.tsx`, `data/hashhedgeRules.ts` |
| ТОП | `LeaderboardTab.tsx`, `VolnovoiCopyPanel.tsx`, `CultChannelCard.tsx`, `CultChannelAdminPanel.tsx`, `TraderProfileModal.tsx`, `RankGuide.tsx`, `EquityCurve.tsx`, `utils/volnovoi.ts` |
| Upload | `api.ts` (`sendFormWithProgress`), `UploadProgressBar.tsx`, `utils/upload.ts` |
| API клиент | `frontend/src/api.ts` |

---

## Env / деплой

```env
BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=PropDeskBot   # для реферальных startapp-ссылок
TELEGRAM_ADMIN_IDS=123456789,...
TELEGRAM_SUPPORT_GROUP_ID=   # опционально; чат поддержки (-100…)
TELEGRAM_SUPPORT_USERNAME=   # опционально; ссылка в UI
DATABASE_URL=sqlite:////data/signals.db
MEDIA_ROOT=/data/media
PRICE_CHECK_INTERVAL_SECONDS=60
PRICE_HTTP_TIMEOUT_SECONDS=10
USDT_TON_ADDRESS=UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe
TONCENTER_API_KEY=          # опционально, выше лимиты Toncenter
TONCENTER_API_BASE=https://toncenter.com/api/v2
EXCHANGE_SECRETS_KEY=       # опционально; шифрование API Bybit пользователей (иначе BOT_TOKEN)
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

- `.purged_test_v2`, `.purged_reset_v3`, `.purged_all_published_may2026`, `.purged_all_published_may2026_v2`, `.purged_all_published_jun2026`, `.purged_all_published_may2026_v3`, `.purged_all_published_jun2026_v2`, `.purged_all_published_jun2026_v3`, `.purged_all_published_jun2026_v4`, **`.purged_all_published_jun2026_v5`** — purge через `data_cleanup.py` / `migrate.py`
- `.recalc_closed_signal_pnl_v2`, `.recalc_closed_signal_pnl_v3` — пересчёт P/L от `account_size` и risk_percent
- `.recalc_winrate_by_pnl_v1` — пересчёт W/L и WR по фактическому P/L ($)

Новые колонки через `migrate.py`: `published_market_price`, `published_market_source`, `prop_screenshot_path`, `number`, `close_reason`, `closed_exit_price`, `account_size`, rank fields; таблицы **`user_bybit_settings`**, **`signal_copy_trades`**, **`copy_trading_invoices`** и др.

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
16. **Кнопка ↻** в шапке — полный refresh по вкладке (`refreshSignalsFull`, `feedRefreshKey`, см. «Вкладки»)
17. **Purge published** — сигналы + новости + отзывы; API `/admin/purge-published`
18. **Только Bybit perp** — мониторинг и график; график **frozen** после win/lose
19. **Точный UI-апдейт ТОП** — цвет рейтинга по знаку (green/red), сохранён цвет кривой доходности по направлению
20. **График входа/закрытия** — вход отмечается линией/маркером на последней свече после входа; закрытый график обрезается по `closed_at`, таймфреймы скрыты
21. **MSK everywhere** — единая зона времени Europe/Moscow + MSK-день для лимита
22. **UI refresh** — glass дизайн + SVG-иконки в nav, обновлённые состояния контролов/форм
23. **Дисклеймер** — модалка при первом заходе + кнопка **!** в шапке ленты
24. **WIN/LOSE reveal v2** — только живое закрытие; seed истории; poll **15 с**; логика в `App.tsx`
25. **График** — маркер входа на свече `entry_filled_at`; poll активного графика **30 с**
26. **Форма сигнала** — R:R **1:3**, бегунок отступа стопа 0.1–5%, автокурс Bybit perp
27. **Purge jun2026** — одноразовая миграция при деплое; кнопка purge убрана из UI
28. **Настройки трекера** — модалка, скрин пропа, коррекция баланса без сброса прогресса; multipart `PUT /challenge/settings`
29. **Tab loading fix** — убран `React.lazy`; WIN/LOSE только при **active→win/lose**
30. **Метрики трекера** — торговые дни, WR, лимит дня, просадка из закрытых сигналов (MSK); `tracker_metrics.py`
31. **Нумерация сигналов** — `signals.number`, #N в UI и Telegram
32. **Маркер закрытия на графике** — точка + линия + бейдж стоп/цель/рынок; `close_reason`, `closed_exit_price`
33. **P/L от account_size** — база номинала = размер счёта, не баланс; миграции v2/v3 пересчёта
34. **UI дополнений** — выделенный блок на карточке сигнала (бейдж, счётчик, фиолетовый акцент)
35. **Авто-трекер в форме** — `GET /challenge/my-tracker`, `useAdminTrackerSnapshot` при открытии New/Edit
36. **Синхрон баланса с пропа** — `apply_prop_balance_sync`: balance + account_size согласованы с историей сделок
37. **P/L на refresh** — `signalPnl.ts` + `mergeFeedSignals.ts`; WR по P/L $; push при редактировании закрытого сигнала
38. **volnovoi** — сводный аккаунт ТОП (все админы), `is_aggregate`, daily stats 90д
39. **Equity curve** — периоды 7/30/90д; сворачиваемая таблица дней
40. **Ранг в строке имени** — `RankBadge compact` рядом с именем в ТОП и профиле
41. **Copy-trading Bybit** — API пользователя, копирование сигналов volnovoi; панель под карточкой volnovoi
42. **Copy billing** — 20% прибыли с подключения, счёт раз в сутки, оплата TXID; пауза копирования без оплаты
43. **ТОП CULT** — секции «ТРЕЙДЕРЫ CULT» / «КОНДИДАТЫ В CULT»; volnovoi «Копирует · все сделки трейдеров»
44. **ТОП UX** — график equity вне клика карточки; «Страховка» на volnovoi; выровненная форма Bybit API
45. **График сигнала** — шире (~220 баров), 268px, скругление 12px внутри карточки
46. **Трекер UI** — свёрнутые сделки; баланс под скрином скрыт; prop sync без смены старта/цели
47. **CULT каналы** — Telegram-каналы в кандидатах, парсинг сигналов, % с `connected_at`, polling `channel_post`
48. **UI redesign** — светлая/тёмная тема, glassmorphism, жёлтые CTA пропа/Bybit, PNG-логотипы
49. **Лимит формы сигнала** — **3 сделки или 2% стопа** / MSK / трейдер; бегунок в % счёта на весь остаток; backend validation
50. **Purge v3** — очистка контента incl. CULT-сигналы и copy-trades; маркер `.purged_all_published_may2026_v3`
51. **Purge jun2026 v2** — разовая полная очистка ленты/новостей/отзывов/CULT-stats; маркер `.purged_all_published_jun2026_v2`
52. **Purge jun2026 v3** — полная очистка + сброс stats кандидатов CULT; кнопка «Регистрация в HASH HEDGE»; маркер `.purged_all_published_jun2026_v3`
53. **Purge jun2026 v4** — разовая полная очистка ленты/новостей/отзывов; маркер `.purged_all_published_jun2026_v4`
54. **Ранг Китяра** — переименование «Хищник» (id 4), иконка kittyra (кит)
55. **Purge jun2026 v5** — разовая полная очистка ленты/новостей/отзывов; маркер `.purged_all_published_jun2026_v5`
56. **Брендинг ленты** — Volnovoi Cult, шапка Marketplace крипто-сделок; убран заголовок «Сигналы»
57. **Уведомления UI** — toggle «Уведомления в Telegram» на Ленте и Новостях; блочные push в `telegram_notify.py`
58. **↻ полный refresh** — `refreshSignalsFull` + remount графиков; обновление me/новостей/отзывов/подписки по вкладке
59. **График** — тема light/dark (`chartTheme.ts`); линия **«Лимитка»** до входа; P/L/% от лимита, не от `published_market_price` при зоне входа
60. **Форма** — `confirmAction` перед постом; `rank_max_leverage`; fix `StopOffsetSlider` (импорт лимита дня)
61. **Чат поддержки** — группа Telegram + `SubscriptionSupportChat` на вкладке Подписка

---

## Быстрое напоминание для AI

> **prop-signals-miniapp** — FastAPI + React **Volnovoi Cult** Mini App на Amvera (SQLite, `/data`). Админы публикуют сигналы **#N**; активные — по подписке, win/lose + трекер + ТОП — бесплатно. **Лимит дня в форме:** 3 сделки **или** 2% стопа (MSK). **volnovoi** — сводный портфель; копирование Bybit (**20% прибыли**). **Bybit USDT perp** — мониторинг и график. P/L: вход = лимит или рынок при посте; номинал от `account_size`. Бот — **long polling**, не webhook Amvera. **↻** — полная перезагрузка ленты; фон **15 с** — лёгкий poll. Полный контекст — этот файл.
