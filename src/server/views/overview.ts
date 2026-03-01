import type { AppConfig, SiteConfig } from "../../../config.js";
import { layout } from "./layout.js";

interface SiteData {
  site: SiteConfig;
  stats: Record<string, Record<string, unknown> | undefined>;
  prevStats: Record<string, Record<string, unknown> | undefined>;
}

function pctChange(current: unknown, previous: unknown): string {
  const c = Number(current ?? 0);
  const p = Number(previous ?? 0);
  if (p === 0) return c > 0 ? '<span class="delta up">+∞%</span>' : '<span class="delta">—</span>';
  const pct = ((c - p) / p) * 100;
  const cls = pct >= 0 ? "up" : "down";
  const sign = pct >= 0 ? "+" : "";
  return `<span class="delta ${cls}">${sign}${pct.toFixed(1)}%</span>`;
}

function metric(label: string, value: unknown, prev?: unknown): string {
  const v = value ?? "—";
  const change = prev !== undefined ? pctChange(value, prev) : "";
  return `<div class="metric"><span class="metric-value">${v}</span>${change}<span class="metric-label">${label}</span></div>`;
}

function siteCard(data: SiteData): string {
  const { site, stats, prevStats } = data;

  let metrics = "";

  if (stats.cloudflare) {
    metrics += metric("Visitors", stats.cloudflare.unique_visitors, prevStats.cloudflare?.unique_visitors);
    metrics += metric("Requests", stats.cloudflare.requests, prevStats.cloudflare?.requests);
  }

  if (stats.ga) {
    metrics += metric("Users", stats.ga.active_users, prevStats.ga?.active_users);
    metrics += metric("Sessions", stats.ga.sessions, prevStats.ga?.sessions);
  }

  if (stats.gsc) {
    metrics += metric("Clicks", stats.gsc.clicks, prevStats.gsc?.clicks);
    metrics += metric("Impressions", stats.gsc.impressions, prevStats.gsc?.impressions);
  }

  if (stats.github) {
    metrics += metric("Stars", stats.github.stars, prevStats.github?.stars);
    metrics += metric("Commits", stats.github.commits_today, prevStats.github?.commits_today);
  }

  if (stats.posthog) {
    metrics += metric("Events", stats.posthog.events, prevStats.posthog?.events);
  }

  if (stats.digitalocean) {
    metrics += `<div class="metric"><span class="metric-value">${stats.digitalocean.app_status}</span><span class="metric-label">Server</span></div>`;
  }

  if (!metrics) {
    metrics = '<div class="metric"><span class="metric-value">No data</span><span class="metric-label">yet</span></div>';
  }

  return `
    <article class="site-card">
      <header>
        <a href="/site/${site.id}"><strong>${site.name}</strong></a>
        <small>${site.url}</small>
      </header>
      <div class="metrics-grid">${metrics}</div>
    </article>
  `;
}

export function overviewPage(config: AppConfig, siteData: SiteData[], date: string): string {
  const cards = siteData.map(siteCard).join("");

  return layout("Overview", `
    <hgroup>
      <h1>Dashboard</h1>
      <p>Report for ${date}</p>
    </hgroup>
    <div class="sites-grid">${cards}</div>
  `);
}
