/**
 * 跨天事件索引：同一件事在多天/多源出现时归到同一个 eventId。
 * 只在最近 7 天内比较标题 Jaccard（>=0.6），避免全量两两比较。
 * 数据文件：data/index/events.json
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { writeFileAtomic } from './fs-atomic.mjs';
import { jaccard, titleTokens } from './text-similarity.mjs';

export const EVENT_THRESHOLD = 0.6;
export const EVENT_WINDOW_DAYS = 7;
const DAY = 86400e3;

export function loadEventIndex(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data && typeof data.events === 'object' && data.events) return { version: 1, events: data.events };
  } catch { /* 首次运行 */ }
  return { version: 1, events: {} };
}

export function saveEventIndex(file, index) {
  writeFileAtomic(file, JSON.stringify(index) + '\n');
}

function dayDiff(a, b) {
  const ta = Date.parse(a + 'T00:00:00Z');
  const tb = Date.parse(b + 'T00:00:00Z');
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Infinity;
  return Math.abs(ta - tb) / DAY;
}

function newEventId(date, url) {
  return 'ev_' + crypto.createHash('sha1').update(`${date}|${url}`).digest('hex').slice(0, 12);
}

/**
 * 给一条新闻分配 eventId；已分配且索引里存在的直接复用，不重复计数。
 * 返回 eventId。
 */
export function assignEvent(item, index, date, { threshold = EVENT_THRESHOLD, windowDays = EVENT_WINDOW_DAYS } = {}) {
  if (!item || !item.title) return null;
  if (item.eventId && index.events[item.eventId]) {
    return item.eventId;
  }
  const tokens = titleTokens(item.title);
  let bestId = null;
  let bestScore = 0;
  for (const [id, event] of Object.entries(index.events)) {
    if (!event.lastSeenAt) continue;
    if (dayDiff(date, event.lastSeenAt) > windowDays) continue;
    const score = jaccard(tokens, titleTokens(event.title));
    if (score >= threshold && score > bestScore) {
      bestId = id;
      bestScore = score;
    }
  }
  if (!bestId) {
    bestId = newEventId(date, item.url || item.title);
    index.events[bestId] = {
      id: bestId,
      title: item.title,
      firstSeenAt: date,
      lastSeenAt: date,
      count: 0,
      sources: [],
    };
  }
  const event = index.events[bestId];
  event.lastSeenAt = date;
  event.count += 1;
  if (item.source && !event.sources.includes(item.source)) event.sources.push(item.source);
  item.eventId = bestId;
  return bestId;
}

export function assignEvents(items, index, date, opts) {
  for (const item of items) assignEvent(item, index, date, opts);
  return items;
}
