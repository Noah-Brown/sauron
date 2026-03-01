import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";
import { getGoogleAccessToken } from "../utils/google-auth.js";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export const googleSearchConsoleCollector: Collector = {
  name: "google-search-console",

  isEnabled(site: SiteConfig): boolean {
    return !!site.googleSearchConsole?.siteUrl;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const siteUrl = site.googleSearchConsole!.siteUrl;

    const token = await getGoogleAccessToken(app, SCOPES);

    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: date,
          endDate: date,
          dimensions: [],
        }),
      }
    );

    if (!res.ok) throw new Error(`GSC API: ${res.status} ${await res.text()}`);

    const json = (await res.json()) as {
      rows?: Array<{ clicks: number; impressions: number; ctr: number; position: number }>;
    };

    const row = json.rows?.[0];
    const stats = {
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      ctr: row?.ctr ?? 0,
      position: row?.position ?? 0,
    };

    db.prepare(`
      INSERT INTO gsc_stats (date, site_id, clicks, impressions, ctr, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date, site.id, stats.clicks, stats.impressions, stats.ctr, stats.position);

    return {
      collector: "google-search-console",
      site: site.id,
      success: true,
      message: `${stats.clicks} clicks, ${stats.impressions} impressions`,
      data: stats,
    };
  },
};
