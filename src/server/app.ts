import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type Database from "better-sqlite3";
import type { AppConfig } from "../../config.js";
import { createDashboardRoutes } from "./routes/dashboard.js";
import { createApiRoutes } from "./routes/api.js";

export function createApp(config: AppConfig, db: Database.Database): Hono {
  const app = new Hono();

  // Static files
  app.use("/public/*", serveStatic({ root: "./" }));

  // Dashboard HTML routes
  app.route("/", createDashboardRoutes(config, db));

  // API routes
  app.route("/api", createApiRoutes(config, db));

  return app;
}
