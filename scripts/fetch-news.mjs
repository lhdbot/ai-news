#!/usr/bin/env node
/**
 * AI 日报抓取 + 摘要脚本
 *
 * - 并发抓取 10 个内容源（RSS / JSON API），单源 15s 超时，失败仅告警
 * - 取近 48h 条目，按 URL 去重；官方源加权、每源限 5 条，取 top 30
 * - 有 DEEPSEEK_API_KEY 时调用 DeepSeek（OpenAI 兼容）批量生成
 *   中文标题 / 一句话摘要 / 为什么重要 / 分类 / 标签
 * - 无 key 时降级：保留原标题，category 按源类型推断，summarized=false
 * - 输出 data/news/YYYY-MM-DD.json（北京时间；已存在则按 URL 合并去重）
 *   并维护 data/index.json
 *
 * 用法：node scripts/fetch-news.mjs
 */

import { extract } from "@extractus/feed-extractor";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const NEWS_DIR = path.join(ROOT, "data", "news");
const INDEX_FILE = path.join(ROOT, "data", "index.json");

const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_HOURS = 48;
const PER_SOURCE_CAP = 5;
const TOP_N = 30;
const DEEPSEEK_BATCH = 10;

const CATEGORIES = [
  "模型发布",
  "论文研究",
  "行业动态",
  "工具产品",
  "芯片算力",
  "具身智能",
];

/**
 * weight 越大排序越靠前（官方一手源优先）；official 标记用于无 key 时的分类推断
 */
const SOURCES = [
  {
    name: "arXiv cs.AI",
    url: "https://rss.arxiv.org/rss/cs.AI",
    type: "rss",
    weight: 10,
    category: "论文研究",
  },
  {
    name: "arXiv cs.CL",
    url: "https://rss.arxiv.org/rss/cs.CL",
    type: "rss",
    weight: 10,
    category: "论文研究",
  },
  {
    name: "arXiv cs.LG",
    url: "https://rss.arxiv.org/rss/cs.LG",
    type: "rss",
    weight: 10,
    category: "论文研究",
  },
  {
    name: "OpenAI",
    url: "https://openai.com/news/rss.xml",
    type: "rss",
    weight: 12,
    category: "模型发布",
  },
  {
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    type: "rss",
    weight: 12,
    category: "模型发布",
  },
  {
    name: "Microsoft Research",
    url: "https://www.microsoft.com/en-us/research/feed/",
    type: "rss",
    weight: 11,
    category: "论文研究",
  },
  {
    name: "量子位",
    url: "https://www.qbitai.com/feed",
    type: "rss",
    weight: 8,
    category: "行业动态",
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    type: "rss",
    weight: 7,
    category: "行业动态",
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    type: "rss",
    weight: 7,
    category: "行业动态",
  },
  {
    name: "MIT Tech Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    type: "rss",
    weight: 8,
    category: "行业动态",
  },
  {
    name: "Hugging Face Daily Papers",
    url: "https://huggingface.co/api/daily_papers",
    type: "hf",
    weight: 9,
    category: "论文研究",
  },
  {
    name: "GitHub Trending 日榜",
    url: "https://github.com/trending?since=daily",
    type: "trending",
    weight: 9,
    category: "工具产品",
  },
  {
    name: "GitHub Trending 周榜",
    url: "https://github.com/trending?since=weekly",
    type: "trending",
    weight: 9,
    category: "工具产品",
  },
  {
    name: "GitHub Trending 月榜",
    url: "https://github.com/trending?since=monthly",
    type: "trending",
    weight: 9,
    category: "工具产品",
  },
];

const USER_AGENT =
  "Mozilla/5.0 (compatible; ai-news-daily/1.0; +https://github.com/)";

/* ------------------------------ 工具函数 ------------------------------ */

