#!/usr/bin/env node
/**
 * 本地摘要器：调用本机 Kimi CLI（kimi -p）为未摘要的新闻生成中文内容。
 *
 * 用法:
 *   node scripts/summarize-local.mjs                  # 今日所有 summarized=false 的条目
 *   node scripts/summarize-local.mjs --date=YYYY-MM-DD
 *   node scripts/summarize-local.mjs --retry          # 处理失败队列中到期的条目（可跨天）
 *   node scripts/summarize-local.mjs --force=N        # 强制重新摘要前 N 条（调试）
 *
 * 质量控制：
 * - 输出逐条过 zod Schema（scripts/lib/enrichment-schema.mjs），非法条目单条重试一次；
 * - 仍失败则进入 data/state/summary-queue.json，按 5m/30m/2h/24h 退避重试；
 * - category 使用专用来源锁（categories.mjs）；trends 校验 taxonomy；tags 归一化。
 */
import fs from 'node:fs';
import path from 'node:path';
import { callKimi, extractJson } from './lib/kimi.mjs';
import { writeFileAtomic } from './lib/fs-atomic.mjs';
import { lockedCategory } from './lib/categories.mjs';
import { ENRICHMENT_CATEGORIES, validateEnrichment } from './lib/enrichment-schema.mjs';
import {
  dueItems,
  enqueue,
  loadQueue,
  pruneQueue,
  removeEntry,
  saveQueue,
} from './lib/summary-queue.mjs';

const BATCH = 10;
const CATEGORIES = ENRICHMENT_CATEGORIES;
const PAPER_SOURCES = /arxiv|hugging\s*face/i;

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const TAXONOMY_FILE = path.join(ROOT, 'data', 'trends', 'taxonomy.json');
const TAG_ALIAS_FILE = path.join(ROOT, 'data', 'tag-aliases.json');
const QUEUE_FILE = path.join(ROOT, 'data', 'state', 'summary-queue.json');

const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'));
const VALID_TREND_IDS = new Set(taxonomy.nodes.map((n) => n.id));
const TREND_MENU = taxonomy.nodes.map((n) => `${n.id}（${n.name}）`).join('、');

const aliases = JSON.parse(fs.readFileSync(TAG_ALIAS_FILE, 'utf8'));
const aliasMap = new Map(Object.entries(aliases).map(([k, v]) => [k.toLowerCase(), v]));
const normalizeTag = (t) => aliasMap.get(String(t).trim().toLowerCase()) ?? String(t).trim();

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const isPaper = (i) => i.category === '论文研究' || PAPER_SOURCES.test(i.source || '');

const queue = loadQueue(QUEUE_FILE);
let queueDirty = false;
pruneQueue(queue);

function flushQueue() {
  if (!queueDirty) return;
  saveQueue(QUEUE_FILE, queue);
  queueDirty = false;
}

function buildPrompt(batch) {
  const payload = batch.map((i) => ({
    id: i.id,
    title: i.title,
    snippet: (i.summary_zh || '').slice(0, 300),
    source: i.source,
    paper: isPaper(i),
  }));
  return `你是中文 AI 新闻编辑，读者是一位想持续学习 AI 的开发者。对下面 JSON 数组中的每条新闻，生成中文字段。
要求:
- title_zh: 中文标题(15字内,可直接用原标题若已为中文)
- summary_zh: 对原文内容的总结(60字内,说清发生了什么,不要只复述标题)
- learn: 读者可以从中学到什么(40字内,知识点/方法/趋势)
- impact: 这件事的影响(30字内,对行业/技术/用户)
- advice: 给读者的行动建议(30字内,具体可执行,如试试某个工具/关注某个方向/读原文)
- category: 必须是 [${CATEGORIES.join('/')}] 之一
- 分类分布: 全部条目中「论文研究」和「工具产品」各自不超过 40%；来源为 arXiv / Hugging Face 的条目通常归为「论文研究」
- tags: 2-3个中文或专有名词标签
- trends: 从以下趋势 taxonomy 中选 1-3 个最贴切的 id：${TREND_MENU}。只能从清单中选，输出 id 数组
- paper=true 的条目额外输出三个字段（各一句话）：method（论文用了什么方法）、result（取得了什么结果）、limitation（有什么局限）；paper=false 的条目不要输出这三个字段
- 只输出 JSON 数组,每项含 id/title_zh/summary_zh/learn/impact/advice/category/tags/trends(及 paper 条目的 method/result/limitation),不要输出任何其他文字,不要使用任何工具

输入:
${JSON.stringify(payload, null, 1)}`;
}

async function callDeepSeek(prompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn(`deepseek fallback failed: ${e.message.slice(0, 200)}`);
    return null;
  }
}

/** 调一次模型，返回 id -> 原始对象；失败返回 null */
async function callBatch(batch, label) {
  const prompt = buildPrompt(batch);
  let parsed = null;
  try {
    const stdout = await callKimi(prompt, { retries: 2, timeoutMs: 10 * 60 * 1000, label });
    parsed = extractJson(stdout);
  } catch {
    console.warn(`${label}: kimi failed, trying deepseek fallback`);
    const out = await callDeepSeek(prompt);
    if (out) {
      try {
        parsed = extractJson(out);
      } catch {
        console.warn(`${label}: deepseek output unparseable`);
      }
    }
  }
  if (!Array.isArray(parsed)) return null;
  return new Map(parsed.map((p) => [p && p.id, p]));
}

