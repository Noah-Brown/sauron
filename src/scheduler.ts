import cron from "node-cron";
import type Database from "better-sqlite3";
import type { AppConfig } from "../config.js";
import { runCollection } from "./runner.js";
import { sendReport } from "./email.js";
import { logger } from "./utils/logger.js";

export function startScheduler(config: AppConfig, db: Database.Database): void {
  logger.info(`Scheduling collection at: ${config.cronSchedule}`);

  cron.schedule(config.cronSchedule, async () => {
    logger.info("Cron triggered collection run");
    try {
      const results = await runCollection(config, db);
      await sendReport(config, db, results);
    } catch (err) {
      logger.error("Collection run failed:", err);
    }
  });
}
