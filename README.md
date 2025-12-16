# Decision OS — Personal Decision & Commitment System

Система для принятия решений и управления обязательствами.

## Настройка для Vercel

### Переменные окружения

В настройках Vercel проекта добавьте:

**База данных (обязательно):**
```
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

Или используйте Vercel Postgres:
1. В Vercel Dashboard → Storage → Create Database → Postgres
2. Скопируйте `POSTGRES_PRISMA_URL` в `DATABASE_URL`

**Google Calendar (опционально):**
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID="ваш-client-id"
GOOGLE_CLIENT_ID="ваш-client-id"
GOOGLE_CLIENT_SECRET="ваш-client-secret"
GOOGLE_REDIRECT_URI="https://ваш-домен.vercel.app/api/auth/google/callback"
```

### Миграция БД

После настройки DATABASE_URL:
```bash
npx prisma db push
```

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
