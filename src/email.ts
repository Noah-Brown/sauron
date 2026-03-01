import { Resend } from "resend";
import type Database from "better-sqlite3";
import type { AppConfig } from "../config.js";
import type { CollectorResult } from "./collectors/types.js";
import { logger } from "./utils/logger.js";

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+∞%" : "—";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function getYesterdayAndDayBefore(date: string): { yesterday: string; dayBefore: string } {
  const d = new Date(date);
  const dayBefore = new Date(d);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return {
    yesterday: date,
    dayBefore: dayBefore.toISOString().split("T")[0],
  };
}

interface StatRow {
  [key: string]: unknown;
}

function getStats(db: Database.Database, table: string, siteId: string, date: string): StatRow | undefined {
  return db.prepare(`SELECT * FROM ${table} WHERE site_id = ? AND date = ?`).get(siteId, date) as StatRow | undefined;
}

function buildSiteSection(db: Database.Database, siteId: string, siteName: string, date: string, results: CollectorResult[]): string {
  const { yesterday, dayBefore } = getYesterdayAndDayBefore(date);
  const siteResults = results.filter((r) => r.site === siteId);
  if (siteResults.length === 0) return "";

  let html = `<h2 style="margin:24px 0 12px;color:#1a1a2e;border-bottom:2px solid #e0e0e0;padding-bottom:8px;">${siteName}</h2>`;

  // Cloudflare
  const cf = getStats(db, "cloudflare_stats", siteId, yesterday);
  const cfPrev = getStats(db, "cloudflare_stats", siteId, dayBefore);
  if (cf) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Visitors</strong></td><td style="padding:6px 12px;">${cf.unique_visitors}</td><td style="padding:6px 12px;color:${Number(cf.unique_visitors) >= Number(cfPrev?.unique_visitors ?? 0) ? '#22c55e' : '#ef4444'}">${pctChange(Number(cf.unique_visitors), Number(cfPrev?.unique_visitors ?? 0))}</td></tr>
      <tr><td style="padding:6px 12px;"><strong>Requests</strong></td><td style="padding:6px 12px;">${cf.requests}</td><td style="padding:6px 12px;">${pctChange(Number(cf.requests), Number(cfPrev?.requests ?? 0))}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Page Views</strong></td><td style="padding:6px 12px;">${cf.page_views}</td><td style="padding:6px 12px;">${pctChange(Number(cf.page_views), Number(cfPrev?.page_views ?? 0))}</td></tr>
    </table>`;
  }

  // Google Analytics
  const ga = getStats(db, "ga_stats", siteId, yesterday);
  const gaPrev = getStats(db, "ga_stats", siteId, dayBefore);
  if (ga) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Active Users</strong></td><td style="padding:6px 12px;">${ga.active_users}</td><td style="padding:6px 12px;">${pctChange(Number(ga.active_users), Number(gaPrev?.active_users ?? 0))}</td></tr>
      <tr><td style="padding:6px 12px;"><strong>Sessions</strong></td><td style="padding:6px 12px;">${ga.sessions}</td><td style="padding:6px 12px;">${pctChange(Number(ga.sessions), Number(gaPrev?.sessions ?? 0))}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Bounce Rate</strong></td><td style="padding:6px 12px;">${Number(ga.bounce_rate).toFixed(1)}%</td><td></td></tr>
    </table>`;
  }

  // GSC
  const gsc = getStats(db, "gsc_stats", siteId, yesterday);
  const gscPrev = getStats(db, "gsc_stats", siteId, dayBefore);
  if (gsc) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Search Clicks</strong></td><td style="padding:6px 12px;">${gsc.clicks}</td><td style="padding:6px 12px;">${pctChange(Number(gsc.clicks), Number(gscPrev?.clicks ?? 0))}</td></tr>
      <tr><td style="padding:6px 12px;"><strong>Impressions</strong></td><td style="padding:6px 12px;">${gsc.impressions}</td><td style="padding:6px 12px;">${pctChange(Number(gsc.impressions), Number(gscPrev?.impressions ?? 0))}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Avg Position</strong></td><td style="padding:6px 12px;">${Number(gsc.position).toFixed(1)}</td><td></td></tr>
    </table>`;
  }

  // GitHub
  const gh = getStats(db, "github_stats", siteId, yesterday);
  if (gh) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Stars</strong></td><td style="padding:6px 12px;">${gh.stars}</td></tr>
      <tr><td style="padding:6px 12px;"><strong>Commits</strong></td><td style="padding:6px 12px;">${gh.commits_today}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;"><strong>Open Issues / PRs</strong></td><td style="padding:6px 12px;">${gh.open_issues} / ${gh.open_prs}</td></tr>
    </table>`;
  }

  // DigitalOcean
  const doStats = getStats(db, "digitalocean_stats", siteId, yesterday);
  if (doStats) {
    html += `<p><strong>Server:</strong> ${doStats.app_status} | Last deploy: ${doStats.last_deployment_status} (${doStats.last_deployment_at})</p>`;
  }

  // Resend
  const rs = getStats(db, "resend_stats", siteId, yesterday);
  if (rs) {
    html += `<p><strong>Email:</strong> ${rs.emails_sent} sent, ${rs.delivered} delivered, ${rs.bounced} bounced</p>`;
  }

  // EAS
  const eas = getStats(db, "eas_stats", siteId, yesterday);
  if (eas) {
    html += `<p><strong>EAS:</strong> ${eas.builds_today} builds, ${eas.updates_today} updates | Last: ${eas.last_build_status} (${eas.last_build_platform})</p>`;
  }

  // Failures
  const failures = siteResults.filter((r) => !r.success);
  if (failures.length > 0) {
    html += `<p style="color:#ef4444;"><strong>Failures:</strong> ${failures.map((f) => `${f.collector}: ${f.message}`).join(", ")}</p>`;
  }

  return html;
}

export async function sendReport(
  config: AppConfig,
  db: Database.Database,
  results: CollectorResult[]
): Promise<void> {
  if (!config.resendApiKey) {
    logger.warn("No Resend API key — skipping email report");
    return;
  }

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const date = d.toISOString().split("T")[0];

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  let body = `
    <div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;">
      <h1 style="color:#1a1a2e;margin-bottom:4px;">Sauron Daily Report</h1>
      <p style="color:#666;margin-top:0;">${date} — ${successCount} collected${failCount > 0 ? `, ${failCount} failed` : ""}</p>
  `;

  for (const site of config.sites) {
    body += buildSiteSection(db, site.id, site.name, date, results);
  }

  body += `
      <hr style="margin:24px 0;border:none;border-top:1px solid #e0e0e0;">
      <p style="color:#999;font-size:12px;"><a href="${config.dashboardUrl}">View full dashboard</a></p>
    </div>
  `;

  const resend = new Resend(config.resendApiKey);

  try {
    await resend.emails.send({
      from: config.resendFromEmail,
      to: [config.resendToEmail],
      subject: `Sauron Report — ${date}`,
      html: body,
    });
    logger.info("Report email sent successfully");
  } catch (err) {
    logger.error("Failed to send report email:", err);
  }
}
