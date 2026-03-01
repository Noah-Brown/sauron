import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { logger } from "./utils/logger.js";

let db: Database.Database;

export function getDb(dbPath: string): Database.Database {
  if (db) return db;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  logger.info(`Database initialized at ${dbPath}`);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      results_json TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS cloudflare_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      requests INTEGER DEFAULT 0,
      page_views INTEGER DEFAULT 0,
      unique_visitors INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0,
      threats INTEGER DEFAULT 0,
      cached_requests INTEGER DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS ga_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      active_users INTEGER DEFAULT 0,
      sessions INTEGER DEFAULT 0,
      page_views INTEGER DEFAULT 0,
      avg_session_duration REAL DEFAULT 0,
      bounce_rate REAL DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS gsc_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      position REAL DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS posthog_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      events INTEGER DEFAULT 0,
      persons INTEGER DEFAULT 0,
      sessions INTEGER DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS github_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      stars INTEGER DEFAULT 0,
      open_issues INTEGER DEFAULT 0,
      open_prs INTEGER DEFAULT 0,
      commits_today INTEGER DEFAULT 0,
      deployments_today INTEGER DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS digitalocean_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      app_status TEXT DEFAULT '',
      last_deployment_status TEXT DEFAULT '',
      last_deployment_at TEXT DEFAULT '',
      cpu_percentage REAL DEFAULT 0,
      memory_percentage REAL DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS resend_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      emails_sent INTEGER DEFAULT 0,
      delivered INTEGER DEFAULT 0,
      bounced INTEGER DEFAULT 0,
      complained INTEGER DEFAULT 0,
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS eas_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      builds_today INTEGER DEFAULT 0,
      updates_today INTEGER DEFAULT 0,
      last_build_status TEXT DEFAULT '',
      last_build_platform TEXT DEFAULT '',
      UNIQUE(date, site_id) ON CONFLICT REPLACE
    );
  `);
}
