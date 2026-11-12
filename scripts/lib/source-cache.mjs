/**
 * 源级"最近一次成功"缓存：抓取失败时回退到最近缓存，并按抓取窗口过滤。
 * 缓存文件：data/cache/sources/<sha1(name)>.json
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './fs-atomic.mjs';

export function sourceCachePath(dir, name) {
  const key = crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 12);
  return path.join(dir, key + '.json');
}

/** 读取缓存并按发布时间过滤；文件缺失/损坏返回 null */
export function readSourceCache(file, since) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const items = Array.isArray(data.items) ? data.items : [];
    const sinceMs = since instanceof Date ? since.getTime() : new Date(since).getTime();
    const filtered = items.filter((item) => {
      const t = Date.parse(item.published_at);
      return Number.isFinite(t) && t >= sinceMs;
    });
    return filtered;
  } catch {
    return null;
  }
}

/** 成功抓取到内容时覆盖缓存；空结果不覆盖，保留上一份可用数据 */
export function writeSourceCache(file, name, items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  writeFileAtomic(file, JSON.stringify({ name, cachedAt: new Date().toISOString(), items }, null, 2) + '\n');
  return true;
}