function todayCN() {
  // 日报日期按北京时间计
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function hashId(str) {
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, 12);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    // 去掉常见追踪参数
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "src") {
        u.searchParams.delete(key);
      }
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function stripHtml(s) {
  return (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} 超时（>${ms / 1000}s）`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ 抓取各源 ------------------------------ */

async function fetchRssSource(source, since) {
  const feed = await withTimeout(
    extract(
      source.url,
      { descriptionMaxLen: 500, useISODateFormat: true },
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    ),
    FETCH_TIMEOUT_MS + 2000,
    source.name,
  );
  const items = [];
  for (const entry of feed.entries ?? []) {
    if (!entry.link || !entry.title) continue;
    const published = entry.published ? new Date(entry.published) : null;
    if (published && !Number.isNaN(published.getTime())) {
      if (published < since) continue;
    }
    items.push({
      id: hashId(normalizeUrl(entry.link)),
      title: stripHtml(entry.title),
      url: entry.link,
      source: source.name,
      category: source.category,
      tags: [],
      published_at: published && !Number.isNaN(published.getTime())
        ? published.toISOString()
        : new Date().toISOString(),
      _weight: source.weight,
      _description: stripHtml(entry.description ?? "").slice(0, 500),
    });
  }
  return items;
}

async function fetchHfSource(source, since) {
  const res = await withTimeout(
    fetch(source.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
    FETCH_TIMEOUT_MS + 2000,
    source.name,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const papers = await res.json();
  const items = [];
  for (const p of Array.isArray(papers) ? papers : []) {
    const paper = p.paper ?? p;
    const title = paper.title ?? p.title;
    const paperId = paper.id ?? p.id;
    if (!title || !paperId) continue;
    const publishedRaw = paper.publishedAt ?? p.publishedAt ?? paper.submittedOn;
    const published = publishedRaw ? new Date(publishedRaw) : null;
    if (published && !Number.isNaN(published.getTime()) && published < since) {
      continue;
    }
    const url = `https://huggingface.co/papers/${paperId}`;
    items.push({
      id: hashId(normalizeUrl(url)),
      title: String(title).trim(),
      url,
      source: source.name,
      category: source.category,
      tags: [],
      published_at: published && !Number.isNaN(published.getTime())
        ? published.toISOString()
        : new Date().toISOString(),
      _weight: source.weight,
      _description: stripHtml(paper.summary ?? "").slice(0, 500),
    });
  }
  return items;
}

/* ------------------------- GitHub Trending ------------------------- */

/** github.com 网页在部分网络环境需走代理；优先直连，失败后回退 curl + 代理 */
async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (directErr) {
    const proxy = process.env.AI_NEWS_PROXY ?? "http://127.0.0.1:7897";
    const { stdout } = await execFileP(
      "curl",
      ["-s", "--max-time", String(FETCH_TIMEOUT_MS / 1000), "-x", proxy, "-A", "Mozilla/5.0", url],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    if (!stdout || stdout.length < 10000) {
      throw new Error(`直连失败(${(directErr.message || "").slice(0, 80)})且代理抓取内容异常`);
    }
    return stdout;
  }
}

/** 解析 Trending 页面第 1 名仓库 */
async function fetchTrendingSource(source) {
  const html = await withTimeout(fetchHtml(source.url), FETCH_TIMEOUT_MS + 5000, source.name);
  const m = html.match(/<article class="Box-row">[\s\S]*?<\/article>/);
  if (!m) throw new Error("未解析到 Trending 条目（页面结构可能已变更）");
  const art = m[0];

  const repoMatch = art.match(/<h2[^>]*>[\s\S]*?<a href="(\/[^"]+)"/);
  if (!repoMatch) throw new Error("未解析到仓库链接");
  const repoPath = repoMatch[1].trim(); // /owner/repo
  const repoName = repoPath.slice(1);

  const descMatch = art.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/);
  const desc = descMatch ? stripHtml(descMatch[1]) : "";

  const langMatch = art.match(/itemprop="programmingLanguage">([^<]+)</);
  const lang = langMatch ? langMatch[1].trim() : "";

  const starsMatch = art.match(/([\d,]+)\s*stars\s*(today|this week|this month)/);
  const stars = starsMatch ? `${starsMatch[1]} stars ${starsMatch[2]}` : "";

  const url = `https://github.com${repoPath}`;
  return [
    {
      id: hashId(normalizeUrl(url) + source.name),
      title: `${repoName}: ${desc || "GitHub Trending #1"}`,
      url,
      source: source.name,
      category: source.category,
      tags: [],
      published_at: new Date().toISOString(),
      _weight: source.weight,
      _description: [desc, lang && `语言: ${lang}`, stars && `热度: ${stars}`]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500),
    },
  ];
}

