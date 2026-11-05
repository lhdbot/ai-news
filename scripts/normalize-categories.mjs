#!/usr/bin/env node
/**
 * 把历史日报中"专用来源"条目的分类纠正为来源语义（arXiv→论文研究、NVIDIA→芯片算力 …）。
 * 纯规则、不调用 LLM，可重复执行。
 *
 * 用法:
 *   node scripts/normalize-categories.mjs --dry-run   # 只看会改哪些
 *   node scripts/normalize-categories.mjs             # 实际写入（原子写）
 */
import fs from 'node:fs';
import path from 'node:path';
import { lockedCategory } from './lib/categories.mjs';
import { writeFileAtomic } from './lib/fs-atomic.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const dryRun = process.argv.includes('--dry-run');

let scanned = 0;
let changed = 0;
let written = 0;

for (const name of fs.readdirSync(NEWS_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
  const file = path.join(NEWS_DIR, name);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let dirty = false;
  for (const item of data.items ?? []) {
    scanned += 1;
    const want = lockedCategory(item.source);
    if (want && item.category !== want) {
      console.log(`${name} | ${item.source}: ${item.category} -> ${want} | ${item.title.slice(0, 40)}`);
      item.category = want;
      changed += 1;
      dirty = true;
    }
  }
  if (dirty && !dryRun) {
    writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n');
    written += 1;
  }
}

console.log(`${dryRun ? '[dry-run] ' : ''}扫描 ${scanned} 条，修正 ${changed} 条${dryRun ? '（未写入）' : `，写入 ${written} 个文件`}`);
