import test from 'node:test';
import assert from 'node:assert/strict';
import { assignEvent, assignEvents } from './lib/events.mjs';

test('事件：跨天相似标题合并到同一个 eventId', () => {
  const index = { version: 1, events: {} };
  const a = { title: 'OpenAI releases GPT-5', url: 'https://a.example/1', source: 'A' };
  const b = { title: 'OpenAI unveils GPT-5', url: 'https://b.example/2', source: 'B' };
  assignEvent(a, index, '2026-11-09');
  assignEvent(b, index, '2026-11-10');
  assert.equal(a.eventId, b.eventId);
  const event = index.events[a.eventId];
  assert.equal(event.count, 2);
  assert.deepEqual(event.sources.sort(), ['A', 'B']);
});

test('事件：无关标题不合并', () => {
  const index = { version: 1, events: {} };
  const a = { title: 'OpenAI releases GPT-5', url: 'https://a.example/1', source: 'A' };
  const b = { title: '量子位报道某公司融资', url: 'https://b.example/2', source: 'B' };
  assignEvent(a, index, '2026-11-09');
  assignEvent(b, index, '2026-11-10');
  assert.notEqual(a.eventId, b.eventId);
});

test('事件：超过 7 天不合并', () => {
  const index = { version: 1, events: {} };
  const a = { title: 'OpenAI releases GPT-5', url: 'https://a.example/1', source: 'A' };
  const b = { title: 'OpenAI releases GPT-5', url: 'https://b.example/2', source: 'B' };
  assignEvent(a, index, '2026-10-01');
  assignEvent(b, index, '2026-10-20');
  assert.notEqual(a.eventId, b.eventId);
});

test('事件：已有 eventId 的条目重复处理不重复计数', () => {
  const index = { version: 1, events: {} };
  const a = { title: 'OpenAI releases GPT-5', url: 'https://a.example/1', source: 'A' };
  assignEvent(a, index, '2026-11-09');
  const count = index.events[a.eventId].count;
  assignEvents([a], index, '2026-11-10');
  assert.equal(index.events[a.eventId].count, count);
});
