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

    // Query events count for the date
    const eventsRes = await fetch(`${host}/api/projects/${projectId}/insights/trend/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [{ id: "$pageview", type: "events", math: "total" }],
        date_from: date,
        date_to: date,
      }),
    });

    if (!eventsRes.ok) throw new Error(`PostHog API: ${eventsRes.status} ${await eventsRes.text()}`);

    const eventsJson = (await eventsRes.json()) as {
      result?: Array<{ data: number[] }>;
    };

    const events = eventsJson.result?.[0]?.data?.[0] ?? 0;

    // Query unique persons
    const personsRes = await fetch(`${host}/api/projects/${projectId}/insights/trend/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [{ id: "$pageview", type: "events", math: "dau" }],
        date_from: date,
        date_to: date,
      }),
    });

    const personsJson = (await personsRes.json()) as {
      result?: Array<{ data: number[] }>;
    };

    const persons = personsJson.result?.[0]?.data?.[0] ?? 0;

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
