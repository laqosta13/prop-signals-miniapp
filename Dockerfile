# Сборка фронта и один контейнер с FastAPI + статикой (удобно для cloud.amvera.ru).
# Теги node:18 и python:3.11 — как в документации Amvera; alpine/20-alpine часто отсутствуют в harbor.amvera.ru.
FROM node:18 AS frontend
WORKDIR /src
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    DATABASE_URL=sqlite:////data/signals.db \
    STATIC_ROOT=/app/static \
    MEDIA_ROOT=/data/media

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend /src/dist /app/static

EXPOSE 80
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
