import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnrichment } from './lib/enrichment-schema.mjs';

test('Schema：合法摘要通过', () => {
  const result = validateEnrichment({
    id: 'x1',
    title_zh: '某模型发布',
    summary_zh: '这是一个足够长的中文摘要，用于测试校验。',
    learn: '学到东西',
    impact: '有影响',
    advice: '马上试试',
    category: '模型发布',
    tags: ['OpenAI', '模型'],
    trends: ['model-release'],
  });
  assert.equal(result.ok, true);
});

test('Schema：非法分类/过短摘要被拒绝', () => {
  const bad = validateEnrichment({
    id: 'x2',
    title_zh: '标题',
    summary_zh: '短',
    category: '不存在的分类',
    tags: [],
  });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /category|summary_zh/);
});

test('Schema：缺 id 或标题被拒绝', () => {
  const bad = validateEnrichment({ summary_zh: '足够长的摘要内容在这里。', category: '行业动态' });
  assert.equal(bad.ok, false);
});
