/* eslint-disable react-hooks/purity -- 服务端健康页需要读取当前时间做“到期/新鲜度”计算 */
import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { getAllDates, getNewsByDate } from "@/lib/news";

export const metadata: Metadata = {
  title: "运行状态",
  alternates: { canonical: "/health" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface JobStatus {
  job: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number | null;
  error?: string;
}

interface SourceHealth {
  lastOk?: string | null;
  lastFail?: string | null;
  consecutiveFailDays?: number;
  okCount?: number;
  failCount?: number;
  lastError?: string;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function statusColor(status: string): string {
  if (status === "ok") return "text-emerald-300";
  if (status === "running") return "text-accent";
  if (status === "failed") return "text-rose-300";
  return "text-muted";
}

export default function HealthPage() {
  const root = process.cwd();
  const jobsDir = path.join(root, "data", "state", "jobs");
  let jobs: JobStatus[] = [];
  try {
    jobs = fs
      .readdirSync(jobsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJson<JobStatus>(path.join(jobsDir, f)))
      .filter((j): j is JobStatus => Boolean(j))
      .sort((a, b) => String(b.finishedAt ?? b.startedAt).localeCompare(String(a.finishedAt ?? a.startedAt)));
  } catch {
    jobs = [];
  }

  const health = readJson<Record<string, SourceHealth>>(path.join(root, "data", "state", "source-health.json")) ?? {};
  const queue = readJson<{ items: { date: string; id: string; attempts: number; nextRetryAt: string; lastError: string }[] }>(
    path.join(root, "data", "state", "summary-queue.json"),
  ) ?? { items: [] };
  const lastSuccess = readJson<{ ts: string }>(path.join(root, "data", "state", "last-success.json"));
  const lastAgeH = lastSuccess?.ts ? (Date.now() - Date.parse(lastSuccess.ts)) / 3600e3 : null;

  const dates = getAllDates();
  const latest = dates[0];
  const daily = latest ? getNewsByDate(latest) : null;
  const digestFile = latest ? path.join(root, "data", "digests", `${latest}.json`) : "";
  const digest = digestFile ? readJson<{ items: unknown[]; total: number }>(digestFile) : null;
  const qualityFile = latest ? path.join(root, "data", "quality", `${latest}.json`) : "";
  const reviewFile = latest ? path.join(root, "data", "quality", "reviews", `${latest}.json`) : "";
  const reviewsDir = path.join(root, "data", "quality", "reviews");
  let reviewHistory: {
    date: string;
    count: number;
    averages: { accuracy: number; density: number; readability: number; actionability: number };
  }[] = [];
  try {
    reviewHistory = fs
      .readdirSync(reviewsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const data = readJson<{
          count: number;
          averages: { accuracy: number; density: number; readability: number; actionability: number };
        }>(path.join(reviewsDir, f));
        return data ? { date: f.slice(0, -5), ...data } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  } catch {
    reviewHistory = [];
  }

  const review = reviewFile
    ? readJson<{ count: number; averages: { accuracy: number; density: number; readability: number; actionability: number } }>(reviewFile)
    : null;
  const quality = qualityFile
    ? readJson<{
        summarizedRate: number;
        duplicateRate: number;
        events: number;
        multiSourceEvents: number;
        digestItems: number;
        digestTotal: number;
        sourceSuccessRate: number | null;
      }>(qualityFile)
    : null;

  const failing = Object.entries(health).filter(([, v]) => (v.consecutiveFailDays ?? 0) >= 3);
  const okTotal = Object.values(health).reduce((sum, v) => sum + (v.okCount ?? 0), 0);
  const failTotal = Object.values(health).reduce((sum, v) => sum + (v.failCount ?? 0), 0);
  const successRate = okTotal + failTotal > 0 ? Math.round((okTotal / (okTotal + failTotal)) * 100) : null;
  const topFailing = Object.entries(health)
    .filter(([, v]) => (v.failCount ?? 0) > 0)
    .sort((a, b) => (b[1].failCount ?? 0) - (a[1].failCount ?? 0))
    .slice(0, 5);
  const recentFailures = Object.entries(health)
    .filter(([, v]) => v.lastFail)
    .sort((a, b) => String(b[1].lastFail).localeCompare(String(a[1].lastFail)))
    .slice(0, 8);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">运行状态</h1>
      <p className="mt-2 text-sm text-muted">仅本地可见 · 数据来自 data/state 与 logs/app.jsonl</p>

      <section className="mt-8">
        <h2 className="text-lg font-bold">任务</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3">任务</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">开始</th>
                <th className="px-4 py-3">结束</th>
                <th className="px-4 py-3">耗时</th>
                <th className="px-4 py-3">错误</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-muted">还没有任务状态（下次巡检开始记录）</td></tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.job} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{job.job}</td>
                    <td className={`px-4 py-2.5 ${statusColor(job.status)}`}>{job.status}</td>
                    <td className="px-4 py-2.5 text-muted">{fmt(job.startedAt)}</td>
                    <td className="px-4 py-2.5 text-muted">{fmt(job.finishedAt)}</td>
                    <td className="px-4 py-2.5 text-muted">{job.durationMs ? Math.round(job.durationMs / 1000) + "s" : "—"}</td>
                    <td className="px-4 py-2.5 text-rose-300/80">{job.error || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-bold">数据新鲜度</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>最近成功抓取：{fmt(lastSuccess?.ts)}（{lastAgeH === null ? "未知" : Math.round(lastAgeH) + " 小时前"}）</li>
            <li>最新日报：{latest ?? "—"} · {daily?.items.length ?? 0} 条</li>
            <li>今日精选：{digest ? `${digest.items.length} / ${digest.total} 条` : "未生成"}</li>
            <li>
              内容质量：
              {quality
                ? `摘要 ${Math.round(quality.summarizedRate * 100)}% · 重复 ${Math.round(quality.duplicateRate * 100)}% · 事件 ${quality.events}（多源 ${quality.multiSourceEvents}）· digest ${quality.digestItems}/${quality.digestTotal}`
                : "尚未生成（运行 quality-report.mjs）"}
            </li>
            <li>
              语义抽检：
              {review?.averages
                ? `准确 ${review.averages.accuracy} · 密度 ${review.averages.density} · 可读 ${review.averages.readability} · 行动 ${review.averages.actionability}（${review.count} 条）`
                : "尚未抽检（运行 quality-sample.mjs）"}
            </li>
            <li>摘要队列：{queue.items.length} 条（到期 {queue.items.filter((i) => Date.parse(i.nextRetryAt) <= Date.now()).length} 条）</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-bold">信源健康</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>连续失败 ≥3 天：{failing.length} 个</li>
            <li>累计成功 / 失败：{okTotal} / {failTotal}{successRate === null ? "" : `（成功率 ${successRate}%）`}</li>
            {topFailing.map(([name, v]) => (
              <li key={name} className="truncate">
                {name} · 失败 {v.failCount} 次 · {v.lastError || "—"}
              </li>
            ))}
            {recentFailures.map(([name, v]) => (
              <li key={name} className="truncate">
                {name} · 连续失败 {v.consecutiveFailDays ?? 0} 天 · 最近错误 {fmt(v.lastFail)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold">语义抽检趋势（近 7 天）</h2>
        {reviewHistory.length === 0 ? (
          <p className="mt-3 text-sm text-muted">还没有抽检数据；daily 任务会在每天 07:10 生成。</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3">日期</th>
                  <th className="px-4 py-3">准确</th>
                  <th className="px-4 py-3">密度</th>
                  <th className="px-4 py-3">可读</th>
                  <th className="px-4 py-3">行动</th>
                  <th className="px-4 py-3">条数</th>
                </tr>
              </thead>
              <tbody>
                {reviewHistory.map((item) => (
                  <tr key={item.date} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{item.date}</td>
                    <td className="px-4 py-2.5">{item.averages.accuracy}</td>
                    <td className="px-4 py-2.5">{item.averages.density}</td>
                    <td className="px-4 py-2.5">{item.averages.readability}</td>
                    <td className="px-4 py-2.5">{item.averages.actionability}</td>
                    <td className="px-4 py-2.5 text-muted">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {queue.items.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">摘要重试队列（前 20）</h2>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {queue.items.slice(0, 20).map((item) => (
              <li key={item.date + item.id}>
                {item.date} · {item.id} · 第 {item.attempts} 次 · 下次 {fmt(item.nextRetryAt)} · {item.lastError}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
