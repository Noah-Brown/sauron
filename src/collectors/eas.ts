import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

const GRAPHQL_URL = "https://api.expo.dev/graphql";

const BUILDS_QUERY = `
  query ViewBuildsOnApp($appId: String!, $offset: Int!, $limit: Int!) {
    app {
      byId(appId: $appId) {
        builds(offset: $offset, limit: $limit) {
          id
          status
          platform
          createdAt
        }
      }
    }
  }
`;

const UPDATES_QUERY = `
  query ViewUpdateGroupsOnApp($appId: String!, $offset: Int!, $limit: Int!) {
    app {
      byId(appId: $appId) {
        updateGroups(limit: $limit, offset: $offset) {
          id
          createdAt
        }
      }
    }
  }
`;

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

    // Fetch builds via GraphQL
    const buildsRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: BUILDS_QUERY,
        variables: { appId: projectId, offset: 0, limit: 50 },
      }),
    });

    if (!buildsRes.ok) throw new Error(`EAS API: ${buildsRes.status} ${await buildsRes.text()}`);

    const buildsJson = (await buildsRes.json()) as {
      data?: {
        app?: {
          byId?: {
            builds?: Array<{
              id: string;
              status: string;
              platform: string;
              createdAt: string;
            }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (buildsJson.errors?.length) {
      throw new Error(`EAS GraphQL: ${buildsJson.errors.map((e) => e.message).join(", ")}`);
    }

    const builds = buildsJson.data?.app?.byId?.builds ?? [];
    const todayBuilds = builds.filter((b) => b.createdAt.startsWith(date));
    const lastBuild = builds[0];

    // Fetch updates via GraphQL
    let updatesToday = 0;
    try {
      const updatesRes = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: UPDATES_QUERY,
          variables: { appId: projectId, offset: 0, limit: 50 },
        }),
      });

      if (updatesRes.ok) {
        const updatesJson = (await updatesRes.json()) as {
          data?: {
            app?: {
              byId?: {
                updateGroups?: Array<Array<{ createdAt: string }>>;
              };
            };
          };
        };
        const groups = updatesJson.data?.app?.byId?.updateGroups ?? [];
        // updateGroups is an array of arrays (grouped updates)
        for (const group of groups) {
          if (Array.isArray(group)) {
            updatesToday += group.filter((u) => u.createdAt.startsWith(date)).length;
          }
        }
      }
    } catch {
      // Updates query failed — not critical
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
