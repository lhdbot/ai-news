import test from "node:test";
import assert from "node:assert/strict";
import {
  jaccard,
  mergeStorylines,
  parseHnHits,
  parseTrendingHtml,
  pickTop,
  titleTokens,
} from "./fetch-news.mjs";

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

function trendingArticle(repo, description) {
  return `<article class="Box-row">
    <h2><a href="/${repo}">${repo}</a></h2>
    <p class="col-9">${description}</p>
    <span itemprop="programmingLanguage">TypeScript</span>
    <span>1,234 stars today</span>
  </article>`;
}

test("Trending：过滤非 AI 项目后按榜序取 Top 8", () => {
  const html = [
    trendingArticle("example/database", "A general database for web apps"),
    trendingArticle("example/llm-engine", "LLM inference engine for agents"),
    trendingArticle("example/ai-assistant", "AI coding assistant with MCP"),
    trendingArticle("example/diffusion", "Diffusion transformer for multimodal generation"),
    trendingArticle("example/rag", "RAG framework for large language model apps"),
    trendingArticle("example/vision", "Computer vision and robotics toolkit"),
    trendingArticle("example/extra-ai", "Another AI framework"),
    trendingArticle("example/ai-tool-2", "AI powered productivity tool"),
    trendingArticle("example/ai-tool-3", "Yet another AI coding helper"),
    trendingArticle("example/ai-tool-4", "One more LLM wrapper"),
    '<article class="Box-row"><h2>缺链接的坏条目</h2></article>',
  ].join("\n");
  const source = {
    name: "GitHub Trending 日榜",
    category: "工具产品",
    weight: 9,
    count: 8,
  };
  const items = parseTrendingHtml(html, source);

  assert.equal(items.length, 8);
  assert.equal(items[0].url, "https://github.com/example/llm-engine");
  assert.match(items[0]._description, /日榜 #2/);
  assert.match(items[0]._description, /TypeScript/);
  assert.match(items[0]._description, /1,234 stars today/);
  assert.ok(items.every((item) => item.url !== "https://github.com/example/database"));
  assert.ok(items.every((item) => item.url !== "https://github.com/example/ai-tool-4"));
});

test("Trending：同一仓库跨榜使用稳定 id，空页面明确报错", () => {
  const html = trendingArticle("example/llm-engine", "LLM inference engine");
  const daily = parseTrendingHtml(html, {
    name: "GitHub Trending 日榜",
    category: "工具产品",
    weight: 9,
  });
  const weekly = parseTrendingHtml(html, {
    name: "GitHub Trending 周榜",
    category: "工具产品",
    weight: 9,
  });
  assert.equal(daily[0].id, weekly[0].id);
  assert.throws(() => parseTrendingHtml("<html></html>", {}), /未解析到 Trending 条目/);
});

test("Hacker News：AI、点数和时间过滤，Ask HN 使用回退链接", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const data = {
    hits: [
      {
        objectID: "1",
        title: "New LLM agent framework",
        url: "https://example.com/llm-agent",
        created_at_i: nowSeconds - 60,
        points: 50,
        num_comments: 12,
        author: "alice",
      },
      {
        objectID: "ask 2",
        title: "Ask HN: Best AI coding assistant?",
        created_at_i: nowSeconds - 120,
        points: 20,
        num_comments: 8,
        author: "bob",
      },
      {
        objectID: "3",
        title: "Maintaining a general database",
        url: "https://example.com/database",
        created_at_i: nowSeconds - 60,
        points: 100,
      },
      {
        objectID: "4",
        title: "Old GPT release",
        url: "https://example.com/old-gpt",
        created_at_i: nowSeconds - 49 * 3600,
        points: 100,
      },
      {
        objectID: "5",
        title: "Small AI project",
        url: "https://example.com/small-ai",
        created_at_i: nowSeconds - 60,
        points: 19,
      },
    ],
  };
  const items = parseHnHits(
    data,
    { name: "Hacker News AI 热帖", category: "行业动态", weight: 8, minPoints: 20 },
    new Date(Date.now() - 48 * 3600 * 1000),
  );

  assert.equal(items.length, 2);
  assert.equal(items[0].url, "https://example.com/llm-agent");
  assert.match(items[0]._description, /50 points · 12 comments/);
  assert.equal(items[1].url, "https://news.ycombinator.com/item?id=ask%202");
  assert.ok(items.every((item) => !item.title.includes("Maintaining")));
});

test("pickTop：日周月同仓库去重后保留日榜", () => {
  const items = [
    {
      id: "daily",
      url: "https://github.com/example/ai",
      source: "GitHub Trending 日榜",
      category: "工具产品",
      _weight: 9,
      published_at: "2026-10-27T00:00:00.000Z",
    },
    {
      id: "weekly",
      url: "https://github.com/example/ai/",
      source: "GitHub Trending 周榜",
      category: "工具产品",
      _weight: 9,
      published_at: "2026-10-27T00:00:00.000Z",
    },
  ];
  const picked = pickTop(items);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].source, "GitHub Trending 日榜");
});

