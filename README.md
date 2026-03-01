# Sauron

Daily analytics and DevOps reporter. Aggregates data from up to 8 services into a single daily email report and a lightweight web dashboard with historical trends.

## Services

| Collector | Data |
|-----------|------|
| **Cloudflare** | Visitors, requests, page views, cached requests, threats |
| **Google Analytics** | Active users, sessions, page views, bounce rate |
| **Google Search Console** | Clicks, impressions, CTR, average position |
| **GitHub** | Stars, commits, open issues/PRs, deployments |
| **PostHog** | Events, unique users |
| **DigitalOcean** | App status, last deployment |
| **Resend** | Emails sent, delivered, bounced |
| **EAS (Expo)** | Builds, OTA updates |

Each collector is optional — only runs if configured for a given site.

## Quick Start

```bash
# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with your API keys and site definitions

# Run in development (hot reload)
npm run dev

# Trigger a collection manually
curl -X POST http://localhost:3333/api/run
```

## Docker

```bash
docker compose up -d --build
```

SQLite data persists via the `./data` volume mount. The server runs on port 3333.

## Configuration

All configuration is via environment variables (see `.env.example`).

**API keys** are shared across all sites. **Sites** are defined as a JSON array in the `SITES` env var. Each site declares which services it uses and their resource IDs:

```json
[
  {
    "id": "mysite",
    "name": "My Site",
    "url": "https://mysite.com",
    "cloudflare": { "zoneId": "abc123" },
    "github": { "repo": "owner/repo" },
    "googleAnalytics": { "propertyId": "123456" },
    "googleSearchConsole": { "siteUrl": "https://mysite.com" },
    "posthog": { "projectId": "12345" },
    "digitalocean": { "appId": "app-id" },
    "resend": {},
    "eas": { "projectId": "expo-project-id" }
  }
]
```

Omit any service key to skip that collector for a site.

## Dashboard

- **`/`** — Overview with per-site metric cards and day-over-day deltas
- **`/site/:siteId`** — 30-day trend charts per data source
- **Run Now** button in the nav triggers an immediate collection

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats/:siteId` | GET | All latest stats for a site |
| `/api/stats/:siteId/:collector?from=&to=` | GET | Time-series data for charts |
| `/api/runs` | GET | Collection run history |
| `/api/run` | POST | Trigger manual collection + email |

## Email Report

After each collection run, a summary email is sent via Resend with per-site metrics, percentage changes vs the previous day, and a link to the dashboard. Requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_TO_EMAIL`.

## Scheduling

Collections run on a cron schedule (default: `0 8 * * *` — 8 AM daily). Override with the `CRON_SCHEDULE` env var. You can also pass `--run-now` to trigger a collection on startup:

```bash
npm run run-now
```

## Tech Stack

- TypeScript + tsx
- Hono (web server)
- better-sqlite3 (local storage)
- node-cron (scheduling)
- Resend SDK (email)
- Chart.js + Pico CSS (dashboard, loaded from CDN)
