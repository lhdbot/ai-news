#!/usr/bin/env node
/**
 * 语义质量抽检：每天从当日摘要中取 5 条，交给本机 Kimi 按四维打分（1-5）。
 * 只依据标题/摘要/解读打分，不假装能核对原文；结果写入 data/quality/reviews/YYYY-MM-DD.json。
 *
 * 用法:
 *   node scripts/quality-sample.mjs --dry-run       # 只看会抽哪些
 *   node scripts/quality-sample.mjs [--date=...] [--force] [--count=5]
 */
import fs from 'node:fs';
import path from 'node:path';
import { callKimi, extractJson } from './lib/kimi.mjs';
import { writeFileAtomic } from './lib/fs-atomic.mjs';
import { averageScores, SCORE_KEYS, selectSample } from './lib/quality.mjs';

const ROOT = process.cwd();
const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const countArg = process.argv.find((a) => a.startsWith('--count='));
const date = dateArg ? dateArg.split('=')[1] : beijingToday();
const count = countArg ? Math.max(1, parseInt(countArg.split('=')[1], 10) || 5) : 5;
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

const dailyFile = path.join(ROOT, 'data', 'news', `${date}.json`);
if (!fs.existsSync(dailyFile)) {
  console.log(`[skip] ${dailyFile} 不存在`);
  process.exit(0);
}
const outDir = path.join(ROOT, 'data', 'quality', 'reviews');
const outFile = path.join(outDir, `${date}.json`);
if (!force && !dryRun && fs.existsSync(outFile)) {
  console.log(`[skip] ${date} 已抽检，--force 可重跑`);
  process.exit(0);
}

const daily = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
const items = Array.isArray(daily.items) ? daily.items : [];
const sample = selectSample(items, count, date);
if (sample.length === 0) {
  console.log(`[skip] ${date} 没有可抽检条目`);
  process.exit(0);
}
if (dryRun) {
  console.log(`[dry-run] ${date} 抽检 ${sample.length} 条：`);
  for (const item of sample) console.log(`- [${item.category}] ${(item.title_zh || item.title).slice(0, 50)} (${item.id})`);
  process.exit(0);
}

const payload = sample.map((item) => ({
  id: item.id,
  source: item.source,
  category: item.category,
  title: item.title_zh || item.title,
  summary: item.summary_zh,
  learn: item.learn || '',
  impact: item.impact || '',
  advice: item.advice || '',
}));

const prompt = `你是中文 AI 内容质量评审。请只根据下面给出的标题、摘要、学到/影响/建议打分（1-5 的整数），不要假设你能看到原文细节。
四个维度：
- accuracy：摘要是否与标题/来源信息一致，有无明显臆造或空话
- density：信息量，是否说清"发生了什么"
- readability：中文是否自然、通顺
- actionability：影响/建议是否具体可执行

每条输出 {id, accuracy, density, readability, actionability, reason}，reason 不超过 40 字。
只输出 JSON 数组，不要输出其他文字。

输入：
${JSON.stringify(payload, null, 1)}`;

let reviews = [];
try {
  const stdout = await callKimi(prompt, { retries: 2, timeoutMs: 10 * 60 * 1000, label: `quality ${date}` });
  const parsed = extractJson(stdout);
  if (Array.isArray(parsed)) {
    const byId = new Map(parsed.map((p) => [p && p.id, p]));
    for (const item of sample) {
      const p = byId.get(item.id);
      if (!p) continue;
      const scores = {};
      let ok = true;
      for (const key of SCORE_KEYS) {
        const n = Number(p[key]);
        if (!Number.isFinite(n) || n < 1 || n > 5) { ok = false; break; }
        scores[key] = Math.round(n);
      }
      if (!ok) continue;
      reviews.push({
        id: item.id,
        title: item.title_zh || item.title,
        category: item.category,
        ...scores,
        reason: String(p.reason || '').slice(0, 200),
      });
    }
  }
} catch (err) {
  console.warn(`[warn] quality ${date}: Kimi 调用失败：${err.message.slice(0, 200)}`);
}

if (reviews.length === 0) {
  console.warn(`[warn] quality ${date}: 没有有效评分，未写入`);
  process.exit(1);
}

const report = {
  date,
  generated_at: new Date().toISOString(),
  model: 'kimi',
  basis: 'summary-only',
  count: reviews.length,
  items: reviews,
  averages: averageScores(reviews),
};
writeFileAtomic(outFile, JSON.stringify(report, null, 2) + '\n');
console.log(`[ok] quality sample ${date}: ${reviews.length}/${sample.length} 条 ${JSON.stringify(report.averages)}`);
