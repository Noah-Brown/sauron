import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";

export const digitaloceanCollector: Collector = {
  name: "digitalocean",

  isEnabled(site: SiteConfig): boolean {
    return !!site.digitalocean?.dropletId;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const dropletId = site.digitalocean!.dropletId;
    const token = app.digitaloceanToken;

    if (!token) return { collector: "digitalocean", site: site.id, success: false, message: "No DO token" };

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Get droplet info
    const dropletRes = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, { headers });
    if (!dropletRes.ok) throw new Error(`DO API: ${dropletRes.status} ${await dropletRes.text()}`);

    const dropletData = (await dropletRes.json()) as {
      droplet: {
        status: string;
        vcpus: number;
        memory: number;
        disk: number;
        region: { slug: string };
      };
    };

    const droplet = dropletData.droplet;

    // Get bandwidth metrics for the date
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    let cpuPct = 0;
    let memPct = 0;

    try {
      // DO CPU metrics return cumulative CPU time per mode (idle, user, system, etc.)
      // Values are counters (like /proc/stat). To get %, compute rate of change between
      // first and last sample: used% = (1 - delta_idle / delta_total) * 100
      const cpuRes = await fetch(
        `https://api.digitalocean.com/v2/monitoring/metrics/droplet/cpu?host_id=${dropletId}&start=${start}&end=${end}`,
        { headers }
      );
      if (cpuRes.ok) {
        const cpuData = (await cpuRes.json()) as {
          data?: { result?: Array<{ metric?: { mode?: string }; values?: Array<[number, string]> }> };
        };
        const results = cpuData.data?.result ?? [];

        // Sum the delta (last - first) for each mode to get total CPU time in the period
        let totalDelta = 0;
        let idleDelta = 0;
        for (const series of results) {
          const vals = series.values ?? [];
          if (vals.length < 2) continue;
          const first = parseFloat(vals[0][1]);
          const last = parseFloat(vals[vals.length - 1][1]);
          const delta = last - first;
          totalDelta += delta;
          if (series.metric?.mode === "idle") {
            idleDelta = delta;
          }
        }
        if (totalDelta > 0) {
          cpuPct = Math.round(((totalDelta - idleDelta) / totalDelta) * 10000) / 100;
        }
      }

      // DO memory_free returns bytes free. Compute used % from total.
      const memTotalRes = await fetch(
        `https://api.digitalocean.com/v2/monitoring/metrics/droplet/memory_total?host_id=${dropletId}&start=${start}&end=${end}`,
        { headers }
      );
      const memFreeRes = await fetch(
        `https://api.digitalocean.com/v2/monitoring/metrics/droplet/memory_free?host_id=${dropletId}&start=${start}&end=${end}`,
        { headers }
      );
      if (memTotalRes.ok && memFreeRes.ok) {
        const memTotalData = (await memTotalRes.json()) as {
          data?: { result?: Array<{ values?: Array<[number, string]> }> };
        };
        const memFreeData = (await memFreeRes.json()) as {
          data?: { result?: Array<{ values?: Array<[number, string]> }> };
        };
        const totalValues = memTotalData.data?.result?.[0]?.values ?? [];
        const freeValues = memFreeData.data?.result?.[0]?.values ?? [];
        if (totalValues.length > 0 && freeValues.length > 0) {
          const avgTotal = totalValues.reduce((sum, v) => sum + parseFloat(v[1]), 0) / totalValues.length;
          const avgFree = freeValues.reduce((sum, v) => sum + parseFloat(v[1]), 0) / freeValues.length;
          if (avgTotal > 0) {
            memPct = Math.round(((avgTotal - avgFree) / avgTotal) * 10000) / 100;
          }
        }
      }
    } catch {
      // Metrics might not be available — that's fine, we still have status
    }

    db.prepare(`
      INSERT INTO digitalocean_stats (date, site_id, app_status, last_deployment_status, last_deployment_at, cpu_percentage, memory_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      date,
      site.id,
      droplet.status,
      "",
      "",
      cpuPct,
      memPct
    );

    return {
      collector: "digitalocean",
      site: site.id,
      success: true,
      message: `Droplet ${droplet.status}, CPU ${cpuPct}%, Mem ${memPct}%`,
      data: { status: droplet.status, cpuPct, memPct },
    };
  },
};