async function fetchAllSources(since) {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const items =
        source.type === "hf"
          ? await fetchHfSource(source, since)
          : source.type === "trending"
            ? await fetchTrendingSource(source)
            : await fetchRssSource(source, since);
      console.log(`[ok] ${source.name}: ${items.length} 条`);
      return items;
    }),
  );
  const all = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      failed.push(SOURCES[i].name);
      console.warn(`[warn] 源「${SOURCES[i].name}」抓取失败: ${r.reason?.message ?? r.reason}`);
    }
  });
  if (failed.length > 0) {
    console.warn(`[warn] 共 ${failed.length} 个源失败（已跳过）: ${failed.join(", ")}`);
  }
  return all;
}

/* ------------------------------ 排序与筛选 ------------------------------ */

function pickTop(items) {
  // 按 URL 去重
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = normalizeUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  // 排序：源权重优先，其次时间新
  deduped.sort((a, b) => {
    if (b._weight !== a._weight) return b._weight - a._weight;
    return new Date(b.published_at) - new Date(a.published_at);
  });
  // 每源限额 + top N
  const perSource = new Map();
  const picked = [];
  for (const item of deduped) {
    const n = perSource.get(item.source) ?? 0;
    if (n >= PER_SOURCE_CAP) continue;
    perSource.set(item.source, n + 1);
    picked.push(item);
    if (picked.length >= TOP_N) break;
  }
  return picked;
}

/* ------------------------------ DeepSeek 摘要 ------------------------------ */

async function summarizeBatch(apiKey, batch) {
  const payload = batch.map((it, i) => ({
    idx: i,
    title: it.title,
    source: it.source,
    description: it._description,
  }));
  const prompt = [
    "你是一名资深 AI 行业编辑，读者是一位想持续学习 AI 的开发者。下面是若干条 AI 相关新闻/论文/开源项目的标题与简介（JSON 数组）。",
    "请为每一条生成以下字段，并以 JSON object 返回，形如 {\"items\": [{\"idx\": 0, ...}]}：",
    '- "title_zh": 简洁准确的中文标题（不超过 30 字）',
    '- "summary_zh": 对原文内容的总结（不超过 80 字，说清发生了什么，不要只复述标题）',
    '- "learn": 读者可以从中学到什么（不超过 50 字，知识点/方法/趋势）',
    '- "impact": 这件事的影响（不超过 40 字，对行业/技术/用户）',
    '- "advice": 给读者的行动建议（不超过 40 字，具体可执行）',
    `- "category": 从以下分类中任选一个：${CATEGORIES.join("、")}`,
    '- "tags": 2-4 个标签（公司/模型/技术名词，尽量用原文专有名词）',
    "只返回 JSON，不要输出其他内容。",
    "",
    JSON.stringify(payload),
  ].join("\n");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const arr = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  const byIdx = new Map(arr.map((x) => [x.idx, x]));
  return batch.map((_, i) => byIdx.get(i) ?? null);
}

