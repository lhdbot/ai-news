#!/usr/bin/env node
/**
 * 从全部历史日报重建 data/index/urls.json。
 * 按日期升序处理，firstSeenAt 记录该 URL 第一次出现的那一天。
 *
 * 用法: node scripts/rebuild-url-index.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { saveUrlIndex, updateUrlIndex } from './lib/url-index.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const INDEX_FILE = path.join(ROOT, 'data', 'index', 'urls.json');
const dryRun = process.argv.includes('--dry-run');

const dates = fs.readdirSync(NEWS_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

// 重建：始终从空索引开始，按日期升序写入 firstSeenAt
const index = { version: 1, urls: {} };
let items = 0;
for (const date of dates) {
  const daily = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, `${date}.json`), 'utf8'));
  const list = Array.isArray(daily.items) ? daily.items : [];
  items += list.length;
  updateUrlIndex(index, list, date);
}
if (!dryRun) saveUrlIndex(INDEX_FILE, index);
console.log(`${dryRun ? '[dry-run] ' : ''}${dates.length} 天 / ${items} 条 → ${Object.keys(index.urls).length} 个唯一 URL`);
