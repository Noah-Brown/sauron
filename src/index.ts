import { serve } from "@hono/node-server";
import { loadConfig } from "../config.js";
import { getDb } from "./db.js";
import { createApp } from "./server/app.js";
import { startScheduler } from "./scheduler.js";
import { runCollection } from "./runner.js";
import { sendReport } from "./email.js";
import { logger } from "./utils/logger.js";

const config = loadConfig();
const db = getDb(config.dbPath);
const app = createApp(config, db);

// Start cron scheduler
startScheduler(config, db);

// Check for --run-now flag
if (process.argv.includes("--run-now")) {
  logger.info("--run-now flag detected, triggering immediate collection");
  runCollection(config, db)
    .then((results) => sendReport(config, db, results))
    .then(() => logger.info("Immediate run complete"))
    .catch((err) => logger.error("Immediate run failed:", err));
}

// Start web server
serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info(`Sauron listening on http://localhost:${info.port}`);
});
