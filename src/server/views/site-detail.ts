import type { AppConfig, SiteConfig } from "../../../config.js";
import { layout } from "./layout.js";

const COLLECTOR_CHARTS: Record<string, { label: string; metrics: string[] }> = {
  cloudflare: { label: "Cloudflare", metrics: ["unique_visitors", "requests", "page_views"] },
  "google-analytics": { label: "Google Analytics", metrics: ["active_users", "sessions", "page_views"] },
  "google-search-console": { label: "Search Console", metrics: ["clicks", "impressions"] },
  posthog: { label: "PostHog", metrics: ["events", "persons"] },
  github: { label: "GitHub", metrics: ["stars", "commits_today", "open_issues"] },
  digitalocean: { label: "DigitalOcean", metrics: ["cpu_percentage", "memory_percentage"] },
  resend: { label: "Resend", metrics: ["emails_sent", "delivered", "bounced"] },
  eas: { label: "EAS", metrics: ["builds_today", "updates_today"] },
};

function chartSection(siteId: string, collector: string, info: { label: string; metrics: string[] }): string {
  return `
    <section class="chart-section">
      <h3>${info.label}</h3>
      <canvas
        id="chart-${collector}"
        data-site="${siteId}"
        data-collector="${collector}"
        data-metrics="${info.metrics.join(",")}"
        width="600"
        height="200"
      ></canvas>
    </section>
  `;
}

export function siteDetailPage(config: AppConfig, site: SiteConfig): string {
  const charts: string[] = [];

  if (site.cloudflare) charts.push(chartSection(site.id, "cloudflare", COLLECTOR_CHARTS.cloudflare));
  if (site.googleAnalytics) charts.push(chartSection(site.id, "google-analytics", COLLECTOR_CHARTS["google-analytics"]));
  if (site.googleSearchConsole) charts.push(chartSection(site.id, "google-search-console", COLLECTOR_CHARTS["google-search-console"]));
  if (site.posthog) charts.push(chartSection(site.id, "posthog", COLLECTOR_CHARTS.posthog));
  if (site.github) charts.push(chartSection(site.id, "github", COLLECTOR_CHARTS.github));
  if (site.digitalocean) charts.push(chartSection(site.id, "digitalocean", COLLECTOR_CHARTS.digitalocean));
  if (site.resend) charts.push(chartSection(site.id, "resend", COLLECTOR_CHARTS.resend));
  if (site.eas) charts.push(chartSection(site.id, "eas", COLLECTOR_CHARTS.eas));

  return layout(site.name, `
    <hgroup>
      <h1>${site.name}</h1>
      <p><a href="${site.url}">${site.url}</a> — 30-day trends</p>
    </hgroup>
    <p><a href="/">&larr; Back to overview</a></p>
    ${charts.join("")}
  `);
}
