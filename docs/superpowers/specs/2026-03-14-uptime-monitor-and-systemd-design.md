# Uptime Monitor & Systemd Service

## Overview

Add site uptime monitoring with email alerts on state changes, and a systemd unit file to run Sauron as a background service on the current WSL Debian instance.

## 1. Uptime Monitor (`src/monitor.ts`)

New module that polls configured sites every 10 minutes via HTTP GET.

**Behavior:**
- Makes a fetch request to each URL with a 10-second timeout
- Tracks per-site state in memory: `Map<string, { isDown: boolean }>`
- Initializes assuming sites are up
- Sends email only on state transitions: up→down (alert) or down→up (recovery)
- A non-2xx status or connection/timeout error = "down"

**Configuration:**
- New env var `MONITOR_SITES` — comma-separated URLs
- Defaults to `https://pierrereview.com,https://threadline.news`
- New env var `MONITOR_INTERVAL_MS` — poll interval in ms, defaults to `600000` (10 min)
- Reuses existing Resend config (`resendApiKey`, `resendFromEmail`, `resendToEmail`) for alerts

**Email format:**
- Subject: `[ALERT] <url> is DOWN` or `[RECOVERED] <url> is back UP`
- Body: timestamp, URL, and error details (for down alerts)

## 2. Config changes (`config.ts`)

Add to `AppConfig`:
- `monitorSites: string[]`
- `monitorIntervalMs: number`

## 3. Entry point integration (`src/index.ts`)

Call `startMonitor(config)` alongside existing `startScheduler()`. Monitor runs independently of the collector system.

## 4. Systemd service (`sauron.service`)

User-level systemd unit file at repo root:
- `ExecStart` runs `npm start` in the project directory
- `Restart=always` with 5s restart delay
- `WorkingDirectory` set to this project path
- Installed via `systemctl --user enable --now sauron`

## 5. Out of scope

- No new DB tables (in-memory state only)
- No new API endpoints or dashboard changes
- No changes to existing collector system
