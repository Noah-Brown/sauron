# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development with hot reload (tsx watch)
npm start            # Production start
npm run run-now      # Start + trigger immediate collection
npm run build        # Compile TypeScript (tsc)
npm run typecheck    # Type-check without emitting (tsc --noEmit)
```

Trigger a manual collection: `curl -X POST http://localhost:3333/api/run`

No test framework is configured. No linter is configured.

## Architecture

Sauron is a daily analytics aggregator that collects metrics from 8 external services, stores them in SQLite, serves a dashboard via Hono, and emails a daily summary via Resend.

**Entry point:** `src/index.ts` — loads config, initializes DB, starts the Hono server, and schedules cron-based collection.

**Config:** `config.ts` (at repo root, not in `src/`) — reads all env vars, defines `AppConfig` and `SiteConfig` interfaces. Sites are configured via a `SITES` JSON env var. API keys are shared across all sites.

**Collector pattern:** Each collector in `src/collectors/` implements the `Collector` interface (`types.ts`): `name`, `isEnabled(site)`, and `collect(config, db)`. A collector is skipped if its service key is absent from the site config. Each collector writes directly to its own SQLite table using `ON CONFLICT REPLACE`.

**Runner:** `src/runner.ts` — iterates all sites × all collectors, records results in `collection_runs` table.

**Database:** `src/db.ts` — singleton `better-sqlite3` instance with WAL mode. Schema is auto-created on startup. Each collector has its own `*_stats` table keyed by `(date, site_id)`.

**Server:** Hono app in `src/server/app.ts` with two route groups:
- `src/server/routes/api.ts` — JSON API (`/api/stats/:siteId`, `/api/runs`, `POST /api/run`)
- `src/server/routes/dashboard.ts` — HTML dashboard rendered via template functions in `src/server/views/`

**Views:** Server-rendered HTML strings (no template engine). Layout, overview, and site-detail views in `src/server/views/`. Charts use Chart.js loaded from CDN.

**Uptime monitor:** `src/monitor.ts` — polls configured URLs every 10 minutes via HTTP GET. Tracks up/down state in memory and sends email alerts (via Resend) only on state transitions. Configured via `MONITOR_SITES` env var.

**Google auth:** `src/utils/google-auth.ts` — shared JWT-based auth for both Google Analytics and Search Console collectors, with token caching.

## Key Conventions

- ESM throughout (`"type": "module"` in package.json). Imports use `.js` extensions even for `.ts` files.
- TypeScript strict mode, target ES2022, bundler module resolution.
- No ORM — raw SQL via `better-sqlite3` prepared statements.
- SQLite tables use `UNIQUE(date, site_id) ON CONFLICT REPLACE` for idempotent upserts.
- Docker deploys with SQLite persisted via `./data` volume mount. Default port 3333.
