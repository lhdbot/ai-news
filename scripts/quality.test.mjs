import test from 'node:test';
import assert from 'node:assert/strict';
import { averageScores, selectSample } from './lib/quality.mjs';

const CATS = ['论文研究', '模型发布', '行业动态', '工具产品', '芯片算力', '具身智能', '人物经验'];

function makeItems() {
  const items = [];
  let n = 0;
  for (const category of CATS) {
    for (let i = 0; i < 4; i++) {
      n += 1;
      items.push({
        id: 'id' + n,
        category,
        title_zh: '标题' + n,
        summary_zh: '足够长的摘要内容，用于抽检测试。',
        summarized: true,
      });
    }
  }
  return items;
}

test('抽检：按分类轮转，条数正确且不重复', () => {
  const items = makeItems();
  const sample = selectSample(items, 5, '2026-11-10');
  assert.equal(sample.length, 5);
  assert.equal(new Set(sample.map((i) => i.id)).size, 5);
  assert.ok(new Set(sample.map((i) => i.category)).size >= 4, '应覆盖多个分类');
});

test('抽检：同一天种子确定，结果可复现', () => {
  const items = makeItems();
  const a = selectSample(items, 5, '2026-11-10').map((i) => i.id);
  const b = selectSample(items, 5, '2026-11-10').map((i) => i.id);
  assert.deepEqual(a, b);
});

test('均分：只统计合法四维评分', () => {
  const avg = averageScores([
    { accuracy: 4, density: 3, readability: 5, actionability: 4 },
    { accuracy: 2, density: 4, readability: 4, actionability: 3 },
    { accuracy: 0, density: 5, readability: 5, actionability: 5 },
  ]);
  assert.equal(avg.accuracy, 3);
  assert.equal(avg.density, 3.5);
  assert.equal(avg.readability, 4.5);
  assert.equal(avg.actionability, 3.5);
});

test('均分：没有合法条目返回 null', () => {
  assert.equal(averageScores([]), null);
  assert.equal(averageScores([{ accuracy: 9 }]), null);
});
