#!/usr/bin/env node
/**
 * 每日内容质量报告（纯计算，不调用 LLM）：
 * 摘要完成率、跨天重复率、事件数/多源事件、digest 覆盖率、分类分布、信源成功率。
 * 写入 data/quality/YYYY-MM-DD.json，/health 会展示最新一份。
 *
 * 用法: node scripts/quality-report.mjs [--date=YYYY-MM-DD]
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './lib/fs-atomic.mjs';
import { loadEventIndex } from './lib/events.mjs';
import { loadUrlIndex, normalizeUrl } from './lib/url-index.mjs';

const ROOT = process.cwd();
const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const date = dateArg ? dateArg.split('=')[1] : beijingToday();

const dailyFile = path.join(ROOT, 'data', 'news', `${date}.json`);
if (!fs.existsSync(dailyFile)) {
  console.log(`[skip] ${dailyFile} 不存在`);
  process.exit(0);
}
const daily = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
const items = Array.isArray(daily.items) ? daily.items : [];
const urlIndex = loadUrlIndex(path.join(ROOT, 'data', 'index', 'urls.json'));
const eventIndex = loadEventIndex(path.join(ROOT, 'data', 'index', 'events.json'));
let health = {};
try { health = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'state', 'source-health.json'), 'utf8')); } catch { /* ignore */ }

let digest = null;
try { digest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'digests', `${date}.json`), 'utf8')); } catch { /* not built yet */ }

const newItems = items.filter((item) => {
  const rec = urlIndex.urls[normalizeUrl(item.url)];
  return rec && rec.firstSeenAt === date;
}).length;
const summarized = items.filter((item) => item.summarized).length;
const eventIds = new Set(items.map((item) => item.eventId).filter(Boolean));
const multiSourceEvents = [...eventIds].filter((id) => (eventIndex.events[id]?.sources?.length ?? 0) > 1).length;
const categories = {};
for (const item of items) categories[item.category] = (categories[item.category] || 0) + 1;
const summaryLengths = items.map((item) => (item.summary_zh || '').length).filter((n) => n > 0);
const okCount = Object.values(health).reduce((sum, s) => sum + (s.okCount || 0), 0);
const failCount = Object.values(health).reduce((sum, s) => sum + (s.failCount || 0), 0);

const report = {
  date,
  generated_at: new Date().toISOString(),
  items: items.length,
  summarized,
  summarizedRate: items.length ? summarized / items.length : 0,
  newItems,
  duplicateItems: items.length - newItems,
  duplicateRate: items.length ? (items.length - newItems) / items.length : 0,
  events: eventIds.size,
  multiSourceEvents,
  digestItems: Array.isArray(digest?.items) ? digest.items.length : 0,
  digestTotal: items.length,
  digestCoverage: items.length && Array.isArray(digest?.items) ? digest.items.length / items.length : 0,
  categories,
  avgSummaryLength: summaryLengths.length
    ? Math.round(summaryLengths.reduce((a, b) => a + b, 0) / summaryLengths.length)
    : 0,
  sourceOk: okCount,
  sourceFail: failCount,
  sourceSuccessRate: okCount + failCount ? okCount / (okCount + failCount) : null,
};

const outFile = path.join(ROOT, 'data', 'quality', `${date}.json`);
writeFileAtomic(outFile, JSON.stringify(report, null, 2) + '\n');

const pct = (n) => Math.round(n * 100) + '%';
console.log(
  `[ok] quality ${date}: 摘要 ${pct(report.summarizedRate)} · 重复 ${pct(report.duplicateRate)} · ` +
  `事件 ${report.events}（多源 ${report.multiSourceEvents}）· digest ${report.digestItems}/${report.digestTotal}`,
);
