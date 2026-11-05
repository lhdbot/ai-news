import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPrompt, MAX_PROMPT_CHARS } from './lib/prompt-budget.mjs';

const build = (items) => JSON.stringify(items);

test('fitPrompt：未超限时原样返回', () => {
  const items = [{ title: 'a', summary: 'b' }, { title: 'c', summary: 'd' }];
  const { prompt, items: used, trimmed } = fitPrompt(items, build);
  assert.equal(trimmed, false);
  assert.equal(used.length, 2);
  assert.equal(prompt, build(items));
});

test('fitPrompt：超限时先去掉 summary，保留全部条目', () => {
  const items = Array.from({ length: 200 }, (_, i) => ({
    title: 'title-' + i,
    summary: 'x'.repeat(400),
  }));
  const { prompt, items: used, trimmed } = fitPrompt(items, build);
  assert.equal(trimmed, true);
  assert.equal(used.length, 200);
  assert.ok(!('summary' in used[0]));
  assert.ok(prompt.length <= MAX_PROMPT_CHARS);
});

test('fitPrompt：仍超限时裁剪条目数并守住上限', () => {
  const items = Array.from({ length: 300 }, (_, i) => ({
    title: 't' + i + '-'.repeat(40),
    url: 'https://example.com/' + i,
  }));
  const { prompt, items: used, trimmed } = fitPrompt(items, build);
  assert.equal(trimmed, true);
  assert.ok(used.length < 300);
  assert.ok(used.length >= 12);
  assert.ok(prompt.length <= MAX_PROMPT_CHARS);
});