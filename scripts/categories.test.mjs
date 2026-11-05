import test from 'node:test';
import assert from 'node:assert/strict';
import { lockedCategory } from './lib/categories.mjs';

test('专用来源分类固定：arXiv / HF Papers / 微软研究院 -> 论文研究', () => {
  assert.equal(lockedCategory('arXiv cs.AI'), '论文研究');
  assert.equal(lockedCategory('Hugging Face Daily Papers'), '论文研究');
  assert.equal(lockedCategory('Microsoft Research'), '论文研究');
});

test('专用来源分类固定：宇树 / 智元 -> 具身智能', () => {
  assert.equal(lockedCategory('宇树 Unitree SDK'), '具身智能');
  assert.equal(lockedCategory('智元机器人 AgibotTech'), '具身智能');
});

test('会跨主题的源不锁定：NVIDIA / 人物博客 / 通用媒体', () => {
  assert.equal(lockedCategory('NVIDIA Developer Blog'), null);
  assert.equal(lockedCategory('Simon Willison'), null);
  assert.equal(lockedCategory('Latent Space'), null);
});

test('通用媒体不锁定，交给 LLM 判断', () => {
  assert.equal(lockedCategory('Hugging Face Blog'), null);
  assert.equal(lockedCategory('量子位'), null);
  assert.equal(lockedCategory('GitHub Trending 日榜'), null);
});