test("pickTop：工具产品最多 40%，其他分类继续补足", () => {
  const iso = "2026-10-27T00:00:00.000Z";
  const tools = Array.from({ length: 20 }, (_, i) => ({
    id: `t${i}`,
    url: `https://example.com/tool-${i}`,
    source: `工具源${i % 4}`,
    category: "工具产品",
    _weight: 9,
    published_at: iso,
  }));
  const media = Array.from({ length: 30 }, (_, i) => ({
    id: `m${i}`,
    url: `https://example.com/media-${i}`,
    source: `媒体源${i % 6}`,
    category: "行业动态",
    _weight: 8,
    published_at: iso,
  }));
  const picked = pickTop([...tools, ...media]);
  assert.equal(picked.length, 30);
  assert.equal(picked.filter((item) => item.category === "工具产品").length, 12);
  assert.equal(picked.filter((item) => item.category === "行业动态").length, 18);
});

test("pickTop：高权重内容占满时仍保留热榜、行业动态和人物经验位置", () => {
  const iso = "2026-10-27T00:00:00.000Z";
  const models = Array.from({ length: 40 }, (_, i) => ({
    id: `model-${i}`,
    url: `https://example.com/model-${i}`,
    source: `模型源${i % 8}`,
    category: "模型发布",
    _weight: 12,
    published_at: iso,
  }));
  const trending = Array.from({ length: 5 }, (_, i) => ({
    id: `trend-${i}`,
    url: `https://github.com/example/ai-${i}`,
    source: i % 2 === 0 ? "GitHub Trending 日榜" : "GitHub Trending 周榜",
    category: "工具产品",
    _weight: 9,
    published_at: iso,
  }));
  const industry = Array.from({ length: 10 }, (_, i) => ({
    id: `industry-${i}`,
    url: `https://example.com/industry-${i}`,
    source: `行业源${i % 3}`,
    category: "行业动态",
    _weight: 8,
    published_at: iso,
  }));
  const people = Array.from({ length: 5 }, (_, i) => ({
    id: `people-${i}`,
    url: `https://example.com/people-${i}`,
    source: `人物源${i % 2}`,
    category: "人物经验",
    _weight: 8,
    published_at: iso,
  }));
  const picked = pickTop([...models, ...trending, ...industry, ...people]);

  assert.equal(picked.length, 30);
  assert.equal(picked.filter((item) => item.source.startsWith("GitHub Trending")).length, 3);
  assert.equal(picked.filter((item) => item.category === "行业动态").length, 6);
  assert.equal(picked.filter((item) => item.category === "人物经验").length, 3);
  assert.equal(picked.filter((item) => item.category === "模型发布").length, 18);
});

test("pickTop：为论文/模型/芯片/具身/行业/人物保留最小配额", () => {
  const iso = "2026-10-27T00:00:00.000Z";
  const models = Array.from({ length: 40 }, (_, i) => ({
    id: `model-${i}`,
    url: `https://example.com/model-${i}`,
    source: `模型源${i % 8}`,
    category: "模型发布",
    _weight: 12,
    published_at: iso,
  }));
  const others = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `paper-${i}`,
      url: `https://example.com/paper-${i}`,
      source: `论文源${i % 3}`,
      category: "论文研究",
      _weight: 6,
      published_at: iso,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `chip-${i}`,
      url: `https://example.com/chip-${i}`,
      source: `芯片源${i % 2}`,
      category: "芯片算力",
      _weight: 5,
      published_at: iso,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `robot-${i}`,
      url: `https://example.com/robot-${i}`,
      source: `具身源${i % 2}`,
      category: "具身智能",
      _weight: 5,
      published_at: iso,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `industry-${i}`,
      url: `https://example.com/industry-${i}`,
      source: `行业源${i % 3}`,
      category: "行业动态",
      _weight: 4,
      published_at: iso,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `people-${i}`,
      url: `https://example.com/people-${i}`,
      source: `人物源${i % 2}`,
      category: "人物经验",
      _weight: 4,
      published_at: iso,
    })),
  ];
  const picked = pickTop([...models, ...others]);
  const count = (category) => picked.filter((item) => item.category === category).length;
  assert.equal(picked.length, 30);
  assert.ok(count("论文研究") >= 3, "论文研究应至少 3 条");
  assert.ok(count("模型发布") >= 2, "模型发布应至少 2 条");
  assert.ok(count("芯片算力") >= 2, "芯片算力应至少 2 条");
  assert.ok(count("具身智能") >= 2, "具身智能应至少 2 条");
  assert.ok(count("行业动态") >= 6, "行业动态应至少 6 条");
  assert.ok(count("人物经验") >= 3, "人物经验应至少 3 条");
});
