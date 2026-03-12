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

## Подсказка по Docker

Тебе понадобятся 3 сервиса:

- `frontend`
- `backend`
- `postgres`

Для Postgres удобно примонтировать `db/init.sql` как init script.
