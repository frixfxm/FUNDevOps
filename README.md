# Учебный мессенджер

Готовый учебный проект под твою практику с Docker и Ubuntu-сервером.

## Стек

- Frontend: Next.js 14
- Backend: Express.js
- База данных: PostgreSQL
- Авторизация: JWT
- Регистрация: отсутствует, пользователи уже зашиты в seed

## Готовые пользователи

1. Люба 
2. Петр Петрович
3. Толя
4. Хомяк
5. Влад
6. Санечка
7. МАКСОН


## Структура

```text
messenger-project/
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
├── frontend/
│   ├── package.json
│   ├── .env.example
│   └── src/
├── db/
│   └── init.sql
└── README.md
```

## Что уже реализовано

- страница логина
- вход только по готовым пользователям
- JWT-авторизация
- страница мессенджера
- слева список пользователей с аватарками и именами
- справа чат с выбранным пользователем
- отправка сообщений
- автоподгрузка новых сообщений раз в 3 секунды
- несколько стартовых сообщений в базе

## Локальный запуск без Docker

### 1. PostgreSQL

Создай базу данных `messenger_db` и выполни:

```bash
psql -U postgres -d messenger_db -f db/init.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

По умолчанию backend поднимется на `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

По умолчанию frontend поднимется на `http://localhost:3000`.

## Что тебе можно сделать дальше

- написать Dockerfile для backend
- написать Dockerfile для frontend
- поднять Postgres в отдельном контейнере
- собрать всё через docker compose
- вынести env-переменные
- добавить nginx reverse proxy
- добавить websocket вместо polling

## HTTPS через nginx (для звонков и микрофона)

Браузер даёт доступ к микрофону только по HTTPS. Ниже — вариант с твоим nginx.

### 1. Запуск приложения (Docker)

Файлы `.env` не нужны — в `docker-compose.yml` заданы значения по умолчанию, фронт ходит в API по относительному пути `/api` (подойдёт любой домен за nginx).

```bash
docker compose build
docker compose up -d
```

Frontend будет на порту 3000, backend на 4000 (nginx проксирует на них). При 502 проверь логи: `docker compose logs backend` — бэкенд должен слушать на `0.0.0.0:4000` и успешно подключаться к БД.

### 2. Конфиг nginx с HTTPS

Два блока `server`: первый — `listen 80` с `return 301 https://$host$request_uri;`; второй — `listen 443 ssl` с путями к сертификатам и `location /`, `/api/`, `/ws/` (proxy_pass на 127.0.0.1:3000 и 127.0.0.1:4000, заголовки Upgrade/Connection для WebSocket).

**Самоподписанный сертификат (тест без домена):**

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/messenger.key \
  -out /etc/nginx/ssl/messenger.crt \
  -subj "/CN=localhost"
```

В блоке 443 укажи `ssl_certificate /etc/nginx/ssl/messenger.crt` и `ssl_certificate_key /etc/nginx/ssl/messenger.key`.

**С доменом (Let's Encrypt):** `sudo certbot --nginx -d ваш-домен` — certbot настроит SSL.

### 3. Frontend — URL API

В `frontend/.env` укажи адрес сайта по HTTPS:

```bash
NEXT_PUBLIC_API_URL=https://ТВОЙ_ДОМЕН/api
```

(Для теста с localhost: `https://localhost/api` — если nginx слушает на том же сервере.)

Пересобери frontend (`docker compose build frontend` и `docker compose up -d`), затем открой сайт в браузере по **https://**.

### 4. TURN для звонков (если звука нет, ICE failed)

Если звонок устанавливается, но собеседника не слышно (в chrome://webrtc-internals видно `iceConnectionState: failed`), нужен TURN-сервер. Инструкция по установке coturn на Ubuntu и настройке переменных — в **[docs/TURN-setup.md](docs/TURN-setup.md)**.

## Подсказка по Docker

Тебе понадобятся 3 сервиса:

- `frontend`
- `backend`
- `postgres`

Для Postgres удобно примонтировать `db/init.sql` как init script.
