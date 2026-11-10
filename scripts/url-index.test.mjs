import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSeenDate, markDigestDate, normalizeUrl, updateUrlIndex } from './lib/url-index.mjs';

test('URL 归一化：去 hash、追踪参数、尾斜杠', () => {
  assert.equal(
    normalizeUrl('https://example.com/a/?utm_source=x&ref=y#frag'),
    'https://example.com/a',
  );
});

test('URL 索引：记录首次出现与日期列表', () => {
  const index = { version: 1, urls: {} };
  updateUrlIndex(index, [{ url: 'https://example.com/a/' }], '2026-11-09');
  updateUrlIndex(index, [{ url: 'https://example.com/a' }], '2026-11-10');
  const key = 'https://example.com/a';
  assert.equal(firstSeenDate(index, key), '2026-11-09');
  assert.deepEqual(index.urls[key].dates, ['2026-11-09', '2026-11-10']);
});

test('URL 索引：标记 digest 日期', () => {
  const index = { version: 1, urls: {} };
  updateUrlIndex(index, [{ url: 'https://example.com/a' }], '2026-11-10');
  markDigestDate(index, [{ url: 'https://example.com/a' }], '2026-11-10');
  assert.equal(index.urls['https://example.com/a'].lastDigestDate, '2026-11-10');
});
