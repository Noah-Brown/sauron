import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

export const cloudflareCollector: Collector = {
  name: "cloudflare",

  isEnabled(site: SiteConfig): boolean {
    return !!site.cloudflare?.zoneId;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const token = app.cloudflareApiToken;
    if (!token) return { collector: "cloudflare", site: site.id, success: false, message: "No Cloudflare token" };

    const zoneId = site.cloudflare!.zoneId;

    // Use Cloudflare GraphQL Analytics API
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              filter: { date: "${date}" }
              limit: 1
            ) {
              sum {
                requests
                pageViews
                bytes
                threats
                cachedRequests
              }
              uniq {
                uniques
              }
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`Cloudflare API: ${res.status} ${res.statusText}`);

    const json = (await res.json()) as {
      data: {
        viewer: {
          zones: Array<{
            httpRequests1dGroups: Array<{
              sum: { requests: number; pageViews: number; bytes: number; threats: number; cachedRequests: number };
              uniq: { uniques: number };
            }>;
          }>;
        };
      };
    };

    const groups = json.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    const data = groups[0];

    const stats = {
      requests: data?.sum?.requests ?? 0,
      pageViews: data?.sum?.pageViews ?? 0,
      uniqueVisitors: data?.uniq?.uniques ?? 0,
      bytes: data?.sum?.bytes ?? 0,
      threats: data?.sum?.threats ?? 0,
      cachedRequests: data?.sum?.cachedRequests ?? 0,
    };

    db.prepare(`
      INSERT INTO cloudflare_stats (date, site_id, requests, page_views, unique_visitors, bytes, threats, cached_requests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(date, site.id, stats.requests, stats.pageViews, stats.uniqueVisitors, stats.bytes, stats.threats, stats.cachedRequests);

    return {
      collector: "cloudflare",
      site: site.id,
      success: true,
      message: `${stats.uniqueVisitors} visitors, ${stats.requests} requests`,
      data: stats,
    };
  },
};
