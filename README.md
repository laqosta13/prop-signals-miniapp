# Prop Signals Mini App

Мини-приложение Telegram: **одна лента сигналов**, публикация только с аккаунтов из `TELEGRAM_ADMIN_IDS`. Стек: **FastAPI + React (Vite)**.

## Структура

- `backend/` — API, проверка `X-Telegram-Init-Data`, SQLite по умолчанию (можно заменить на PostgreSQL через `DATABASE_URL`).
- `frontend/` — React, `@twa-dev/sdk`, прокси `/api` → `http://127.0.0.1:8000` в режиме разработки.

## Быстрый старт (локально)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Укажите BOT_TOKEN и TELEGRAM_ADMIN_IDS (ваш Telegram user id).
# Либо для отладки без токена: оставьте BOT_TOKEN пустым и задайте только TELEGRAM_ADMIN_IDS.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Если backend без BOT_TOKEN: добавьте VITE_DEV_TELEGRAM_USER_ID=<тот же id что в TELEGRAM_ADMIN_IDS>
npm run dev
```

Откройте `http://localhost:5173`. В Telegram Mini App заголовок `X-Telegram-Init-Data` подставится автоматически из `WebApp.initData`.

## [Amvera Cloud](https://cloud.amvera.ru/)

Подходит один сервис: **Docker** собирает React и кладёт `dist` в образ; **FastAPI** отдаёт API и SPA с одного HTTPS-домена (удобно для Mini App: запросы идут на тот же хост, `VITE_API_URL` не нужен).

1. Создайте проект в кабинете → окружение **Docker**, подключите Git-репозиторий с этим кодом (корень репозитория = корень `prop-signals-miniapp`, где лежат `Dockerfile` и `amvera.yml`). В `Dockerfile` для сборки на Amvera используются образы `node:18` и `python:3.11` (теги вроде `node:20-alpine` в их mirror часто недоступны).
2. Включите **постоянное хранилище** (диск): в `amvera.yml` уже указано `persistenceMount: /data`. SQLite пишет в `DATABASE_URL` по умолчанию `sqlite:////data/signals.db` (задаётся в `Dockerfile`).
3. В разделе переменных окружения Amvera задайте секреты (как в `backend/.env.example`):
   - `BOT_TOKEN`
   - `TELEGRAM_ADMIN_IDS`
   - при необходимости `CORS_ORIGINS` (если фронт откроете с другого домена; при одном домене с API можно не задавать).
4. Дождитесь сборки и откройте выданный URL (`*.amvera.io` и т.п.). Проверка: `GET /health` → `{"status":"ok"}`.
5. В [@BotFather](https://t.me/BotFather) укажите этот **HTTPS** URL как Mini App.

Официальные материалы: [документация Amvera](https://docs.amvera.ru/), генератор манифеста [manifest.amvera.ru](https://manifest.amvera.ru/).

## Продакшен (общий случай)

1. Задеплойте backend по HTTPS (например VPS + nginx + certbot).
2. Соберите фронт: `npm run build`, раздайте статику или положите за CDN.
3. В [@BotFather](https://t.me/BotFather): создайте бота → **Bot Settings → Menu Button** или **Configure Mini App** → укажите URL фронта (HTTPS).
4. Если API на **другом** домене, во фронте задайте `VITE_API_URL=https://ваш-api.example.com` и пересоберите. Если API и фронт на одном хосте (как в Docker-образе выше), переменная не нужна — используются относительные пути `/auth`, `/signals`.

## API

- `GET /health` — проверка живости.
- `GET /auth/me` — текущий пользователь и флаг `is_admin`.
- `GET /signals` — лента (нужна авторизация Telegram или dev-заголовок).
- `POST /signals` — новый сигнал (**только админ**).

## Юридическое

Сигналы и материалы про prop challenge не являются персональной инвестиционной рекомендацией; риски на стороне пользователя.
