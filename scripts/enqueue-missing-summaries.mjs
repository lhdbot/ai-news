#!/usr/bin/env node
/**
 * 把历史日报中 summarized=false 的条目一次性灌入摘要重试队列（按日期倒序）。
 * 配合 summarize-local --retry --limit=N 逐轮补齐，避免一次性占用太多 Kimi 调用。
 *
 * 用法: node scripts/enqueue-missing-summaries.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadQueue, saveQueue } from './lib/summary-queue.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const QUEUE_FILE = path.join(ROOT, 'data', 'state', 'summary-queue.json');
const dryRun = process.argv.includes('--dry-run');

const dates = fs.readdirSync(NEWS_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort()
  .reverse();

const queue = loadQueue(QUEUE_FILE);
const existing = new Set(queue.items.map((i) => `${i.date}|${i.id}`));
const now = new Date().toISOString();
let added = 0;

for (const date of dates) {
  const daily = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, `${date}.json`), 'utf8'));
  for (const item of daily.items || []) {
    if (item.summarized) continue;
    const key = `${date}|${item.id}`;
    if (existing.has(key)) continue;
    queue.items.push({
      id: item.id,
      url: item.url || '',
      date,
      attempts: 0,
      lastError: 'missing summary',
      nextRetryAt: now,
      createdAt: now,
    });
    existing.add(key);
    added += 1;
  }
}

if (!dryRun) saveQueue(QUEUE_FILE, queue);
console.log(`${dryRun ? '[dry-run] ' : ''}入队 ${added} 条，队列共 ${queue.items.length} 条`);
