# MTD ITSA — Backend API

NestJS v11 + TypeScript backend for the MTD ITSA agent platform.

## Quick start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — at minimum set DB_USER, DB_PASSWORD, DB_NAME
```

### 3. Start in development mode
```bash
npm run start:dev
```

| Endpoint | URL |
|---|---|
| API root | `http://localhost:3500/api/v1` |
| Health check | `http://localhost:3500/api/v1/health` |
| Swagger docs | `http://localhost:3500/api/docs` |

---

## Docker (recommended for local development)

```bash
# Start API + MySQL together
docker-compose up

# Rebuild after dependency changes
docker-compose up --build

# Run in background
docker-compose up -d
```

---

## Available scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload |
| `npm run start:prod` | Start compiled production build |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Lint and auto-fix |
| `npm run lint:check` | Lint without auto-fix (CI) |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run end-to-end tests |

---

## Database migrations

TypeORM CLI is wired up and ready. All schema changes must go through migrations — never use `synchronize: true` in production.

```bash
# Generate a migration from entity changes
npm run migration:generate -- src/database/migrations/CreateUsersTable

# Run pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Create an empty migration file
npm run migration:create -- src/database/migrations/SeedInitialData
```

> Migrations live in `src/database/migrations/` and are tracked in the `migrations` table in MySQL.

---

## Health check

```
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "message": "API is running",
    "uptime": 42,
    "timestamp": "2026-04-22T10:00:00.000Z",
    "checks": {
      "database": { "status": "ok", "message": "Connected", "responseTimeMs": 3 }
    }
  },
  "timestamp": "2026-04-22T10:00:00.000Z"
}
```

`status: "degraded"` means the API is up but the database is unreachable.

---

## Environment variables

See `.env.example` for all required and optional variables.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (3500) | HTTP port |
| `NODE_ENV` | No (development) | Environment |
| `DB_HOST` | No (localhost) | MySQL host |
| `DB_PORT` | No (3306) | MySQL port |
| `DB_USER` | **Yes** | MySQL username |
| `DB_PASSWORD` | **Yes** | MySQL password |
| `DB_NAME` | **Yes** | MySQL database name |
| `FRONTEND_URL` | No | CORS origin in production |
| `THROTTLE_TTL` | No (60) | Rate limit window (seconds) |
| `THROTTLE_LIMIT` | No (100) | Max requests per window |
| `JWT_SECRET` | Auth phase | JWT signing secret |
| `JWT_EXPIRES_IN` | No (15m) | Access token TTL |
| `REFRESH_TOKEN_SECRET` | Auth phase | Refresh token secret |
| `REFRESH_TOKEN_EXPIRES_IN` | No (7d) | Refresh token TTL |

---

## Project structure

```
src/
  main.ts                       Bootstrap, global middleware, Swagger
  app.module.ts                 Root module (Config, TypeORM, Throttler)
  app.controller.ts             GET /api/v1 — service info
  app.service.ts

  config/
    app.config.ts               App settings namespace
    database.config.ts          DB settings + typeOrmConfig factory
    auth.config.ts              JWT/auth placeholders (wired in auth phase)
    env.validation.ts           Joi schema for all env variables

  common/
    constants/index.ts          Shared constants (prefix, swagger, pagination)
    dto/
      pagination.dto.ts         Reusable page/limit query DTO
      id-param.dto.ts           UUID route param DTO
    enums/
      sort-order.enum.ts        ASC / DESC
      node-env.enum.ts          development / production / test
    exceptions/
      app.exception.ts          AppException, ResourceNotFoundException, etc.
    filters/
      http-exception.filter.ts  Global exception → consistent error shape
    helpers/
      crypto.helper.ts          hashPassword / comparePassword (bcryptjs)
    interceptors/
      response.interceptor.ts   Wraps all success responses as { success, data, timestamp }
    types/
      api-response.type.ts      TypeScript interfaces for API response shapes

  database/
    base.entity.ts              Abstract entity with id, createdAt, updatedAt, deletedAt
    data-source.ts              TypeORM CLI DataSource (migration commands)
    migrations/                 Generated migration files
    seeds/                      Seed scripts

  modules/
    health/                     GET /api/v1/health — uptime + DB check

test/
  app.e2e-spec.ts               E2E tests (DataSource mocked, no real DB needed)
  jest-e2e.json                 E2E Jest config
```

---

## What's coming in the next phase

- Auth module (register, login, refresh token, logout, password reset)
- User / agent entity + repository
- JWT strategy + guards
- Role-based access control foundation
- HMRC integration module
- Client module
