import type Database from "better-sqlite3";
import type { SiteConfig } from "../../config.js";
import type { Collector, CollectorConfig, CollectorResult } from "./types.js";
import { logger } from "../utils/logger.js";

async function fetchGitHub(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export const githubCollector: Collector = {
  name: "github",

  isEnabled(site: SiteConfig): boolean {
    return !!site.github?.repo;
  },

  async collect(config: CollectorConfig, db: Database.Database): Promise<CollectorResult> {
    const { site, app, date } = config;
    const token = app.githubToken;
    if (!token) return { collector: "github", site: site.id, success: false, message: "No GitHub token" };

    const repo = site.github!.repo;

    // Fetch repo info
    const repoData = (await fetchGitHub(`/repos/${repo}`, token)) as {
      stargazers_count: number;
      open_issues_count: number;
    };

    // Fetch open PRs count
    const prs = (await fetchGitHub(`/repos/${repo}/pulls?state=open&per_page=1`, token)) as unknown[];
    // GitHub returns open_issues_count which includes PRs, so get separate PR count
    const openPrs = prs.length; // We'll use the Link header for count, but simplify here

    // Fetch PRs with pagination to get actual count
    const prsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    let openPrCount = 0;
    const linkHeader = prsRes.headers.get("link");
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) openPrCount = parseInt(lastMatch[1], 10);
    } else {
      openPrCount = ((await prsRes.json()) as unknown[]).length;
    }

    // Fetch commits from yesterday
    const since = `${date}T00:00:00Z`;
    const until = `${date}T23:59:59Z`;
    const commits = (await fetchGitHub(
      `/repos/${repo}/commits?since=${since}&until=${until}&per_page=100`,
      token
    )) as unknown[];

    // Fetch deployments from yesterday
    const deployments = (await fetchGitHub(
      `/repos/${repo}/deployments?per_page=100`,
      token
    )) as { created_at: string }[];
    const deploymentsToday = deployments.filter(
      (d) => d.created_at.startsWith(date)
    ).length;

    const openIssues = repoData.open_issues_count - openPrCount;

    db.prepare(`
      INSERT INTO github_stats (date, site_id, stars, open_issues, open_prs, commits_today, deployments_today)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(date, site.id, repoData.stargazers_count, openIssues, openPrCount, commits.length, deploymentsToday);

    return {
      collector: "github",
      site: site.id,
      success: true,
      message: `${repoData.stargazers_count} stars, ${commits.length} commits, ${deploymentsToday} deploys`,
      data: { stars: repoData.stargazers_count, commits: commits.length, deployments: deploymentsToday },
    };
  },
};
