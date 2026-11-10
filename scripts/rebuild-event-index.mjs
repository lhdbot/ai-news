#!/usr/bin/env node
/**
 * 从全部历史日报重建跨天事件索引（data/index/events.json），并把 eventId 写回日报。
 * 按日期升序处理，同一事件在 7 天窗口内按标题 Jaccard >= 0.6 合并。
 *
 * 用法: node scripts/rebuild-event-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './lib/fs-atomic.mjs';
import { assignEvents, loadEventIndex, saveEventIndex } from './lib/events.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const EVENTS_FILE = path.join(ROOT, 'data', 'index', 'events.json');

const dates = fs.readdirSync(NEWS_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const index = loadEventIndex(EVENTS_FILE);
let changedFiles = 0;
let assigned = 0;

for (const date of dates) {
  const file = path.join(NEWS_DIR, `${date}.json`);
  const daily = JSON.parse(fs.readFileSync(file, 'utf8'));
  let dirty = false;
  for (const item of daily.items || []) {
    const before = item.eventId;
    assignEvents([item], index, date);
    if (item.eventId !== before) {
      assigned += 1;
      dirty = true;
    }
  }
  if (dirty) {
    writeFileAtomic(file, JSON.stringify(daily, null, 2) + '\n');
    changedFiles += 1;
  }
}

saveEventIndex(EVENTS_FILE, index);
console.log(`${dates.length} 天：写入 ${changedFiles} 个文件，分配/更新 ${assigned} 条，事件 ${Object.keys(index.events).length} 个`);
