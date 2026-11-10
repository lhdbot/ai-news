/**
 * 全局 URL 索引：跨天识别"这篇文章是不是第一次出现"，供 digest 与 RSS 去重。
 * 数据文件：data/index/urls.json
 */
import fs from 'node:fs';
import { writeFileAtomic } from './fs-atomic.mjs';

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'ref' || key === 'src') u.searchParams.delete(key);
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function loadUrlIndex(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data && typeof data.urls === 'object' && data.urls) return { version: 1, urls: data.urls };
  } catch { /* 首次运行 */ }
  return { version: 1, urls: {} };
}

export function saveUrlIndex(file, index) {
  writeFileAtomic(file, JSON.stringify(index) + '\n');
}

export function updateUrlIndex(index, items, date) {
  for (const item of items) {
    if (!item || !item.url) continue;
    const key = normalizeUrl(item.url);
    const rec = index.urls[key] || { firstSeenAt: date, lastSeenAt: date, dates: [] };
    rec.lastSeenAt = date;
    if (!Array.isArray(rec.dates)) rec.dates = [];
    if (!rec.dates.includes(date)) rec.dates.push(date);
    rec.dates = rec.dates.slice(-30);
    index.urls[key] = rec;
  }
  return index;
}

export function firstSeenDate(index, url) {
  const rec = index.urls[normalizeUrl(url)];
  return rec ? rec.firstSeenAt : null;
}

export function markDigestDate(index, items, date) {
  for (const item of items) {
    const key = normalizeUrl(item.url);
    const rec = index.urls[key];
    if (rec) rec.lastDigestDate = date;
  }
}
