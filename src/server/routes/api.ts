import { Hono } from "hono";
import type Database from "better-sqlite3";
import type { AppConfig } from "../../../config.js";
import { runCollection } from "../../runner.js";
import { sendReport } from "../../email.js";
import { logger } from "../../utils/logger.js";

const COLLECTOR_TABLES: Record<string, string> = {
  cloudflare: "cloudflare_stats",
  "google-analytics": "ga_stats",
  "google-search-console": "gsc_stats",
  posthog: "posthog_stats",
  github: "github_stats",
  digitalocean: "digitalocean_stats",
  resend: "resend_stats",
  eas: "eas_stats",
};

export function createApiRoutes(config: AppConfig, db: Database.Database): Hono {
  const api = new Hono();

  // Get stats for a site + collector
  api.get("/stats/:siteId/:collector", (c) => {
    const { siteId, collector } = c.req.param();
    const from = c.req.query("from") ?? getDateDaysAgo(30);
    const to = c.req.query("to") ?? getToday();

    const table = COLLECTOR_TABLES[collector];
    if (!table) return c.json({ error: "Unknown collector" }, 400);

    const rows = db
      .prepare(`SELECT * FROM ${table} WHERE site_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC`)
      .all(siteId, from, to);

    return c.json({ siteId, collector, from, to, data: rows });
  });

  // Get all stats for a site (latest day)
  api.get("/stats/:siteId", (c) => {
    const { siteId } = c.req.param();
    const date = c.req.query("date") ?? getYesterday();

    const stats: Record<string, unknown> = {};
    for (const [name, table] of Object.entries(COLLECTOR_TABLES)) {
      const row = db.prepare(`SELECT * FROM ${table} WHERE site_id = ? AND date = ?`).get(siteId, date);
      if (row) stats[name] = row;
    }

    return c.json({ siteId, date, stats });
  });

  // Get collection runs
  api.get("/runs", (c) => {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const runs = db.prepare("SELECT * FROM collection_runs ORDER BY id DESC LIMIT ?").all(limit);
    return c.json({ runs });
  });

  // Manual trigger
  api.post("/run", async (c) => {
    logger.info("Manual collection run triggered");
    try {
      const results = await runCollection(config, db);
      await sendReport(config, db, results);
      return c.json({ success: true, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Manual run failed:", message);
      return c.json({ success: false, error: message }, 500);
    }
  });

  return api;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
