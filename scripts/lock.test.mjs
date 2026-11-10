import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lockIsStale, readLock, tryAcquireLock } from './lib/lock.mjs';

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-news-lock-'));
  return path.join(dir, 'job.lock');
}

test('锁：持有进程已退出时判定为陈旧', () => {
  const file = tmpFile();
  fs.writeFileSync(file, JSON.stringify({ job: 'watch', pid: 999999, startedAt: new Date().toISOString() }));
  assert.equal(lockIsStale(readLock(file)), true);
});

test('锁：持有进程存活且未超时不算陈旧', () => {
  const file = tmpFile();
  fs.writeFileSync(file, JSON.stringify({ job: 'watch', pid: process.pid, startedAt: new Date().toISOString() }));
  assert.equal(lockIsStale(readLock(file)), false);
});

test('锁：超过 45 分钟判定为陈旧', () => {
  const file = tmpFile();
  const old = new Date(Date.now() - 50 * 60e3).toISOString();
  fs.writeFileSync(file, JSON.stringify({ job: 'watch', pid: process.pid, startedAt: old }));
  assert.equal(lockIsStale(readLock(file)), true);
});

test('锁：兼容旧格式，并能原子创建', () => {
  const file = tmpFile();
  fs.writeFileSync(file, 'watch 2026-11-10T04:37:02.174Z\n');
  const parsed = readLock(file);
  assert.equal(parsed.job, 'watch');
  assert.equal(parsed.legacy, true);

  const other = tmpFile();
  const lock = tryAcquireLock(other, 'daily');
  assert.equal(lock.job, 'daily');
  assert.equal(tryAcquireLock(other, 'daily'), null, '重复获取应失败');
});