function applyEnrichment(item, p) {
  item.title_zh = String(p.title_zh || item.title);
  item.summary_zh = String(p.summary_zh || '');
  item.learn = String(p.learn || '');
  item.impact = String(p.impact || '');
  item.advice = String(p.advice || '');
  item.category = lockedCategory(item.source) ?? p.category;
  item.tags = Array.isArray(p.tags) ? p.tags.map(normalizeTag).filter(Boolean).slice(0, 4) : [];
  item.trends = Array.isArray(p.trends)
    ? [...new Set(p.trends.map(String))].filter((t) => VALID_TREND_IDS.has(t)).slice(0, 3)
    : [];
  if (isPaper(item)) {
    item.method = String(p.method || '');
    item.result = String(p.result || '');
    item.limitation = String(p.limitation || '');
  } else {
    delete item.method;
    delete item.result;
    delete item.limitation;
  }
  item.summarized = true;
}

/** 处理某一天里指定的条目；返回 {done, failed} */
async function summarizeDate(date, targets) {
  const file = path.join(NEWS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) {
    for (const t of targets) {
      removeEntry(queue, { date, id: t.id });
      queueDirty = true;
    }
    flushQueue();
    return { done: 0, failed: targets.length };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { done: 0, failed: targets.length };
  }
  const byId = new Map((data.items || []).map((i) => [i.id, i]));
  const items = targets.map((t) => byId.get(t.id)).filter(Boolean);
  // 清理队列里已经不存在的条目（数据被重建/删除）
  for (const t of targets) {
    if (!byId.has(t.id)) {
      removeEntry(queue, { date, id: t.id });
      queueDirty = true;
    }
  }
  let done = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const label = `${date} batch ${i / BATCH + 1}`;
    const parsed = await callBatch(batch, label);
    const invalid = [];

    if (!parsed) {
      for (const item of batch) {
        enqueue(queue, { id: item.id, url: item.url, date, error: 'batch failed' });
        failed += 1;
      }
      queueDirty = true;
      console.warn(`${label}: skipped, ${batch.length} 条已进入重试队列`);
      continue;
    }

    for (const item of batch) {
      const p = parsed.get(item.id);
      if (!p) {
        invalid.push({ item, reason: 'missing from model output' });
        continue;
      }
      const category = lockedCategory(item.source) ?? p.category;
      const check = validateEnrichment({ ...p, category });
      if (!check.ok) {
        invalid.push({ item, reason: check.reason });
        continue;
      }
      applyEnrichment(item, check.data);
      if (!isPaper(item)) {
        delete item.method;
        delete item.result;
        delete item.limitation;
      }
      removeEntry(queue, { date, id: item.id });
      queueDirty = true;
      done += 1;
    }

    // 单条重试一次：避免一条脏数据拖垮整批
    for (const entry of invalid) {
      const item = entry.item;
      const singleLabel = `${label} single ${item.id}`;
      const single = await callBatch([item], singleLabel);
      const p = single ? single.get(item.id) : null;
      if (p) {
        const category = lockedCategory(item.source) ?? p.category;
        const check = validateEnrichment({ ...p, category });
        if (check.ok) {
          applyEnrichment(item, check.data);
          removeEntry(queue, { date, id: item.id });
          queueDirty = true;
          done += 1;
          continue;
        }
      }
      enqueue(queue, { id: item.id, url: item.url, date, error: entry.reason });
      failed += 1;
      queueDirty = true;
    }

    data.generated_at = new Date().toISOString();
    writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n');
    flushQueue();
    console.log(`${label}: summarized ${done}/${items.length}`);
  }

  flushQueue();
  return { done, failed };
}

async function main() {
  const retryMode = process.argv.includes('--retry');
  if (retryMode) {
    const due = dueItems(queue);
    if (due.length === 0) {
      console.log('no due retries in summary queue');
      return;
    }
    const byDate = new Map();
    for (const entry of due) {
      if (!byDate.has(entry.date)) byDate.set(entry.date, []);
      byDate.get(entry.date).push({ id: entry.id, url: entry.url });
    }
    let done = 0;
    let failed = 0;
    for (const [date, targets] of byDate) {
      console.log(`retry ${date}: ${targets.length} 条到期`);
      const res = await summarizeDate(date, targets);
      done += res.done;
      failed += res.failed;
    }
    flushQueue();
    console.log(`retry done: ${done} 成功，${failed} 仍失败`);
    return;
  }

  const dateArg = process.argv.find((a) => a.startsWith('--date='));
  const targetDate = dateArg ? dateArg.split('=')[1] : beijingToday();
  const file = path.join(NEWS_DIR, `${targetDate}.json`);
  if (!fs.existsSync(file)) {
    console.log(`no data file for ${targetDate}, nothing to summarize`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const forceArg = process.argv.find((a) => a.startsWith('--force='));
  const allFlag = process.argv.includes('--all');
  let targets;
  if (allFlag) targets = data.items;
  else if (forceArg) targets = data.items.slice(0, parseInt(forceArg.split('=')[1], 10));
  else targets = data.items.filter((i) => !i.summarized);

  if (targets.length === 0) {
    console.log('all items already summarized');
    return;
  }
  const res = await summarizeDate(targetDate, targets);
  console.log(`done: ${res.done} items summarized, ${res.failed} queued for retry`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exitCode = 1;
});
