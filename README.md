# Decision OS — Personal Decision & Commitment System

Система для принятия решений и управления обязательствами.

## Настройка для Vercel

### 1. Создайте Prisma Postgres в Vercel

1. Vercel Dashboard → Storage → Create Database → **Prisma Postgres**
2. Скопируйте переменные окружения из Quickstart

### 2. Подключите проект к Vercel

```bash
vercel link
```

### 3. Получите DATABASE_URL из Vercel

```bash
vercel env pull .env.local
```

Это создаст `.env.local` с `DATABASE_URL` от вашего Prisma Postgres.

### 4. Примените миграции

```bash
npx prisma db push
```

Или создайте миграцию:
```bash
npx prisma migrate dev --name init
```

### 5. Переменные окружения в Vercel

В Vercel Dashboard → Settings → Environment Variables добавьте:

**База данных (автоматически из Prisma Postgres):**
- `DATABASE_URL` (уже добавлен при создании БД)

**Google Calendar (опционально):**
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID="ваш-client-id"
GOOGLE_CLIENT_ID="ваш-client-id"
GOOGLE_CLIENT_SECRET="ваш-client-secret"
GOOGLE_REDIRECT_URI="https://ваш-домен.vercel.app/api/auth/google/callback"
```

### 6. Деплой

```bash
vercel deploy
```

Или просто push в GitHub — Vercel задеплоит автоматически.

## Локальная разработка

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Изменение схемы БД

```bash
npx prisma db push
npx prisma generate
```
