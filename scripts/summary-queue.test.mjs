import test from 'node:test';
import assert from 'node:assert/strict';
import { dueItems, enqueue, loadQueue, pruneQueue, removeEntry } from './lib/summary-queue.mjs';

function fresh() {
  return { updatedAt: null, items: [] };
}

test('队列：首次失败 5 分钟后重试，第二次 30 分钟', () => {
  const q = fresh();
  const now = Date.parse('2026-11-10T00:00:00Z');
  enqueue(q, { id: 'a', url: 'u', date: '2026-11-10', error: 'boom' }, now);
  assert.equal(q.items[0].attempts, 1);
  assert.equal(Date.parse(q.items[0].nextRetryAt) - now, 5 * 60e3);

  enqueue(q, { id: 'a', url: 'u', date: '2026-11-10', error: 'boom2' }, now + 60e3);
  assert.equal(q.items[0].attempts, 2);
  assert.equal(Date.parse(q.items[0].nextRetryAt) - (now + 60e3), 30 * 60e3);
  assert.equal(q.items.length, 1, '同一条不应重复入队');
});

test('队列：dueItems 只返回到期项', () => {
  const q = fresh();
  const now = Date.parse('2026-11-10T00:00:00Z');
  enqueue(q, { id: 'a', date: '2026-11-10' }, now);
  enqueue(q, { id: 'b', date: '2026-11-10' }, now);
  assert.equal(dueItems(q, now).length, 0);
  assert.equal(dueItems(q, now + 6 * 60e3).length, 2);
});

test('队列：删除与过期清理', () => {
  const q = fresh();
  const now = Date.now();
  enqueue(q, { id: 'a', date: '2026-11-10' }, now);
  enqueue(q, { id: 'b', date: '2026-11-10' }, now);
  removeEntry(q, { id: 'a', date: '2026-11-10' });
  assert.deepEqual(q.items.map((i) => i.id), ['b']);
  pruneQueue(q, now + 31 * 86400e3);
  assert.equal(q.items.length, 0);
});

test('队列：文件缺失时返回空队列', () => {
  const q = loadQueue('Z:/definitely/not/exists/queue.json');
  assert.deepEqual(q.items, []);
});
