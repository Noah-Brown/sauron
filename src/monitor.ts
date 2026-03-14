import { Resend } from "resend";
import type { AppConfig } from "../config.js";
import { logger } from "./utils/logger.js";

interface SiteState {
  isDown: boolean;
}

const siteStates = new Map<string, SiteState>();

async function checkSite(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Sauron-Monitor/1.0" },
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function sendAlert(
  config: AppConfig,
  url: string,
  type: "down" | "recovered",
  error?: string
): Promise<void> {
  if (!config.resendApiKey) {
    logger.warn("No Resend API key — skipping monitor alert");
    return;
  }

  const resend = new Resend(config.resendApiKey);
  const now = new Date().toISOString();

  const isDown = type === "down";
  const subject = isDown ? `[ALERT] ${url} is DOWN` : `[RECOVERED] ${url} is back UP`;
  const html = `
    <div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;">
      <h1 style="color:${isDown ? "#ef4444" : "#22c55e"};">${isDown ? "Site Down" : "Site Recovered"}</h1>
      <p><strong>URL:</strong> ${url}</p>
      <p><strong>Time:</strong> ${now}</p>
      ${error ? `<p><strong>Error:</strong> ${error}</p>` : ""}
    </div>
  `;

  try {
    await resend.emails.send({
      from: config.resendFromEmail,
      to: [config.resendToEmail],
      subject,
      html,
    });
    logger.info(`Monitor alert sent: ${subject}`);
  } catch (err) {
    logger.error("Failed to send monitor alert:", err);
  }
}

async function pollSites(config: AppConfig): Promise<void> {
  for (const url of config.monitorSites) {
    const result = await checkSite(url);
    const state = siteStates.get(url) ?? { isDown: false };

    if (!result.ok && !state.isDown) {
      // Transition: up → down
      logger.warn(`Monitor: ${url} is DOWN — ${result.error}`);
      state.isDown = true;
      siteStates.set(url, state);
      await sendAlert(config, url, "down", result.error);
    } else if (result.ok && state.isDown) {
      // Transition: down → up
      logger.info(`Monitor: ${url} is back UP`);
      state.isDown = false;
      siteStates.set(url, state);
      await sendAlert(config, url, "recovered");
    } else if (result.ok) {
      logger.info(`Monitor: ${url} is UP`);
    } else {
      logger.warn(`Monitor: ${url} still DOWN — ${result.error}`);
    }
  }
}

export function startMonitor(config: AppConfig): void {
  if (config.monitorSites.length === 0) {
    logger.info("No monitor sites configured — skipping uptime monitor");
    return;
  }

  const intervalMin = config.monitorIntervalMs / 60_000;
  logger.info(`Starting uptime monitor for ${config.monitorSites.join(", ")} (every ${intervalMin}min)`);

  // Run immediately on startup
  pollSites(config).catch((err) => logger.error("Monitor poll failed:", err));

  // Then on interval
  setInterval(() => {
    pollSites(config).catch((err) => logger.error("Monitor poll failed:", err));
  }, config.monitorIntervalMs);
}
