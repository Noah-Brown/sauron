import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";
import { getGoogleAccessToken } from "../utils/google-auth.js";

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

export const googleAnalyticsCollector: Collector = {
  name: "google-analytics",

  isEnabled(site: SiteConfig): boolean {
    return !!site.googleAnalytics?.propertyId;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const propertyId = site.googleAnalytics!.propertyId;

    const token = await getGoogleAccessToken(app, SCOPES);

    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: date, endDate: date }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "bounceRate" },
          ],
        }),
      }
    );

    if (!res.ok) throw new Error(`GA4 API: ${res.status} ${await res.text()}`);

    const json = (await res.json()) as {
      rows?: Array<{ metricValues: Array<{ value: string }> }>;
    };

    const row = json.rows?.[0]?.metricValues;
    const stats = {
      activeUsers: parseInt(row?.[0]?.value ?? "0", 10),
      sessions: parseInt(row?.[1]?.value ?? "0", 10),
      pageViews: parseInt(row?.[2]?.value ?? "0", 10),
      avgSessionDuration: parseFloat(row?.[3]?.value ?? "0"),
      bounceRate: parseFloat(row?.[4]?.value ?? "0"),
    };

    db.prepare(`
      INSERT INTO ga_stats (date, site_id, active_users, sessions, page_views, avg_session_duration, bounce_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(date, site.id, stats.activeUsers, stats.sessions, stats.pageViews, stats.avgSessionDuration, stats.bounceRate);

    return {
      collector: "google-analytics",
      site: site.id,
      success: true,
      message: `${stats.activeUsers} users, ${stats.sessions} sessions`,
      data: stats,
    };
  },
};
