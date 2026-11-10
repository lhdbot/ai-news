/**
 * 摘要失败队列：批次失败或单条校验失败时入队，`summarize-local --retry` 按退避重试。
 * 数据文件：data/state/summary-queue.json
 */
import fs from 'node:fs';
import { writeFileAtomic } from './fs-atomic.mjs';

export const BACKOFF_MS = [5 * 60e3, 30 * 60e3, 2 * 3600e3, 24 * 3600e3];
export const MAX_QUEUE = 500;

export function loadQueue(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data && Array.isArray(data.items)) return data;
  } catch { /* 首次运行/文件损坏 */ }
  return { updatedAt: null, items: [] };
}

export function saveQueue(file, queue) {
  queue.updatedAt = new Date().toISOString();
  if (queue.items.length > MAX_QUEUE) queue.items = queue.items.slice(-MAX_QUEUE);
  writeFileAtomic(file, JSON.stringify(queue, null, 2) + '\n');
}

export function backoffMs(attempts) {
  const idx = Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx];
}

export function enqueue(queue, entry, now = Date.now()) {
  const key = `${entry.date}|${entry.id}`;
  let item = queue.items.find((i) => `${i.date}|${i.id}` === key);
  if (!item) {
    item = { id: entry.id, url: entry.url || '', date: entry.date, attempts: 0, lastError: '', nextRetryAt: null, createdAt: new Date(now).toISOString() };
    queue.items.push(item);
  }
  item.attempts += 1;
  item.lastError = String(entry.error || '').slice(0, 300);
  item.nextRetryAt = new Date(now + backoffMs(item.attempts)).toISOString();
  return item;
}

export function dueItems(queue, now = Date.now()) {
  return queue.items.filter((i) => {
    const t = i.nextRetryAt ? Date.parse(i.nextRetryAt) : 0;
    return Number.isNaN(t) || t <= now;
  });
}

export function removeEntry(queue, { date, id }) {
  queue.items = queue.items.filter((i) => !(i.date === date && i.id === id));
}

export function pruneQueue(queue, now = Date.now(), maxAgeMs = 30 * 86400e3) {
  queue.items = queue.items.filter((i) => {
    const t = i.createdAt ? Date.parse(i.createdAt) : now;
    return Number.isFinite(t) && now - t < maxAgeMs;
  });
}
