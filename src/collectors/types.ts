import type Database from "better-sqlite3";
import type { SiteConfig, AppConfig } from "../../config.js";

export interface CollectorConfig {
  site: SiteConfig;
  app: AppConfig;
  date: string; // YYYY-MM-DD
}

export interface CollectorResult {
  collector: string;
  site: string;
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export interface Collector {
  name: string;
  isEnabled(siteConfig: SiteConfig): boolean;
  collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult>;
}
