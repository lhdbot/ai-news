import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSourceCache, sourceCachePath, writeSourceCache } from './lib/source-cache.mjs';

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-news-cache-'));
  return path.join(dir, 'source.json');
}

test('源缓存：写入后可读取，并按窗口过滤', () => {
  const file = tmpFile();
  const now = Date.now();
  const items = [
    { url: 'a', published_at: new Date(now - 3600e3).toISOString() },
    { url: 'b', published_at: new Date(now - 72 * 3600e3).toISOString() },
  ];
  assert.equal(writeSourceCache(file, 'Source', items), true);
  const recent = readSourceCache(file, new Date(now - 48 * 3600e3));
  assert.equal(recent.length, 1);
  assert.equal(recent[0].url, 'a');
});

test('源缓存：空结果不覆盖，缺失返回 null', () => {
  const file = tmpFile();
  assert.equal(writeSourceCache(file, 'Source', []), false);
  assert.equal(readSourceCache(file, new Date()), null);
});

test('源缓存：不同源名生成不同路径', () => {
  const a = sourceCachePath('dir', 'arXiv cs.AI');
  const b = sourceCachePath('dir', 'OpenAI');
  assert.notEqual(a, b);
});
