import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

export const posthogCollector: Collector = {
  name: "posthog",

  isEnabled(site: SiteConfig): boolean {
    return !!site.posthog?.projectId;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const projectId = site.posthog!.projectId;
    const apiKey = app.posthogApiKey;
    const host = app.posthogHost ?? "https://us.posthog.com";

    if (!apiKey) return { collector: "posthog", site: site.id, success: false, message: "No PostHog API key" };

    const queryUrl = `${host}/api/projects/${projectId}/query/`;
    const queryHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Query events count for the date using the HogQL Query API
    // (replaces the deprecated /api/projects/{id}/insights/trend/ endpoint)
    const eventsRes = await fetch(queryUrl, {
      method: "POST",
      headers: queryHeaders,
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `SELECT count() FROM events WHERE event = '$pageview' AND toDate(timestamp) = '${date}'`,
        },
      }),
    });

    if (!eventsRes.ok) throw new Error(`PostHog API: ${eventsRes.status} ${await eventsRes.text()}`);

    const eventsJson = (await eventsRes.json()) as {
      results?: Array<[number]>;
    };

    const events = eventsJson.results?.[0]?.[0] ?? 0;

    // Query unique persons (DAU) for the date
    const personsRes = await fetch(queryUrl, {
      method: "POST",
      headers: queryHeaders,
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND toDate(timestamp) = '${date}'`,
        },
      }),
    });

    if (!personsRes.ok) throw new Error(`PostHog API (persons): ${personsRes.status} ${await personsRes.text()}`);

    const personsJson = (await personsRes.json()) as {
      results?: Array<[number]>;
    };

    const persons = personsJson.results?.[0]?.[0] ?? 0;

    db.prepare(`
      INSERT INTO posthog_stats (date, site_id, events, persons, sessions)
      VALUES (?, ?, ?, ?, 0)
    `).run(date, site.id, events, persons);

    return {
      collector: "posthog",
      site: site.id,
      success: true,
      message: `${events} events, ${persons} unique users`,
      data: { events, persons },
    };
  },
};
