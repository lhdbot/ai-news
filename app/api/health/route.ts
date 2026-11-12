import fs from "node:fs";
import path from "node:path";
import { apiJson } from "@/lib/api";
import { getDigest } from "@/lib/digest";
import { getAllDates, getNewsByDate } from "@/lib/news";

export const dynamic = "force-dynamic";

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function GET(): Response {
  const root = process.cwd();
  const dates = getAllDates();
  const latest = dates[0];
  const daily = latest ? getNewsByDate(latest) : null;
  const digest = latest ? getDigest(latest) : null;
  const lastSuccess = readJson<{ ts: string }>(path.join(root, "data", "state", "last-success.json"));
  const queue = readJson<{ items: { nextRetryAt: string }[] }>(
    path.join(root, "data", "state", "summary-queue.json"),
  );
  const health =
    readJson<Record<string, { okCount?: number; failCount?: number; consecutiveFailDays?: number; cachedCount?: number }>>(
      path.join(root, "data", "state", "source-health.json"),
    ) ?? {};
  const quality = latest
    ? readJson<Record<string, unknown>>(path.join(root, "data", "quality", `${latest}.json`))
    : null;

  let jobs: Record<string, unknown>[] = [];
  try {
    const jobsDir = path.join(root, "data", "state", "jobs");
    jobs = fs
      .readdirSync(jobsDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson<Record<string, unknown>>(path.join(jobsDir, file)))
      .filter((job): job is Record<string, unknown> => Boolean(job));
  } catch {
    jobs = [];
  }

  const sourceValues = Object.values(health);
  const okCount = sourceValues.reduce((sum, value) => sum + (value.okCount ?? 0), 0);
  const failCount = sourceValues.reduce((sum, value) => sum + (value.failCount ?? 0), 0);
  const queueItems = queue?.items ?? [];
  const due = queueItems.filter((item) => {
    const t = item.nextRetryAt ? Date.parse(item.nextRetryAt) : 0;
    return Number.isNaN(t) || t <= Date.now();
  }).length;

  return apiJson({
    ok: Boolean(daily),
    generatedAt: new Date().toISOString(),
    lastSuccess: lastSuccess?.ts ?? null,
    news: daily
      ? {
          date: daily.date,
          items: daily.items.length,
          summarized: daily.items.filter((item) => item.summarized).length,
        }
      : null,
    digest: digest
      ? { date: digest.date, items: digest.items.length, total: digest.total }
      : null,
    queue: { total: queueItems.length, due },
    sources: {
      total: sourceValues.length,
      okCount,
      failCount,
      successRate: okCount + failCount > 0 ? Math.round((okCount / (okCount + failCount)) * 1000) / 10 : null,
      failing: Object.entries(health)
        .filter(([, value]) => (value.consecutiveFailDays ?? 0) >= 3)
        .map(([name]) => name),
      cachedCount: sourceValues.reduce((sum, value) => sum + (value.cachedCount ?? 0), 0),
    },
    jobs,
    quality,
  });
}
