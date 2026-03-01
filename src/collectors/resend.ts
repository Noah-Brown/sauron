import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

export const resendCollector: Collector = {
  name: "resend",

  isEnabled(site: SiteConfig): boolean {
    return !!site.resend;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const apiKey = app.resendApiKey;

    if (!apiKey) return { collector: "resend", site: site.id, success: false, message: "No Resend API key" };

    // Fetch emails list for the date range
    // Resend API: GET /emails — but it doesn't have a date filter natively.
    // We'll use the batch approach: fetch recent emails and filter by date.
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Use the Resend API to get domain-level stats if available
    // Fallback: query recent emails and count by status
    const res = await fetch("https://api.resend.com/emails", { headers });
    if (!res.ok) throw new Error(`Resend API: ${res.status} ${await res.text()}`);

    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        created_at: string;
        status: string;
      }>;
    };

    const emails = json.data ?? [];
    const todayEmails = emails.filter((e) => e.created_at.startsWith(date));

    const stats = {
      sent: todayEmails.length,
      delivered: todayEmails.filter((e) => e.status === "delivered").length,
      bounced: todayEmails.filter((e) => e.status === "bounced").length,
      complained: todayEmails.filter((e) => e.status === "complained").length,
    };

    db.prepare(`
      INSERT INTO resend_stats (date, site_id, emails_sent, delivered, bounced, complained)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date, site.id, stats.sent, stats.delivered, stats.bounced, stats.complained);

    return {
      collector: "resend",
      site: site.id,
      success: true,
      message: `${stats.sent} sent, ${stats.delivered} delivered`,
      data: stats,
    };
  },
};
