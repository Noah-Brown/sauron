import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

export const digitaloceanCollector: Collector = {
  name: "digitalocean",

  isEnabled(site: SiteConfig): boolean {
    return !!site.digitalocean?.appId;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const appId = site.digitalocean!.appId;
    const token = app.digitaloceanToken;

    if (!token) return { collector: "digitalocean", site: site.id, success: false, message: "No DO token" };

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Get app info
    const appRes = await fetch(`https://api.digitalocean.com/v2/apps/${appId}`, { headers });
    if (!appRes.ok) throw new Error(`DO API: ${appRes.status} ${await appRes.text()}`);

    const appData = (await appRes.json()) as {
      app: {
        active_deployment?: {
          phase: string;
          created_at: string;
        };
        in_progress_deployment?: { phase: string };
      };
    };

    const deployment = appData.app.active_deployment;
    const appStatus = appData.app.in_progress_deployment?.phase ?? deployment?.phase ?? "unknown";

    db.prepare(`
      INSERT INTO digitalocean_stats (date, site_id, app_status, last_deployment_status, last_deployment_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      date,
      site.id,
      appStatus,
      deployment?.phase ?? "",
      deployment?.created_at ?? ""
    );

    return {
      collector: "digitalocean",
      site: site.id,
      success: true,
      message: `Status: ${appStatus}`,
      data: { appStatus },
    };
  },
};
