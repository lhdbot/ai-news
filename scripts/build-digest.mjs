#!/usr/bin/env node
/**
 * 生成每日精选 digest：从当日原始日报中选最多 30 条，写入 data/digests/YYYY-MM-DD.json。
 * 规则见 scripts/lib/digest.mjs：当日新增优先、七个分类有配额、跨天重复只在热度高时补位。
 *
 * 用法: node scripts/build-digest.mjs [--date=YYYY-MM-DD]
 */
import fs from 'node:fs';
import path from 'node:path';
import { selectDigest } from './lib/digest.mjs';
import { writeFileAtomic } from './lib/fs-atomic.mjs';
import { loadUrlIndex, markDigestDate, saveUrlIndex, updateUrlIndex } from './lib/url-index.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const DIGEST_DIR = path.join(ROOT, 'data', 'digests');
const URL_INDEX = path.join(ROOT, 'data', 'index', 'urls.json');

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const date = dateArg ? dateArg.split('=')[1] : beijingToday();
const newsFile = path.join(NEWS_DIR, `${date}.json`);

if (!fs.existsSync(newsFile)) {
  console.log(`[skip] ${newsFile} 不存在`);
  process.exit(0);
}

const daily = JSON.parse(fs.readFileSync(newsFile, 'utf8').replace(/^\uFEFF/, ''));
const items = Array.isArray(daily.items) ? daily.items : [];
if (items.length === 0) {
  console.log(`[skip] ${date} 没有条目`);
  process.exit(0);
}

const index = loadUrlIndex(URL_INDEX);
updateUrlIndex(index, items, date);
const picked = selectDigest(items, index, date);
const digest = {
  date,
  generated_at: new Date().toISOString(),
  total: items.length,
  items: picked,
};
writeFileAtomic(path.join(DIGEST_DIR, `${date}.json`), JSON.stringify(digest, null, 2) + '\n');
markDigestDate(index, picked, date);
saveUrlIndex(URL_INDEX, index);

const counts = {};
for (const item of picked) counts[item.category] = (counts[item.category] || 0) + 1;
console.log(`[ok] digest ${date}: ${picked.length}/${items.length} 条 ${JSON.stringify(counts)}`);
