import type Database from "better-sqlite3";
import type { AppConfig } from "../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./collectors/types.js";
import { logger } from "./utils/logger.js";

// Import all collectors
import { cloudflareCollector } from "./collectors/cloudflare.js";
import { githubCollector } from "./collectors/github.js";
import { googleAnalyticsCollector } from "./collectors/google-analytics.js";
import { googleSearchConsoleCollector } from "./collectors/google-search-console.js";
import { posthogCollector } from "./collectors/posthog.js";
import { digitaloceanCollector } from "./collectors/digitalocean.js";
import { resendCollector } from "./collectors/resend.js";
import { easCollector } from "./collectors/eas.js";

const collectors: Collector[] = [
  cloudflareCollector,
  githubCollector,
  googleAnalyticsCollector,
  googleSearchConsoleCollector,
  posthogCollector,
  digitaloceanCollector,
  resendCollector,
  easCollector,
];

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export async function runCollection(config: AppConfig, db: Database.Database): Promise<CollectorResult[]> {
  const date = getYesterday();
  logger.info(`Starting collection run for ${date}`);

  const run = db.prepare(
    "INSERT INTO collection_runs (date, status) VALUES (?, 'running')"
  ).run(date);
  const runId = run.lastInsertRowid;

  const results: CollectorResult[] = [];

  for (const site of config.sites) {
    for (const collector of collectors) {
      if (!collector.isEnabled(site)) continue;

      const collectorConfig: CollectorConfig = { site, app: config, date };

      try {
        logger.info(`Running ${collector.name} for ${site.id}`);
        const result = await collector.collect(collectorConfig, db);
        results.push(result);
        logger.info(`${collector.name}/${site.id}: ${result.success ? "OK" : "FAIL"} — ${result.message ?? ""}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`${collector.name}/${site.id} threw: ${message}`);
        results.push({
          collector: collector.name,
          site: site.id,
          success: false,
          message,
        });
      }
    }
  }

  db.prepare(
    "UPDATE collection_runs SET finished_at = datetime('now'), status = ?, results_json = ? WHERE id = ?"
  ).run(
    results.every((r) => r.success) ? "success" : "partial",
    JSON.stringify(results),
    runId
  );

  logger.info(`Collection run complete: ${results.filter((r) => r.success).length}/${results.length} succeeded`);
  return results;
}
