import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_QUOTAS, selectDigest } from './lib/digest.mjs';

const DATE = '2026-11-10';
const CATS = ['论文研究', '模型发布', '行业动态', '工具产品', '芯片算力', '具身智能', '人物经验'];

function makeItems() {
  const items = [];
  let n = 0;
  for (const category of CATS) {
    for (let i = 0; i < 10; i++) {
      n += 1;
      items.push({
        id: 'id' + n,
        url: 'https://example.com/' + n,
        title: 'title ' + n,
        category,
        heat: 10,
        summarized: true,
      });
    }
  }
  return items;
}

function newIndex(items) {
  const urls = {};
  for (const item of items) urls[item.url] = { firstSeenAt: DATE, lastSeenAt: DATE, dates: [DATE] };
  return { version: 1, urls };
}

test('digest：最多 30 条、无重复、优先当日新条目', () => {
  const items = makeItems();
  const picked = selectDigest(items, newIndex(items), DATE);
  assert.equal(picked.length, 30);
  assert.equal(new Set(picked.map((i) => i.url)).size, 30);
  assert.ok(picked.every((i) => i.isNew));
  for (const [category, quota] of Object.entries(CATEGORY_QUOTAS)) {
    const count = picked.filter((i) => i.category === category).length;
    assert.ok(count <= quota, category + ' 超出配额：' + count);
  }
});

test('digest：新条目不足时用旧的高热条目补足', () => {
  const items = makeItems().slice(0, 12);
  const index = newIndex(items);
  for (const item of items.slice(0, 8)) {
    index.urls[item.url] = { firstSeenAt: '2026-11-01', lastSeenAt: '2026-11-01', dates: ['2026-11-01'] };
  }
  const picked = selectDigest(items, index, DATE, { size: 30 });
  assert.ok(picked.length <= 12);
  assert.ok(picked.some((i) => i.isNew));
});

test('digest：条目不足时返回全部，不报错', () => {
  const items = makeItems().slice(0, 3);
  const picked = selectDigest(items, newIndex(items), DATE);
  assert.equal(picked.length, 3);
  assert.deepEqual(picked.map((i) => i.position), [1, 2, 3]);
});
