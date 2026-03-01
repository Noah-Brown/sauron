import { Hono } from "hono";
import { html } from "hono/html";
import type Database from "better-sqlite3";
import type { AppConfig } from "../../../config.js";
import { overviewPage } from "../views/overview.js";
import { siteDetailPage } from "../views/site-detail.js";

export function createDashboardRoutes(config: AppConfig, db: Database.Database): Hono {
  const dashboard = new Hono();

  dashboard.get("/", (c) => {
    const yesterday = getYesterday();
    const dayBefore = getDayBefore(yesterday);

    const siteData = config.sites.map((site) => {
      const stats: Record<string, Record<string, unknown> | undefined> = {};
      const prevStats: Record<string, Record<string, unknown> | undefined> = {};

      const tables: Record<string, string> = {
        cloudflare: "cloudflare_stats",
        ga: "ga_stats",
        gsc: "gsc_stats",
        github: "github_stats",
        digitalocean: "digitalocean_stats",
        resend: "resend_stats",
        posthog: "posthog_stats",
        eas: "eas_stats",
      };

      for (const [key, table] of Object.entries(tables)) {
        stats[key] = db.prepare(`SELECT * FROM ${table} WHERE site_id = ? AND date = ?`).get(site.id, yesterday) as Record<string, unknown> | undefined;
        prevStats[key] = db.prepare(`SELECT * FROM ${table} WHERE site_id = ? AND date = ?`).get(site.id, dayBefore) as Record<string, unknown> | undefined;
      }

      return { site, stats, prevStats };
    });

    return c.html(overviewPage(config, siteData, yesterday));
  });

  dashboard.get("/site/:siteId", (c) => {
    const { siteId } = c.req.param();
    const site = config.sites.find((s) => s.id === siteId);
    if (!site) return c.text("Site not found", 404);

    return c.html(siteDetailPage(config, site));
  });

  return dashboard;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function getDayBefore(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
