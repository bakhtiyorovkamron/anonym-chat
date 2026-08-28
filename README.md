# Anonym Chat MVP (18+)

Анонимный чат для общения один-на-один без раскрытия реальной личности.

## Stack
- Next.js (App Router) + TypeScript + React + Tailwind
- Prisma ORM + PostgreSQL
- Socket.IO realtime
- Anonymous auth через secure httpOnly cookie

## Архитектура
- `src/app` — UI страницы и API routes
- `src/server` — бизнес-логика (matchmaking/chat/reports)
- `src/lib` — auth, prisma, csrf, rate-limit, sanitization
- `prisma/schema.prisma` — DB schema
- `prisma/seed.ts` — dev seed
- `server.mjs` — custom Next.js + Socket.IO server

## Основной flow
1. `/` landing
2. `/onboarding` подтверждение 18+ + создание маски
3. `/match` запуск matchmaking
4. `/chat/[matchId]` realtime чат + block/report/end
5. `/admin/login` -> `/admin` панель модерации

## Environment variables
См. `.env.example`:
- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_SECRET`
- `PORT`
- `NODE_ENV`

## Setup
```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## PostgreSQL
Создайте БД `anonym_chat`, затем укажите корректный `DATABASE_URL`.

## Prisma
- Миграции: `npm run prisma:migrate`
- Seed: `npm run prisma:seed`

## Tests
```bash
npm run test
```

Покрыты минимальные кейсы:
- Matchmaking (self-match, block, language, preference, inactive)
- Chat (ownership, foreign match, empty, length limit)
- Reports (create constraints, rate limit logic, status set)

## Безопасность
- server-side validation (zod)
- CSRF check для mutating API
- input sanitization
- rate limiting (in-memory)
- secure httpOnly session cookies
- ORM queries (SQLi mitigation)
- nickname/message length limits
- report rate limits

## Admin
1. Откройте `/admin/login`
2. Введите `ADMIN_SECRET`
3. В `/admin` доступны stats/reports/status updates/ban/unban

## Matchmaking scoring (MVP)
- +30 language
- +20 interests overlap (cap)
- +20 mode
- +10 age proximity
- +10 mutual gender preference
- +10 online
- исключаются self, blocked, recently matched

## Realtime chat
Socket.IO:
- `join_match`
- `send_message`
- `typing`

Сообщения сохраняются в PostgreSQL и пушатся в room `match:<id>`.

## Deploy
- Frontend: Vercel/Next-compatible
- Realtime: Node runtime с `server.mjs` (например Railway/Fly/Render)
- PostgreSQL: managed service (Supabase/Neon/RDS)
