import dotenv from "dotenv";
dotenv.config();

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing env var: ${key}`);
  return val;
}

function optEnv(key: string): string | undefined {
  return process.env[key];
}

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  cloudflare?: { zoneId: string; };
  googleAnalytics?: { propertyId: string; };
  googleSearchConsole?: { siteUrl: string; };
  posthog?: { projectId: string; };
  github?: { repo: string; }; // "owner/repo"
  digitalocean?: { dropletId: string; };
  eas?: { projectId: string; };
  resend?: { audienceId?: string; };
}

export interface AppConfig {
  port: number;
  cronSchedule: string;
  sites: SiteConfig[];
  // API keys (shared across sites)
  cloudflareApiToken?: string;
  githubToken?: string;
  googleServiceAccountEmail?: string;
  googleServiceAccountKey?: string;
  posthogApiKey?: string;
  posthogHost?: string;
  digitaloceanToken?: string;
  easToken?: string;
  resendApiKey?: string;
  resendFromEmail: string;
  resendToEmail: string;
  dashboardUrl: string;
  dbPath: string;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(optEnv("PORT") ?? "3333", 10),
    cronSchedule: optEnv("CRON_SCHEDULE") ?? "0 8 * * *", // 8 AM daily
    dbPath: optEnv("DB_PATH") ?? "data/sauron.db",
    dashboardUrl: optEnv("DASHBOARD_URL") ?? "http://localhost:3333",

    // API keys
    cloudflareApiToken: optEnv("CLOUDFLARE_API_TOKEN"),
    githubToken: optEnv("GITHUB_TOKEN"),
    googleServiceAccountEmail: optEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    googleServiceAccountKey: optEnv("GOOGLE_SERVICE_ACCOUNT_KEY"),
    posthogApiKey: optEnv("POSTHOG_API_KEY"),
    posthogHost: optEnv("POSTHOG_HOST") ?? "https://us.posthog.com",
    digitaloceanToken: optEnv("DIGITALOCEAN_TOKEN"),
    easToken: optEnv("EAS_TOKEN"),
    resendApiKey: optEnv("RESEND_API_KEY"),
    resendFromEmail: env("RESEND_FROM_EMAIL", "Sauron <reports@example.com>"),
    resendToEmail: env("RESEND_TO_EMAIL", "you@example.com"),

    sites: loadSites(),
  };
}

function loadSites(): SiteConfig[] {
  // Sites are defined via SITES env var as JSON, or fall back to a default empty array.
  // Format: SITES='[{"id":"mysite","name":"My Site","url":"https://mysite.com",...}]'
  const sitesJson = optEnv("SITES");
  if (sitesJson) {
    return JSON.parse(sitesJson);
  }

  // Default example site (won't collect anything unless env vars are set)
  return [];
}