async function summarizeAll(items) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log("[info] 未设置 DEEPSEEK_API_KEY，跳过 LLM 摘要（降级模式）。");
    return items.map((it) => ({
      ...it,
      title_zh: "",
      summary_zh: it._description.slice(0, 80),
      why_it_matters: "",
      tags: [],
      summarized: false,
    }));
  }
  console.log(`[info] 使用 DeepSeek 生成摘要，共 ${items.length} 条…`);
  const out = [];
  for (let i = 0; i < items.length; i += DEEPSEEK_BATCH) {
    const batch = items.slice(i, i + DEEPSEEK_BATCH);
    let results = null;
    try {
      results = await summarizeBatch(apiKey, batch);
    } catch (err) {
      console.warn(`[warn] DeepSeek 批次 ${i / DEEPSEEK_BATCH + 1} 失败，该批次降级: ${err.message}`);
    }
    batch.forEach((it, j) => {
      const r = results?.[j];
      if (r && r.title_zh) {
        out.push({
          ...it,
          title_zh: String(r.title_zh ?? ""),
          summary_zh: String(r.summary_zh ?? ""),
          learn: String(r.learn ?? ""),
          impact: String(r.impact ?? ""),
          advice: String(r.advice ?? ""),
          category: CATEGORIES.includes(r.category) ? r.category : it.category,
          tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 5) : [],
          summarized: true,
        });
      } else {
        out.push({
          ...it,
          title_zh: "",
          summary_zh: it._description.slice(0, 80),
          why_it_matters: "",
          tags: [],
          summarized: false,
        });
      }
    });
  }
  return out;
}

/* ------------------------------ 落盘 ------------------------------ */

function loadExisting(date) {
  const file = path.join(NEWS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeDaily(date, items) {
  fs.mkdirSync(NEWS_DIR, { recursive: true });
  const file = path.join(NEWS_DIR, `${date}.json`);
  const daily = {
    date,
    generated_at: new Date().toISOString(),
    items,
  };
  fs.writeFileSync(file, JSON.stringify(daily, null, 2) + "\n", "utf-8");
  console.log(`[ok] 写入 ${path.relative(ROOT, file)}（${items.length} 条）`);
}

function updateIndex() {
  const dates = fs
    .readdirSync(NEWS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
  fs.writeFileSync(
    INDEX_FILE,
    JSON.stringify({ updated_at: new Date().toISOString(), dates }, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[ok] 更新 data/index.json（${dates.length} 天）`);
}

/* ------------------------------ 主流程 ------------------------------ */

async function main() {
  const date = todayCN();
  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);
  console.log(`[info] 抓取窗口：近 ${WINDOW_HOURS} 小时；日报日期 ${date}（北京时间）`);

  const raw = await fetchAllSources(since);
  console.log(`[info] 各源合计 ${raw.length} 条（去重前）`);

  let picked = pickTop(raw);
  console.log(`[info] 去重/限额后 ${picked.length} 条`);

  // 与当日已有数据合并：新条目若 URL 已存在则丢弃（保留已有摘要）
  const existing = loadExisting(date);
  const existingUrls = new Set(
    (existing?.items ?? []).map((it) => normalizeUrl(it.url)),
  );
  const newItems = picked.filter((it) => !existingUrls.has(normalizeUrl(it.url)));
  console.log(`[info] 当日已有 ${existingUrls.size} 条，本次新增 ${newItems.length} 条`);

  const summarized = await summarizeAll(newItems);
  // 清理内部字段
  const clean = (it) => {
    const rest = { ...it };
    delete rest._weight;
    delete rest._description;
    return rest;
  };
  const merged = [...(existing?.items ?? []), ...summarized.map(clean)];
  // 兜底：当天一条都没有且没有历史文件时，仍然写一个空日报，保证前端有数据可读
  writeDaily(date, merged);
  updateIndex();

  const okCount = summarized.filter((s) => s.summarized).length;
  console.log(`[done] 完成：当日共 ${merged.length} 条，其中本次 AI 摘要 ${okCount} 条。`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
