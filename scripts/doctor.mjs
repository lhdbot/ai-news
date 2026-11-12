#!/usr/bin/env node
/**
 * 本地自检：数据、索引、digest、摘要队列、任务状态、信源健康、代理与站点。
 * 用法: npm run doctor
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const results = [];
const add = (name, level, detail) => results.push({ name, level, detail });

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

function days() {
  try {
    return fs
      .readdirSync(path.join(ROOT, "data", "news"))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

async function proxyReachable() {
  try {
    // 本地 HTTP 代理对普通请求会返回 400/407；只要能连上并收到响应就算可达
    await fetch("http://127.0.0.1:7897", { signal: AbortSignal.timeout(800) });
    return true;
  } catch {
    return false;
  }
}

const major = Number(process.versions.node.split(".")[0]);
add("Node 版本", major >= 22 ? "OK" : "FAIL", process.versions.node + "（要求 >=22）");

const dates = days();
add("日报数据", dates.length > 0 ? "OK" : "FAIL", dates.length + ` 天（最新 ${dates[0] ?? "—"}）`);
if (dates[0]) {
  const daily = readJson(`data/news/${dates[0]}.json`);
  const items = daily?.items?.length ?? 0;
  const summarized = (daily?.items ?? []).filter((item) => item.summarized).length;
  add("最新日报", items > 0 ? "OK" : "WARN", `${dates[0]} · ${items} 条 · 已摘要 ${summarized}`);
  const digest = readJson(`data/digests/${dates[0]}.json`);
  add("每日精选", digest ? "OK" : "WARN", digest ? `${digest.items.length}/${digest.total} 条` : "未生成（node scripts/build-digest.mjs）");
  const quality = readJson(`data/quality/${dates[0]}.json`);
  add("质量报告", quality ? "OK" : "WARN", quality ? `摘要 ${Math.round(quality.summarizedRate * 100)}% · 重复 ${Math.round(quality.duplicateRate * 100)}%` : "未生成（node scripts/quality-report.mjs）");
}

const urls = readJson("data/index/urls.json");
add("URL 索引", urls ? "OK" : "WARN", urls ? `${Object.keys(urls.urls ?? {}).length} 个 URL` : "未生成（node scripts/rebuild-url-index.mjs）");
const events = readJson("data/index/events.json");
add("事件索引", events ? "OK" : "WARN", events ? `${Object.keys(events.events ?? {}).length} 个事件` : "未生成（node scripts/rebuild-event-index.mjs）");

const queue = readJson("data/state/summary-queue.json");
const queueItems = queue?.items ?? [];
const due = queueItems.filter((item) => Date.parse(item.nextRetryAt) <= Date.now()).length;
add("摘要队列", queueItems.length <= 50 ? "OK" : "WARN", `${queueItems.length} 条（到期 ${due}）`);

const health = readJson("data/state/source-health.json") ?? {};
const values = Object.values(health);
const ok = values.reduce((sum, value) => sum + (value.okCount ?? 0), 0);
const fail = values.reduce((sum, value) => sum + (value.failCount ?? 0), 0);
const failing = Object.entries(health).filter(([, value]) => (value.consecutiveFailDays ?? 0) >= 3);
add("信源健康", failing.length === 0 ? "OK" : "WARN", `${values.length} 源 · 累计成功率 ${ok + fail ? Math.round((ok / (ok + fail)) * 100) : 0}% · 连续失败≥3天 ${failing.length}`);

const jobStatuses = [];
try {
  for (const file of fs.readdirSync(path.join(ROOT, "data", "state", "jobs"))) {
    if (file.endsWith(".json")) jobStatuses.push(readJson(`data/state/jobs/${file}`));
  }
} catch { /* ignore */ }
const badJobs = jobStatuses.filter((job) => job && job.status !== "ok");
add("任务状态", badJobs.length === 0 ? "OK" : "WARN", `${jobStatuses.length} 个任务 · 非 ok ${badJobs.length}`);

const proxyOk = await proxyReachable();
add("本地代理", proxyOk ? "OK" : "WARN", proxyOk ? "127.0.0.1:7897 可达" : "不可达（失败源将无法回退）");

try {
  const response = await fetch("http://127.0.0.1:3000/api/health", { signal: AbortSignal.timeout(3000) });
  const data = await response.json();
  add("站点 /api/health", response.ok ? "OK" : "WARN", response.ok ? `${data.news?.items ?? 0} 条 · digest ${data.digest?.items ?? 0}` : `HTTP ${response.status}`);
} catch {
  add("站点 /api/health", "WARN", "未响应（站点可能未启动）");
}

console.log("ai-news doctor\n");
for (const item of results) {
  const mark = item.level === "OK" ? "✓" : item.level === "WARN" ? "!" : "✗";
  console.log(`  ${mark} ${item.name.padEnd(14)} ${item.detail}`);
}
const failed = results.filter((item) => item.level === "FAIL").length;
const warned = results.filter((item) => item.level === "WARN").length;
console.log(`\n结果：${results.length - failed - warned} OK · ${warned} WARN · ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
