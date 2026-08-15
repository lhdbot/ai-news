import test from "node:test";
import assert from "node:assert/strict";
import { jaccard, mergeStorylines, pickTop, titleTokens } from "./fetch-news.mjs";

test("英文标题：词级 token，同事件跨源报道可合并", () => {
  const a = titleTokens("OpenAI releases GPT-5");
  const b = titleTokens("OpenAI unveils GPT-5");
  const s = jaccard(a, b);
  assert.ok(s >= 0.6, `英文同事件 Jaccard=${s} 应 >= 0.6`);
});

test("中文标题：字符 bigram 分词，相似标题相似度显著高于旧空白分词", () => {
  const a = titleTokens("谷歌开始肢解DeepMind，数个团队被划归总部");
  const b = titleTokens("谷歌拆分DeepMind：多团队划归总部");
  const s = jaccard(a, b);
  assert.ok(a.size > 1, "中文标题应被切成多个 token");
  assert.ok(s > 0.2, `中文相似标题 Jaccard=${s} 应 > 0.2`);

  // 无关标题不应误合并
  const c = titleTokens("OpenAI 发布新模型");
  const d = titleTokens("量子位报道某公司融资");
  assert.ok(jaccard(c, d) < 0.3, "无关标题相似度应很低");
});

test("完全相同的标题相似度为 1", () => {
  assert.equal(
    jaccard(titleTokens("Gemini 3.7 Flash 发布"), titleTokens("Gemini 3.7 Flash 发布")),
    1,
  );
});

test("mergeStorylines：合并跨源同事件、保留高权重、计算 heat", () => {
  const merged = mergeStorylines([
    { id: 1, title: "OpenAI releases GPT-5", source: "A", _weight: 10 },
    { id: 2, title: "OpenAI unveils GPT-5", source: "B", _weight: 8 },
    { id: 3, title: "量子位报道某公司融资", source: "C", _weight: 9 },
  ]);
  assert.equal(merged.length, 2);
  const main = merged.find((m) => m.id === 1);
  assert.ok(main, "高权重条目应保留为主条目");
  assert.equal(main.relatedSources?.length, 1);
  assert.equal(main.heat, 12); // 10 + 2 × 1
});

test("pickTop：论文研究分类配额（≤40%），其余位置留给其他分类", () => {
  const iso = (i) => new Date(2026, 7, 15, 0, i).toISOString();
  // 论文：3 个 arXiv 源 × 10 条（每源 cap 5，无分类配额时最多 15 条）
  const papers = [];
  for (let i = 0; i < 30; i++) {
    const src = ["arXiv cs.AI", "arXiv cs.CL", "arXiv cs.LG"][i % 3];
    papers.push({
      id: `p${i}`,
      url: `https://arxiv.org/abs/2608.${10000 + i}`,
      source: src,
      category: "论文研究",
      _weight: 10,
      published_at: iso(i),
    });
  }
  // 媒体：6 个源 × 5 条
  const media = [];
  for (let i = 0; i < 30; i++) {
    media.push({
      id: `m${i}`,
      url: `https://media.example.com/${i}`,
      source: `媒体源${i % 6}`,
      category: "行业动态",
      _weight: 8,
      published_at: iso(i),
    });
  }
  const picked = pickTop([...papers, ...media]);
  assert.equal(picked.length, 30);
  assert.equal(
    picked.filter((p) => p.category === "论文研究").length,
    Math.ceil(30 * 0.4), // 12
    "论文研究应被限制在 40% 配额内",
  );
});
