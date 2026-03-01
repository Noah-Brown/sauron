import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

export const easCollector: Collector = {
  name: "eas",

  isEnabled(site: SiteConfig): boolean {
    return !!site.eas?.projectId;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const projectId = site.eas!.projectId;
    const token = app.easToken;

    if (!token) return { collector: "eas", site: site.id, success: false, message: "No EAS token" };

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Fetch builds for the project
    const buildsRes = await fetch(
      `https://api.expo.dev/v2/projects/${projectId}/builds?limit=50`,
      { headers }
    );

    if (!buildsRes.ok) throw new Error(`EAS API: ${buildsRes.status} ${await buildsRes.text()}`);

    const buildsJson = (await buildsRes.json()) as {
      data?: Array<{
        id: string;
        createdAt: string;
        status: string;
        platform: string;
      }>;
    };

    const builds = buildsJson.data ?? [];
    const todayBuilds = builds.filter((b) => b.createdAt.startsWith(date));
    const lastBuild = builds[0];

    // Fetch updates
    const updatesRes = await fetch(
      `https://api.expo.dev/v2/projects/${projectId}/updates?limit=50`,
      { headers }
    );

    let updatesToday = 0;
    if (updatesRes.ok) {
      const updatesJson = (await updatesRes.json()) as {
        data?: Array<{ createdAt: string }>;
      };
      updatesToday = (updatesJson.data ?? []).filter((u) => u.createdAt.startsWith(date)).length;
    }

    db.prepare(`
      INSERT INTO eas_stats (date, site_id, builds_today, updates_today, last_build_status, last_build_platform)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      date,
      site.id,
      todayBuilds.length,
      updatesToday,
      lastBuild?.status ?? "",
      lastBuild?.platform ?? ""
    );

    return {
      collector: "eas",
      site: site.id,
      success: true,
      message: `${todayBuilds.length} builds, ${updatesToday} updates`,
      data: { builds: todayBuilds.length, updates: updatesToday },
    };
  },
};
